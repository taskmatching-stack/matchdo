/**
 * 材料組合「配色範例」：官方｜我的 × 雙色｜三色 × 類型 Tab × 表格一鍵套用
 * 「我的」同一類型＋同色數內可拖曳把手調整 sort_order。
 * 套用＝填表單（色數／HEX／比重），不自動存、不自動生圖。
 */
(function (global) {
    'use strict';

    function pt(key, fb, map) {
        var s = (global.i18n && global.i18n.t) ? global.i18n.t(key) : key;
        if (!s || s === key) s = fb || key;
        if (map) Object.keys(map).forEach(function (k) {
            s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(map[k]));
        });
        return s;
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normHex(v) {
        var s = String(v || '').trim().toUpperCase();
        if (/^#[0-9A-F]{6}$/.test(s)) return s;
        if (/^[0-9A-F]{6}$/.test(s)) return '#' + s;
        return null;
    }

    function swatchHtml(hex) {
        var h = esc(hex || '#CCCCCC');
        return '<span class="mdc-pal-swatch" style="background:' + h + '" title="' + h + '"></span><code class="small">' + h + '</code>';
    }

    function ratioLabel(it) {
        var percents = Array.isArray(it.ratio_percents) ? it.ratio_percents : null;
        if (percents && percents.length) return percents.join('/');
        if (it.ratio_preset === 'dual_50_50') return '50/50';
        if (it.color_count === 3) return pt('materialCombo.colorCount3', '三色');
        return '75/25';
    }

    function mineTypeKey(it) {
        var label = (it && it.type_text && String(it.type_text).trim()) || '';
        return label ? ('t:' + label) : '__none__';
    }

    function itemColorCount(it) {
        return (it && it.color_count === 3) ? 3 : 2;
    }

    function createPicker(opts) {
        var getHeaders = opts.getHeaders;
        var applyPalette = opts.applyPalette || null;
        var applyHex = opts.applyHex || null;
        var getCurrentPalette = opts.getCurrentPalette || opts.getCurrentHex;
        var getFormColorCount = opts.getColorCount || null;
        var onStatus = opts.onStatus || function () {};
        var modalEl = document.getElementById('mdcPaletteModal');
        if (!modalEl) return null;

        var modal = null;
        try {
            modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        } catch (e) {
            modal = null;
        }

        var state = {
            scope: 'platform', // platform | mine
            colorCount: 2, // 2 | 3 — 雙色／三色分開瀏覽
            platformTypes: [],
            platformItems: [],
            mineItems: [],
            activeTypeKey: null,
            loadedPlatform: false,
            loadedMine: false
        };

        var dragId = null;
        var sortSaving = false;

        var scopeTabs = document.getElementById('mdcPalScopeTabs');
        var countTabs = document.getElementById('mdcPalColorCountTabs');
        var typeTabs = document.getElementById('mdcPalTypeTabs');
        var tableBody = document.getElementById('mdcPalTableBody');
        var emptyEl = document.getElementById('mdcPalEmpty');
        var mineToolbar = document.getElementById('mdcPalMineToolbar');
        var theadRow = modalEl.querySelector('thead tr');

        function applyItem(it) {
            if (!it) return;
            var payload = {
                primary_hex: it.primary_hex,
                accent_hex: it.accent_hex,
                tertiary_hex: it.tertiary_hex || null,
                color_count: itemColorCount(it),
                ratio_percents: Array.isArray(it.ratio_percents) ? it.ratio_percents.slice() : null,
                ratio_preset: it.ratio_preset || null
            };
            if (it.id) {
                payload.source_palette = {
                    id: it.id,
                    scope: state.scope === 'mine' ? 'user' : 'platform',
                    type_name: it.type_name || it.type_text || null,
                    name: it.name || null
                };
            }
            if (typeof applyPalette === 'function') {
                applyPalette(payload);
                return;
            }
            if (typeof applyHex === 'function') {
                applyHex(payload.primary_hex, payload.accent_hex);
            }
        }

        function syncCountTabsUi() {
            if (!countTabs) return;
            countTabs.querySelectorAll('[data-pal-count]').forEach(function (btn) {
                var n = parseInt(btn.getAttribute('data-pal-count'), 10) === 3 ? 3 : 2;
                btn.classList.toggle('active', n === state.colorCount);
            });
        }

        function setColorCount(count) {
            state.colorCount = count === 3 ? 3 : 2;
            syncCountTabsUi();
            state.activeTypeKey = null;
            renderTypeTabs();
            renderTable();
        }

        function setScope(scope) {
            state.scope = scope === 'mine' ? 'mine' : 'platform';
            if (scopeTabs) {
                scopeTabs.querySelectorAll('[data-pal-scope]').forEach(function (btn) {
                    btn.classList.toggle('active', btn.getAttribute('data-pal-scope') === state.scope);
                });
            }
            if (mineToolbar) {
                if (state.scope === 'mine') mineToolbar.classList.remove('d-none');
                else mineToolbar.classList.add('d-none');
            }
            state.activeTypeKey = null;
            renderTypeTabs();
            renderTable();
        }

        function itemsMatchingColorCount(list) {
            return (list || []).filter(function (it) {
                return itemColorCount(it) === state.colorCount;
            });
        }

        function typeKeysForScope() {
            if (state.scope === 'platform') {
                var used = {};
                itemsMatchingColorCount(state.platformItems).forEach(function (it) {
                    if (it.type_id) used[it.type_id] = true;
                });
                return state.platformTypes
                    .filter(function (t) { return used[t.id]; })
                    .map(function (t) {
                        return { key: t.id, label: t.name };
                    });
            }
            var map = {};
            var order = [];
            itemsMatchingColorCount(state.mineItems).forEach(function (it) {
                var key = mineTypeKey(it);
                var label = (it.type_text && String(it.type_text).trim()) || '';
                if (!map[key]) {
                    map[key] = true;
                    order.push({ key: key, label: label || pt('materialCombo.pal.uncategorized', '未分類') });
                }
            });
            order.sort(function (a, b) {
                if (a.key === '__none__') return 1;
                if (b.key === '__none__') return -1;
                return a.label.localeCompare(b.label, 'zh-Hant');
            });
            return order;
        }

        function itemsForActiveType() {
            var key = state.activeTypeKey;
            var rows;
            if (state.scope === 'platform') {
                rows = itemsMatchingColorCount(state.platformItems).filter(function (it) {
                    return String(it.type_id || '') === String(key || '');
                });
            } else {
                rows = itemsMatchingColorCount(state.mineItems).filter(function (it) {
                    return mineTypeKey(it) === key;
                });
            }
            rows.sort(function (a, b) {
                var sa = a.sort_order != null ? a.sort_order : 0;
                var sb = b.sort_order != null ? b.sort_order : 0;
                if (sa !== sb) return sa - sb;
                return String(a.created_at || '').localeCompare(String(b.created_at || ''));
            });
            return rows;
        }

        function nextMineSortForTypeText(typeText, colorCount) {
            var label = String(typeText || '').trim();
            var key = label ? ('t:' + label) : '__none__';
            var count = colorCount === 3 ? 3 : 2;
            var max = 0;
            state.mineItems.forEach(function (it) {
                if (mineTypeKey(it) !== key) return;
                if (itemColorCount(it) !== count) return;
                var n = parseInt(it.sort_order, 10);
                if (Number.isFinite(n) && n > max) max = n;
            });
            return max + 10;
        }

        function renderTypeTabs() {
            if (!typeTabs) return;
            var keys = typeKeysForScope();
            if (!keys.length) {
                typeTabs.innerHTML = '';
                state.activeTypeKey = null;
                return;
            }
            if (!state.activeTypeKey || !keys.some(function (k) { return k.key === state.activeTypeKey; })) {
                state.activeTypeKey = keys[0].key;
            }
            typeTabs.innerHTML = keys.map(function (k) {
                var active = k.key === state.activeTypeKey ? ' active' : '';
                return '<li class="nav-item" role="presentation">' +
                    '<button type="button" class="nav-link' + active + '" data-pal-type="' + esc(k.key) + '">' + esc(k.label) + '</button>' +
                    '</li>';
            }).join('');
        }

        function renderTable() {
            if (!tableBody) return;
            var rows = itemsForActiveType();
            var showMineActions = state.scope === 'mine';
            var showTertiary = state.colorCount === 3;
            var countLabel = state.colorCount === 3
                ? pt('materialCombo.colorCount3', '三色')
                : pt('materialCombo.colorCount2', '雙色');
            if (theadRow) {
                theadRow.innerHTML = (showMineActions ? '<th style="width:2rem" title="' + esc(pt('materialCombo.pal.dragColTitle', '拖曳排序')) + '"></th>' : '') +
                    '<th>' + esc(pt('materialCombo.pal.colName', '名稱')) + '</th>' +
                    '<th>' + esc(pt('materialCombo.pal.colNote', '備註')) + '</th>' +
                    '<th>' + esc(pt('materialCombo.pal.colMain', '主色')) + '</th>' +
                    '<th>' + esc(pt('materialCombo.pal.colAccent', '配色')) + '</th>' +
                    (showTertiary ? ('<th>' + esc(pt('materialCombo.pal.colThird', '輔色（三色）')) + '</th>') : '') +
                    '<th>' + esc(pt('materialCombo.pal.colRatio', '比重')) + '</th>' +
                    '<th style="width:9rem">' + esc(pt('materialCombo.pal.colActions', '操作')) + '</th>';
            }
            if (!rows.length) {
                tableBody.innerHTML = '';
                if (emptyEl) {
                    emptyEl.classList.remove('d-none');
                    if (!typeKeysForScope().length) {
                        emptyEl.textContent = state.scope === 'mine'
                            ? pt('materialCombo.pal.emptyMine', '尚無我的{colorCount}配色。可將目前選色存成我的。', { colorCount: countLabel })
                            : pt('materialCombo.pal.emptyPlatform', '尚無官方{colorCount}配色。', { colorCount: countLabel });
                    } else {
                        emptyEl.textContent = state.scope === 'mine'
                            ? pt('materialCombo.pal.emptyTypeMine', '此類型尚無我的{colorCount}配色。', { colorCount: countLabel })
                            : pt('materialCombo.pal.emptyTypePlatform', '此類型尚無官方{colorCount}配色。', { colorCount: countLabel });
                    }
                }
                return;
            }
            if (emptyEl) emptyEl.classList.add('d-none');
            tableBody.innerHTML = rows.map(function (it) {
                var actions = '<button type="button" class="btn btn-sm btn-primary btn-pal-apply" data-id="' + esc(it.id) + '">' + esc(pt('materialCombo.pal.apply', '套用')) + '</button>';
                if (showMineActions) {
                    actions += ' <button type="button" class="btn btn-sm btn-outline-secondary btn-pal-edit" data-id="' + esc(it.id) + '">' + esc(pt('materialCombo.pal.edit', '編輯')) + '</button>' +
                        ' <button type="button" class="btn btn-sm btn-outline-danger btn-pal-del" data-id="' + esc(it.id) + '">' + esc(pt('materialCombo.pal.del', '刪')) + '</button>';
                }
                var tertiaryCell = showTertiary
                    ? ('<td>' + (it.tertiary_hex ? swatchHtml(it.tertiary_hex) : '<span class="text-muted small">—</span>') + '</td>')
                    : '';
                var note = (it.note && String(it.note).trim()) || '';
                var dragCell = showMineActions
                    ? ('<td class="text-center align-middle">' +
                        '<span class="mdc-pal-drag-handle" draggable="true" data-pal-id="' + esc(it.id) + '" title="' + esc(pt('materialCombo.pal.dragTitle', '拖曳調整類型內排序')) + '" aria-label="' + esc(pt('materialCombo.pal.dragAria', '拖曳排序')) + '">⠿</span>' +
                        '</td>')
                    : '';
                return '<tr data-pal-id="' + esc(it.id) + '">' +
                    dragCell +
                    '<td>' + esc(it.name || '') + '</td>' +
                    '<td class="small text-muted" style="max-width:10rem">' + (note ? esc(note) : '—') + '</td>' +
                    '<td>' + swatchHtml(it.primary_hex) + '</td>' +
                    '<td>' + swatchHtml(it.accent_hex) + '</td>' +
                    tertiaryCell +
                    '<td class="small text-nowrap">' + esc(ratioLabel(it)) + '</td>' +
                    '<td class="text-nowrap">' + actions + '</td>' +
                    '</tr>';
            }).join('');
        }

        async function persistMineOrder(orderedIds) {
            if (sortSaving || !orderedIds.length) return;
            sortSaving = true;
            try {
                var headers = await getHeaders();
                headers['Content-Type'] = 'application/json';
                for (var i = 0; i < orderedIds.length; i++) {
                    var id = orderedIds[i];
                    var sortOrder = (i + 1) * 10;
                    var item = state.mineItems.find(function (x) { return String(x.id) === String(id); });
                    if (item && item.sort_order === sortOrder) continue;
                    var r = await fetch('/api/me/material-color-palettes/' + encodeURIComponent(id), {
                        method: 'PATCH',
                        headers: headers,
                        body: JSON.stringify({ sort_order: sortOrder })
                    });
                    var j = await r.json().catch(function () { return {}; });
                    if (!r.ok) throw new Error(j.error || pt('materialCombo.pal.sortFail', '排序儲存失敗'));
                    if (item) item.sort_order = sortOrder;
                }
                onStatus(pt('materialCombo.pal.sortSaved', '已更新類型內排序'), true);
            } catch (err) {
                onStatus(err.message || pt('materialCombo.pal.sortFail', '排序儲存失敗'), false);
                await loadMine(true);
                renderTypeTabs();
                renderTable();
            } finally {
                sortSaving = false;
            }
        }

        function reorderMineDom(fromId, toId) {
            if (!fromId || !toId || fromId === toId) return;
            var rows = itemsForActiveType();
            var ids = rows.map(function (r) { return String(r.id); });
            var fromIdx = ids.indexOf(String(fromId));
            var toIdx = ids.indexOf(String(toId));
            if (fromIdx < 0 || toIdx < 0) return;
            ids.splice(fromIdx, 1);
            ids.splice(toIdx, 0, String(fromId));
            ids.forEach(function (id, i) {
                var it = state.mineItems.find(function (x) { return String(x.id) === String(id); });
                if (it) it.sort_order = (i + 1) * 10;
            });
            renderTable();
            persistMineOrder(ids);
        }

        async function loadPlatform(force) {
            if (state.loadedPlatform && !force) return;
            var lang = (global.i18n && typeof global.i18n.getLang === 'function')
                ? global.i18n.getLang()
                : 'zh-TW';
            var q = lang ? ('?lang=' + encodeURIComponent(String(lang).trim())) : '';
            var r = await fetch('/api/material-color-palettes/platform' + q, { headers: await getHeaders() });
            var j = await r.json().catch(function () { return {}; });
            if (!r.ok) {
                onStatus(j.error || pt('materialCombo.pal.loadPlatformFail', '載入官方配色失敗'), false);
                state.platformTypes = [];
                state.platformItems = [];
            } else {
                state.platformTypes = j.types || [];
                state.platformItems = j.items || [];
                state.loadedPlatform = true;
            }
        }

        async function loadMine(force) {
            if (state.loadedMine && !force) return;
            var r = await fetch('/api/me/material-color-palettes', { headers: await getHeaders() });
            var j = await r.json().catch(function () { return {}; });
            if (!r.ok) {
                onStatus(j.error || pt('materialCombo.pal.loadMineFail', '載入我的配色失敗'), false);
                state.mineItems = [];
            } else {
                state.mineItems = j.items || [];
                state.loadedMine = true;
            }
        }

        async function open() {
            if (typeof getFormColorCount === 'function') {
                state.colorCount = getFormColorCount() === 3 ? 3 : 2;
            }
            syncCountTabsUi();
            await loadPlatform(true);
            await loadMine(true);
            setScope(state.scope);
            if (modal) modal.show();
        }

        function findItem(id) {
            var list = state.scope === 'mine' ? state.mineItems : state.platformItems;
            return list.find(function (x) { return String(x.id) === String(id); });
        }

        if (scopeTabs) {
            scopeTabs.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-pal-scope]');
                if (!btn) return;
                setScope(btn.getAttribute('data-pal-scope'));
            });
        }
        if (countTabs) {
            countTabs.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-pal-count]');
                if (!btn) return;
                setColorCount(parseInt(btn.getAttribute('data-pal-count'), 10));
            });
        }
        if (typeTabs) {
            typeTabs.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-pal-type]');
                if (!btn) return;
                state.activeTypeKey = btn.getAttribute('data-pal-type');
                renderTypeTabs();
                renderTable();
            });
        }
        if (tableBody) {
            tableBody.addEventListener('dragstart', function (e) {
                if (state.scope !== 'mine' || sortSaving) return;
                var handle = e.target.closest('.mdc-pal-drag-handle');
                if (!handle) {
                    e.preventDefault();
                    return;
                }
                dragId = handle.getAttribute('data-pal-id');
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', dragId || ''); } catch (_) {}
                var tr = handle.closest('tr');
                if (tr) tr.classList.add('mdc-pal-dragging');
            });
            tableBody.addEventListener('dragend', function () {
                dragId = null;
                tableBody.querySelectorAll('tr.mdc-pal-dragging, tr.mdc-pal-drag-over').forEach(function (tr) {
                    tr.classList.remove('mdc-pal-dragging', 'mdc-pal-drag-over');
                });
            });
            tableBody.addEventListener('dragover', function (e) {
                if (state.scope !== 'mine' || !dragId) return;
                var tr = e.target.closest('tr[data-pal-id]');
                if (!tr) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                tableBody.querySelectorAll('tr.mdc-pal-drag-over').forEach(function (el) {
                    if (el !== tr) el.classList.remove('mdc-pal-drag-over');
                });
                tr.classList.add('mdc-pal-drag-over');
            });
            tableBody.addEventListener('dragleave', function (e) {
                var tr = e.target.closest('tr[data-pal-id]');
                if (tr && !tr.contains(e.relatedTarget)) tr.classList.remove('mdc-pal-drag-over');
            });
            tableBody.addEventListener('drop', function (e) {
                if (state.scope !== 'mine') return;
                var tr = e.target.closest('tr[data-pal-id]');
                if (!tr) return;
                e.preventDefault();
                var toId = tr.getAttribute('data-pal-id');
                var fromId = dragId || (function () {
                    try { return e.dataTransfer.getData('text/plain'); } catch (_) { return ''; }
                })();
                tr.classList.remove('mdc-pal-drag-over');
                reorderMineDom(fromId, toId);
                dragId = null;
            });

            tableBody.addEventListener('click', async function (e) {
                var applyBtn = e.target.closest('.btn-pal-apply');
                var editBtn = e.target.closest('.btn-pal-edit');
                var delBtn = e.target.closest('.btn-pal-del');
                if (applyBtn) {
                    var it = findItem(applyBtn.getAttribute('data-id'));
                    if (!it) return;
                    applyItem(it);
                    onStatus(pt('materialCombo.pal.applied', '已套用「{name}」', { name: it.name || '' }), true);
                    if (modal) modal.hide();
                    return;
                }
                if (delBtn) {
                    if (!confirm(pt('materialCombo.pal.confirmDelete', '確定刪除此配色？'))) return;
                    var id = delBtn.getAttribute('data-id');
                    var headers = await getHeaders();
                    headers['Content-Type'] = 'application/json';
                    var r = await fetch('/api/me/material-color-palettes/' + encodeURIComponent(id), {
                        method: 'DELETE',
                        headers: headers
                    });
                    var j = await r.json().catch(function () { return {}; });
                    if (!r.ok) return onStatus(j.error || pt('materialCombo.pal.deleteFail', '刪除失敗'), false);
                    onStatus(pt('materialCombo.pal.deleted', '已刪除'), true);
                    await loadMine(true);
                    renderTypeTabs();
                    renderTable();
                    return;
                }
                if (editBtn) {
                    var item = findItem(editBtn.getAttribute('data-id'));
                    if (!item) return;
                    var name = prompt(pt('materialCombo.pal.promptName', '名稱'), item.name || '');
                    if (name == null) return;
                    name = String(name).trim();
                    if (!name) return onStatus(pt('materialCombo.pal.nameRequired', '名稱不可空白'), false);
                    var typeText = prompt(pt('materialCombo.pal.promptType', '類型（可留空）'), item.type_text || '');
                    if (typeText == null) return;
                    var noteText = prompt(pt('materialCombo.pal.promptNote', '備註描述（可留空）'), item.note || '');
                    if (noteText == null) return;
                    var headers2 = await getHeaders();
                    headers2['Content-Type'] = 'application/json';
                    var r2 = await fetch('/api/me/material-color-palettes/' + encodeURIComponent(item.id), {
                        method: 'PATCH',
                        headers: headers2,
                        body: JSON.stringify({
                            name: name,
                            type_text: String(typeText).trim() || null,
                            note: String(noteText).trim() || null,
                            primary_hex: item.primary_hex,
                            accent_hex: item.accent_hex,
                            tertiary_hex: item.tertiary_hex || null,
                            color_count: itemColorCount(item),
                            ratio_percents: item.ratio_percents || null,
                            ratio_preset: item.ratio_preset || null,
                            sort_order: item.sort_order
                        })
                    });
                    var j2 = await r2.json().catch(function () { return {}; });
                    if (!r2.ok) return onStatus(j2.error || pt('materialCombo.pal.updateFail', '更新失敗'), false);
                    onStatus(pt('materialCombo.pal.updated', '已更新'), true);
                    await loadMine(true);
                    renderTypeTabs();
                    renderTable();
                }
            });
        }

        var saveBtn = document.getElementById('mdcPalSaveCurrent');
        if (saveBtn) {
            saveBtn.addEventListener('click', async function () {
                var cur = getCurrentPalette ? getCurrentPalette() : null;
                if (!cur || !normHex(cur.primary || cur.primary_hex) || !normHex(cur.accent || cur.accent_hex)) {
                    return onStatus(pt('materialCombo.pal.needValidColors', '請先設定有效的主色／配色'), false);
                }
                var primary = normHex(cur.primary || cur.primary_hex);
                var accent = normHex(cur.accent || cur.accent_hex);
                var colorCount = cur.color_count === 3 ? 3 : 2;
                var tertiary = colorCount === 3 ? normHex(cur.tertiary || cur.tertiary_hex) : null;
                if (colorCount === 3 && !tertiary) {
                    return onStatus(pt('materialCombo.pal.needThirdColor', '三色模式請先設定輔色'), false);
                }
                var ratioPercents = Array.isArray(cur.ratio_percents) ? cur.ratio_percents : null;
                var defaultName = colorCount === 3
                    ? (primary + ' / ' + accent + ' / ' + tertiary)
                    : (primary + ' / ' + accent);
                var name = prompt(pt('materialCombo.pal.promptNameDefault', '為此配色命名'), defaultName);
                if (name == null) return;
                name = String(name).trim();
                if (!name) return onStatus(pt('materialCombo.pal.nameRequired', '名稱不可空白'), false);
                var typeText = prompt(pt('materialCombo.pal.promptType', '類型（可留空）'), '');
                if (typeText == null) return;
                var noteEl = document.getElementById('mdcPalSaveNote');
                var noteFromBar = noteEl ? String(noteEl.value || '').trim() : '';
                var typeTrim = String(typeText).trim() || null;
                var headers = await getHeaders();
                headers['Content-Type'] = 'application/json';
                var payload = {
                    name: name,
                    type_text: typeTrim,
                    note: noteFromBar || null,
                    primary_hex: primary,
                    accent_hex: accent,
                    color_count: colorCount,
                    ratio_preset: cur.ratio_preset || null,
                    ratio_percents: ratioPercents,
                    sort_order: nextMineSortForTypeText(typeTrim, colorCount)
                };
                if (colorCount === 3) payload.tertiary_hex = tertiary;
                else payload.tertiary_hex = null;
                var r = await fetch('/api/me/material-color-palettes', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(payload)
                });
                var j = await r.json().catch(function () { return {}; });
                if (!r.ok) return onStatus(j.error || pt('materialCombo.pal.saveFail', '儲存失敗'), false);
                onStatus(pt('materialCombo.pal.savedMine', '已存成我的配色'), true);
                if (noteEl) noteEl.value = '';
                state.scope = 'mine';
                state.colorCount = colorCount;
                await loadMine(true);
                setScope('mine');
                if (typeTrim) state.activeTypeKey = 't:' + typeTrim;
                else state.activeTypeKey = '__none__';
                renderTypeTabs();
                renderTable();
            });
        }

        return { open: open };
    }

    global.MatchdoMaterialColorPalettePicker = { create: createPicker, normalizeHex: normHex };
})(typeof window !== 'undefined' ? window : globalThis);
