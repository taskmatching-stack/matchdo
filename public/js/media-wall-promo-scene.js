/**
 * 首頁媒體牆「情境圖」專用拼格（2 欄；橫 2×2、直/方 1×2 子列）
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
            for (var r = 0; r < maxRow; r += 2) {
                list.push({ r: r, c: 0, rs: 2, cs: 2 });
            }
            return list;
        }
        if (orient === 'portrait') {
            for (var r2 = 0; r2 < maxRow; r2++) {
                list.push({ r: r2, c: 0, rs: 2, cs: 1 });
                list.push({ r: r2, c: 1, rs: 2, cs: 1 });
                list.push({ r: r2 + 1, c: 0, rs: 2, cs: 1 });
                list.push({ r: r2 + 1, c: 1, rs: 2, cs: 1 });
            }
            return list;
        }
        for (var r3 = 0; r3 < maxRow; r3 += 2) {
            list.push({ r: r3, c: 0, rs: 2, cs: 1 });
            list.push({ r: r3, c: 1, rs: 2, cs: 1 });
            list.push({ r: r3 + 1, c: 0, rs: 2, cs: 1 });
            list.push({ r: r3 + 1, c: 1, rs: 2, cs: 1 });
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

    /** 兩格為一組：若 band 內只剩單格空格，優先塞方圖 */
    function fillBandOrphans(occ, squares, placedOut) {
        if (!squares.length) return;
        var maxR = occ.length;
        for (var band = 0; band < maxR + 2; band += 2) {
            var cells = [
                occFree(occ, band, 0, 2, 1),
                occFree(occ, band, 1, 2, 1),
                occFree(occ, band + 1, 0, 2, 1),
                occFree(occ, band + 1, 1, 2, 1)
            ];
            var freeCount = cells.filter(Boolean).length;
            if (freeCount !== 1 || !squares.length) continue;
            var slots = [
                { r: band, c: 0 }, { r: band, c: 1 }, { r: band + 1, c: 0 }, { r: band + 1, c: 1 }
            ];
            for (var s = 0; s < slots.length; s++) {
                if (!occFree(occ, slots[s].r, slots[s].c, 2, 1)) continue;
                var sq = squares.shift();
                var pl = { r: slots[s].r + 1, c: slots[s].c + 1, rs: 2, cs: 1, orient: 'square' };
                occMark(occ, slots[s].r, slots[s].c, 2, 1);
                placedOut.push({ item: sq, placement: pl });
                break;
            }
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
        wrap.style.gridRow = placement.r + ' / span ' + placement.rs;
        wrap.style.gridColumn = placement.c + ' / span ' + placement.cs;
        wrap.classList.add('media-wall-promo-item');
        wrap.classList.add('media-wall-promo-' + (placement.orient || 'square'));
    }

    global.MatchdoMediaWallPromoScene = {
        orientOf: orientOf,
        packPromoSceneItems: packPromoSceneItems,
        applyPlacement: applyPlacement
    };
})(typeof window !== 'undefined' ? window : this);
