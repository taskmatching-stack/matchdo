/**
 * 材料組合「配色範例」：官方｜我的 × 類型 Tab × 表格一鍵套用
 * 依賴頁面提供 applyHex(primary, accent) 與 auth headers。
 */
(function (global) {
    'use strict';

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

    function createPicker(opts) {
        var getHeaders = opts.getHeaders;
        var applyHex = opts.applyHex;
        var getCurrentHex = opts.getCurrentHex;
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
            platformTypes: [],
            platformItems: [],
            mineItems: [],
            activeTypeKey: null,
            loadedPlatform: false,
            loadedMine: false
        };

        var scopeTabs = document.getElementById('mdcPalScopeTabs');
        var typeTabs = document.getElementById('mdcPalTypeTabs');
        var tableBody = document.getElementById('mdcPalTableBody');
        var emptyEl = document.getElementById('mdcPalEmpty');
        var mineToolbar = document.getElementById('mdcPalMineToolbar');

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

        function typeKeysForScope() {
            if (state.scope === 'platform') {
                var used = {};
                state.platformItems.forEach(function (it) {
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
            state.mineItems.forEach(function (it) {
                var label = (it.type_text && String(it.type_text).trim()) || '';
                var key = label ? ('t:' + label) : '__none__';
                if (!map[key]) {
                    map[key] = true;
                    order.push({ key: key, label: label || '未分類' });
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
            if (state.scope === 'platform') {
                return state.platformItems.filter(function (it) {
                    return String(it.type_id || '') === String(key || '');
                });
            }
            return state.mineItems.filter(function (it) {
                var label = (it.type_text && String(it.type_text).trim()) || '';
                var k = label ? ('t:' + label) : '__none__';
                return k === key;
            });
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
            if (!rows.length) {
                tableBody.innerHTML = '';
                if (emptyEl) {
                    emptyEl.classList.remove('d-none');
                    emptyEl.textContent = state.scope === 'mine'
                        ? '此類型尚無我的配色。可將目前選色存成我的。'
                        : '此類型尚無官方配色。';
                }
                return;
            }
            if (emptyEl) emptyEl.classList.add('d-none');
            var showMineActions = state.scope === 'mine';
            tableBody.innerHTML = rows.map(function (it) {
                var actions = '<button type="button" class="btn btn-sm btn-primary btn-pal-apply" data-id="' + esc(it.id) + '">套用</button>';
                if (showMineActions) {
                    actions += ' <button type="button" class="btn btn-sm btn-outline-secondary btn-pal-edit" data-id="' + esc(it.id) + '">編輯</button>' +
                        ' <button type="button" class="btn btn-sm btn-outline-danger btn-pal-del" data-id="' + esc(it.id) + '">刪</button>';
                }
                return '<tr>' +
                    '<td>' + esc(it.name || '') + '</td>' +
                    '<td>' + swatchHtml(it.primary_hex) + '</td>' +
                    '<td>' + swatchHtml(it.accent_hex) + '</td>' +
                    '<td class="text-nowrap">' + actions + '</td>' +
                    '</tr>';
            }).join('');
        }

        async function loadPlatform(force) {
            if (state.loadedPlatform && !force) return;
            var r = await fetch('/api/material-color-palettes/platform', { headers: await getHeaders() });
            var j = await r.json().catch(function () { return {}; });
            if (!r.ok) {
                onStatus(j.error || '載入官方配色失敗', false);
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
                onStatus(j.error || '載入我的配色失敗', false);
                state.mineItems = [];
            } else {
                state.mineItems = j.items || [];
                state.loadedMine = true;
            }
        }

        async function open() {
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
            tableBody.addEventListener('click', async function (e) {
                var applyBtn = e.target.closest('.btn-pal-apply');
                var editBtn = e.target.closest('.btn-pal-edit');
                var delBtn = e.target.closest('.btn-pal-del');
                if (applyBtn) {
                    var it = findItem(applyBtn.getAttribute('data-id'));
                    if (!it) return;
                    applyHex(it.primary_hex, it.accent_hex);
                    onStatus('已套用「' + (it.name || '') + '」', true);
                    if (modal) modal.hide();
                    return;
                }
                if (delBtn) {
                    if (!confirm('確定刪除此配色？')) return;
                    var id = delBtn.getAttribute('data-id');
                    var headers = await getHeaders();
                    headers['Content-Type'] = 'application/json';
                    var r = await fetch('/api/me/material-color-palettes/' + encodeURIComponent(id), {
                        method: 'DELETE',
                        headers: headers
                    });
                    var j = await r.json().catch(function () { return {}; });
                    if (!r.ok) return onStatus(j.error || '刪除失敗', false);
                    onStatus('已刪除', true);
                    await loadMine(true);
                    renderTypeTabs();
                    renderTable();
                    return;
                }
                if (editBtn) {
                    var item = findItem(editBtn.getAttribute('data-id'));
                    if (!item) return;
                    var name = prompt('名稱', item.name || '');
                    if (name == null) return;
                    name = String(name).trim();
                    if (!name) return onStatus('名稱不可空白', false);
                    var typeText = prompt('類型（可留空）', item.type_text || '');
                    if (typeText == null) return;
                    var headers2 = await getHeaders();
                    headers2['Content-Type'] = 'application/json';
                    var r2 = await fetch('/api/me/material-color-palettes/' + encodeURIComponent(item.id), {
                        method: 'PATCH',
                        headers: headers2,
                        body: JSON.stringify({
                            name: name,
                            type_text: String(typeText).trim() || null,
                            primary_hex: item.primary_hex,
                            accent_hex: item.accent_hex
                        })
                    });
                    var j2 = await r2.json().catch(function () { return {}; });
                    if (!r2.ok) return onStatus(j2.error || '更新失敗', false);
                    onStatus('已更新', true);
                    await loadMine(true);
                    renderTypeTabs();
                    renderTable();
                }
            });
        }

        var saveBtn = document.getElementById('mdcPalSaveCurrent');
        if (saveBtn) {
            saveBtn.addEventListener('click', async function () {
                var cur = getCurrentHex ? getCurrentHex() : null;
                if (!cur || !normHex(cur.primary) || !normHex(cur.accent)) {
                    return onStatus('請先設定有效的主色／配色', false);
                }
                var name = prompt('為此配色命名', (cur.primary + ' / ' + cur.accent));
                if (name == null) return;
                name = String(name).trim();
                if (!name) return onStatus('名稱不可空白', false);
                var typeText = prompt('類型（可留空）', '');
                if (typeText == null) return;
                var headers = await getHeaders();
                headers['Content-Type'] = 'application/json';
                var r = await fetch('/api/me/material-color-palettes', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        name: name,
                        type_text: String(typeText).trim() || null,
                        primary_hex: normHex(cur.primary),
                        accent_hex: normHex(cur.accent)
                    })
                });
                var j = await r.json().catch(function () { return {}; });
                if (!r.ok) return onStatus(j.error || '儲存失敗', false);
                onStatus('已存成我的配色', true);
                state.scope = 'mine';
                await loadMine(true);
                setScope('mine');
            });
        }

        return { open: open };
    }

    global.MatchdoMaterialColorPalettePicker = { create: createPicker, normalizeHex: normHex };
})(typeof window !== 'undefined' ? window : globalThis);
