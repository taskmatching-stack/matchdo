/**
 * 情境圖媒體牆拼格（欄數同首頁 auto-fill；由 index.html 傳入 colCount）
 * 拼格：以兩列為一組決定「上下上下」掃描順序（非禁直圖跨組）；直圖 1×2 上格對齊組內任一行即可
 */
(function (global) {
    'use strict';

    /** 4:3、3:4 與 1:1 同為單格 */
    function isSingleCellPromoRatio(aspectRatio, width, height) {
        var ar = String(aspectRatio || '').trim().replace(/\s+/g, '');
        if (ar === '1:1' || ar === '4:3' || ar === '3:4') return true;
        var w = parseInt(width, 10) || 0;
        var h = parseInt(height, 10) || 0;
        if ((!w || !h) && aspectRatio) {
            var m = String(aspectRatio).trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
            if (m) { w = parseFloat(m[1]); h = parseFloat(m[2]); }
        }
        if (!w || !h) return false;
        var r = w / h;
        if (Math.abs(r - 1) <= 0.08) return true;
        if (Math.abs(r - 4 / 3) / (4 / 3) <= 0.04) return true;
        if (Math.abs(r - 3 / 4) / (3 / 4) <= 0.04) return true;
        return false;
    }

    function orientOf(item) {
        var w = parseInt(item && item.width, 10) || 0;
        var h = parseInt(item && item.height, 10) || 0;
        if ((!w || !h) && item && item.aspect_ratio) {
            var m = String(item.aspect_ratio).trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
            if (m) { w = parseFloat(m[1]); h = parseFloat(m[2]); }
        }
        if (isSingleCellPromoRatio(item && item.aspect_ratio, w, h)) {
            // 高解析度方圖（≥2M pixels）→ 2×2 大圖
            if (w > 0 && h > 0 && w * h >= 2000000) {
                return 'large-square';
            }
            return 'square';
        }
        if (item && item.promo_orient) return item.promo_orient;
        if (!w || !h) return 'square';
        var r = w / h;
        if (r > 1.08) return 'landscape';
        if (r < 0.92) return 'portrait';
        return 'square';
    }

    function normGridCols(gridCols) {
        return Math.max(2, parseInt(gridCols, 10) || 2);
    }

    function occEnsure(occ, r, gridCols) {
        while (occ.length <= r) occ.push([]);
        while (occ[r].length < gridCols) occ[r].push(0);
    }

    function occFree(occ, r, c, rs, cs, gridCols) {
        if (c < 0 || c + cs > gridCols) return false;
        for (var dr = 0; dr < rs; dr++) {
            occEnsure(occ, r + dr, gridCols);
            for (var dc = 0; dc < cs; dc++) {
                if (occ[r + dr][c + dc]) return false;
            }
        }
        return true;
    }

    function occMark(occ, r, c, rs, cs, gridCols) {
        for (var dr = 0; dr < rs; dr++) {
            occEnsure(occ, r + dr, gridCols);
            for (var dc = 0; dc < cs; dc++) occ[r + dr][c + dc] = 1;
        }
    }

    function footprintSize(orient) {
        if (orient === 'landscape') return { rs: 1, cs: 2 };
        if (orient === 'portrait') return { rs: 2, cs: 1 };
        if (orient === 'large-square') return { rs: 2, cs: 2 };
        return { rs: 1, cs: 1 };
    }

    /**
     * 掃描順序：band（0–1、2–3…）→ 欄 → 上/下。
     * 直圖 1×2 可跨 band（下格延伸到下一組）；上格只需落在該 band 的上列或下列。
     */
    function findEarliest(occ, orient, gridCols) {
        var fp = footprintSize(orient);
        var rs = fp.rs;
        var cs = fp.cs;
        var maxRow = Math.max(occ.length, 1) + 34;
        for (var bandStart = 0; bandStart < maxRow; bandStart += 2) {
            for (var c = 0; c <= gridCols - cs; c++) {
                for (var dr = 0; dr < 2; dr++) {
                    var r = bandStart + dr;
                    if (occFree(occ, r, c, rs, cs, gridCols)) {
                        return { r: r + 1, c: c + 1, rs: rs, cs: cs, orient: orient };
                    }
                }
            }
        }
        return null;
    }

    function fillBandOrphans(occ, squares, placedOut, gridCols) {
        if (!squares.length || gridCols !== 2) return;
        var maxR = Math.max(occ.length, 2);
        for (var band = 0; band < maxR + 2; band += 2) {
            var freeSlots = [];
            for (var dr = 0; dr < 2; dr++) {
                for (var dc = 0; dc < 2; dc++) {
                    if (occFree(occ, band + dr, dc, 1, 1, gridCols)) {
                        freeSlots.push({ r: band + dr, c: dc });
                    }
                }
            }
            // 更積極填補：只要有空格且有方圖，就填補（不限孤兒格）
            while (freeSlots.length > 0 && squares.length > 0) {
                var slot = freeSlots.shift();
                var sq = squares.shift();
                var pl = { r: slot.r + 1, c: slot.c + 1, rs: 1, cs: 1, orient: 'square' };
                occMark(occ, slot.r, slot.c, 1, 1, gridCols);
                placedOut.push({ item: sq, placement: pl });
            }
        }
    }

    function packPromoSceneItems(items, gridCols) {
        gridCols = normGridCols(gridCols);
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
            fillBandOrphans(occ, squares, placed, gridCols);
            var pl = findEarliest(occ, item._promoOrient, gridCols);
            if (!pl) return;
            occMark(occ, pl.r - 1, pl.c - 1, pl.rs, pl.cs, gridCols);
            placed.push({ item: item, placement: pl });
        });
        fillBandOrphans(occ, squares, placed, gridCols);
        while (squares.length) {
            var pl2 = findEarliest(occ, 'square', gridCols);
            if (!pl2) break;
            occMark(occ, pl2.r - 1, pl2.c - 1, pl2.rs, pl2.cs, gridCols);
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
        isSingleCellPromoRatio: isSingleCellPromoRatio,
        orientOf: orientOf,
        packPromoSceneItems: packPromoSceneItems,
        applyPlacement: applyPlacement
    };
})(typeof window !== 'undefined' ? window : this);
