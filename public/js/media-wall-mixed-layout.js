/**
 * 首頁媒體牆「全部」混合排版
 * 每組：有系列 → 左 1×2；右側 2 列（第 1 列全稿；第 2 列全稿，有對照時最後一格對照）
 * 無系列 → 不開左欄，設計稿用滿寬；無對照 → 不保留末格，設計稿補滿。
 */
(function (global) {
    'use strict';

    var MAX_SERIES = 12;

    function seriesCapForDesignCount(designCount) {
        return Math.min(48, Math.max(MAX_SERIES, Math.ceil((designCount || 0) / 11) + 2));
    }

    function isSeriesItem(p) {
        if (!p) return false;
        return p.type === 'collection' || p.type === 'series' || p.size === '1x2';
    }

    function partitionItems(items) {
        var series = [];
        var comparisons = [];
        var designs = [];
        (items || []).forEach(function (p) {
            if (isSeriesItem(p)) series.push(p);
            else if ((p.type || '') === 'comparison') comparisons.push(p);
            else if ((p.type || '') === 'user_design') designs.push(p);
        });
        return { series: series, comparisons: comparisons, designs: designs };
    }

    function pinCell(el, row, col) {
        if (!el) return;
        el.style.setProperty('grid-row', String(row), 'important');
        el.style.setProperty('grid-column', String(col), 'important');
    }

    function applyGroupMetrics(group, groupGrid, mainCols, colW, oneRow) {
        var gap = 8;
        var cell = colW > 0 ? colW : 260;
        if (group) {
            group.style.setProperty('--mw-cell', cell + 'px');
            group.style.setProperty('--mw-gap', gap + 'px');
            group.style.setProperty('--mw-cols', String(mainCols));
        }
        if (!groupGrid || mainCols < 1) return;
        groupGrid.classList.toggle('one-row', !!oneRow);
    }

    function tryRender(renderOne, item, opts) {
        try {
            return renderOne(item, opts) || null;
        } catch (err) {
            console.warn('media-wall render skip', item && item.id, err);
            return null;
        }
    }

    /** 取下一張可渲染系列；無則 null（不插 spacer） */
    function pullNextSeries(seriesList, state, renderOne, opts, listForLD) {
        while (state.iSeries < seriesList.length) {
            var sp = seriesList[state.iSeries++];
            var el = tryRender(renderOne, sp, opts);
            if (el) {
                listForLD.push(sp);
                return el;
            }
        }
        return null;
    }

    /** 取下一張可渲染對照；無則 null */
    function pullNextComparison(part, state, renderOne, opts, listForLD) {
        while (state.iComp < part.comparisons.length) {
            var cp = part.comparisons[state.iComp++];
            var el = tryRender(renderOne, cp, opts);
            if (el) {
                listForLD.push(cp);
                return el;
            }
        }
        return null;
    }

    /**
     * 填滿一行：渲染失敗不佔格
     * @returns {number} 本行已放置的欄數
     */
    function fillRow(grid, row, startCol, maxCol, part, state, renderOne, opts, listForLD) {
        var col = startCol;
        while (col <= maxCol && state.iDesign < part.designs.length) {
            var design = part.designs[state.iDesign++];
            var el = tryRender(renderOne, design, opts);
            if (!el) continue;
            pinCell(el, row, col);
            grid.appendChild(el);
            listForLD.push(design);
            col++;
        }
        return col - startCol;
    }

    function renderMixedLayout(options) {
        options = options || {};
        var part = partitionItems(options.items);
        var sortFn = options.sortByCreatedDesc || function () { return 0; };

        part.series = part.series.slice(0, seriesCapForDesignCount(part.designs.length)).sort(sortFn);
        part.comparisons.sort(sortFn);
        part.designs.sort(sortFn);

        var poolHasSeries = part.series.length > 0;
        var state = { iSeries: 0, iComp: 0, iDesign: 0 };
        var listForLD = [];
        var frag = document.createDocumentFragment();

        while (state.iDesign < part.designs.length) {
            var seriesEl = poolHasSeries ? pullNextSeries(part.series, state, options.renderOne, options.opts, listForLD) : null;
            var groupHasSeries = !!seriesEl;

            var metrics = options.getCellMetrics(groupHasSeries);
            var mainCols = metrics.colCount || 3;
            var colW = metrics.colW;

            var group = document.createElement('div');
            group.className = 'media-wall-group' + (groupHasSeries ? '' : ' no-series');

            if (groupHasSeries) {
                var seriesCell = document.createElement('div');
                seriesCell.className = 'media-wall-group-series';
                seriesCell.appendChild(seriesEl);
                group.appendChild(seriesCell);
            }

            var groupGrid = document.createElement('div');
            groupGrid.className = 'media-wall-group-grid';

            var row1Count = fillRow(groupGrid, 1, 1, mainCols, part, state, options.renderOne, options.opts, listForLD);
            var row1Full = row1Count >= mainCols;
            var oneRow = false;

            if (!row1Full) {
                oneRow = true;
                var tailComp = pullNextComparison(part, state, options.renderOne, options.opts, listForLD);
                if (tailComp) {
                    pinCell(tailComp, 1, mainCols);
                    groupGrid.appendChild(tailComp);
                }
            } else {
                var compPending = state.iComp < part.comparisons.length;
                var row2Max = compPending ? mainCols - 1 : mainCols;
                var row2Count = 0;
                if (state.iDesign < part.designs.length || compPending) {
                    oneRow = false;
                    row2Count = fillRow(groupGrid, 2, 1, row2Max, part, state, options.renderOne, options.opts, listForLD);
                    if (compPending) {
                        var rowComp = pullNextComparison(part, state, options.renderOne, options.opts, listForLD);
                        if (rowComp) {
                            pinCell(rowComp, 2, mainCols);
                            groupGrid.appendChild(rowComp);
                        } else {
                            fillRow(groupGrid, 2, mainCols, mainCols, part, state, options.renderOne, options.opts, listForLD);
                        }
                    }
                } else {
                    oneRow = true;
                }
                if (!oneRow && row2Count === 0 && groupGrid.querySelectorAll('.media-wall-comparison').length === 0 && state.iDesign >= part.designs.length) {
                    oneRow = true;
                }
            }

            applyGroupMetrics(group, groupGrid, mainCols, colW, oneRow);

            if (groupGrid.childNodes.length) {
                group.appendChild(groupGrid);
                frag.appendChild(group);
            }
        }

        return { fragment: frag, listForLD: listForLD, useSeries: poolHasSeries };
    }

    global.MatchdoMediaWallMixedLayout = {
        renderMixedLayout: renderMixedLayout,
        partitionItems: partitionItems
    };
})(typeof window !== 'undefined' ? window : global);
