/**
 * 情境圖媒體牆拼格（2 欄底格，格寬高同首頁 260px）
 * 橫圖 2×1、直圖 1×2、方圖 1×1
 */
(function (global) {
    'use strict';

    function orientOf(item) {
        if (item && item.promo_orient) return item.promo_orient;
        var w = parseInt(item && item.width, 10) || 0;
        var h = parseInt(item && item.height, 10) || 0;
        if ((!w || !h) && item && item.aspect_ratio) {
            var m = String(item.aspect_ratio).trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
            if (m) { w = parseFloat(m[1]); h = parseFloat(m[2]); }
        }
        if (!w || !h) return 'square';
        var r = w / h;
        if (r > 1.08) return 'landscape';
        if (r < 0.92) return 'portrait';
        return 'square';
    }

    function occEnsure(occ, r) {
        while (occ.length <= r) occ.push([0, 0]);
    }

    function occFree(occ, r, c, rs, cs) {
        if (c < 0 || c + cs > 2) return false;
        for (var dr = 0; dr < rs; dr++) {
            occEnsure(occ, r + dr);
            for (var dc = 0; dc < cs; dc++) {
                if (occ[r + dr][c + dc]) return false;
            }
        }
        return true;
    }

    function occMark(occ, r, c, rs, cs) {
        for (var dr = 0; dr < rs; dr++) {
            occEnsure(occ, r + dr);
            for (var dc = 0; dc < cs; dc++) occ[r + dr][c + dc] = 1;
        }
    }

    function footprintCandidates(orient) {
        var list = [];
        var maxRow = 240;
        if (orient === 'landscape') {
            for (var r = 0; r < maxRow; r++) {
                list.push({ r: r, c: 0, rs: 1, cs: 2 });
            }
            return list;
        }
        if (orient === 'portrait') {
            for (var r2 = 0; r2 < maxRow; r2++) {
                list.push({ r: r2, c: 0, rs: 2, cs: 1 });
                list.push({ r: r2, c: 1, rs: 2, cs: 1 });
            }
            return list;
        }
        for (var r3 = 0; r3 < maxRow; r3++) {
            list.push({ r: r3, c: 0, rs: 1, cs: 1 });
            list.push({ r: r3, c: 1, rs: 1, cs: 1 });
        }
        return list;
    }

    function findEarliest(occ, orient) {
        var cands = footprintCandidates(orient);
        for (var i = 0; i < cands.length; i++) {
            var p = cands[i];
            if (occFree(occ, p.r, p.c, p.rs, p.cs)) {
                return { r: p.r + 1, c: p.c + 1, rs: p.rs, cs: p.cs, orient: orient };
            }
        }
        return null;
    }

    function fillBandOrphans(occ, squares, placedOut) {
        if (!squares.length) return;
        var maxR = Math.max(occ.length, 2);
        for (var band = 0; band < maxR + 2; band += 2) {
            var freeSlots = [];
            for (var dr = 0; dr < 2; dr++) {
                for (var dc = 0; dc < 2; dc++) {
                    if (occFree(occ, band + dr, dc, 1, 1)) {
                        freeSlots.push({ r: band + dr, c: dc });
                    }
                }
            }
            if (freeSlots.length !== 1 || !squares.length) continue;
            var slot = freeSlots[0];
            var sq = squares.shift();
            var pl = { r: slot.r + 1, c: slot.c + 1, rs: 1, cs: 1, orient: 'square' };
            occMark(occ, slot.r, slot.c, 1, 1);
            placedOut.push({ item: sq, placement: pl });
        }
    }

    function packPromoSceneItems(items) {
        var occ = [];
        var main = [];
        var squares = [];
        (items || []).forEach(function (item) {
            var o = orientOf(item);
            item._promoOrient = o;
            if (o === 'square') squares.push(item);
            else main.push(item);
        });
        var placed = [];
        main.forEach(function (item) {
            fillBandOrphans(occ, squares, placed);
            var pl = findEarliest(occ, item._promoOrient);
            if (!pl) return;
            occMark(occ, pl.r - 1, pl.c - 1, pl.rs, pl.cs);
            placed.push({ item: item, placement: pl });
        });
        fillBandOrphans(occ, squares, placed);
        while (squares.length) {
            var pl2 = findEarliest(occ, 'square');
            if (!pl2) break;
            occMark(occ, pl2.r - 1, pl2.c - 1, pl2.rs, pl2.cs);
            placed.push({ item: squares.shift(), placement: pl2 });
        }
        return placed;
    }

    function applyPlacement(wrap, placement) {
        if (!wrap || !placement) return;
        wrap.classList.remove('media-wall-1x2', 'media-wall-comparison');
        wrap.style.setProperty('grid-row', placement.r + ' / span ' + placement.rs, 'important');
        wrap.style.setProperty('grid-column', placement.c + ' / span ' + placement.cs, 'important');
        wrap.classList.add('media-wall-promo-item');
        wrap.classList.add('media-wall-promo-' + (placement.orient || 'square'));
    }

    global.MatchdoMediaWallPromoScene = {
        orientOf: orientOf,
        packPromoSceneItems: packPromoSceneItems,
        applyPlacement: applyPlacement
    };
})(typeof window !== 'undefined' ? window : this);
