'use strict';

/** 材料組合：標題後下拉選常用、＋存、垃圾桶刪 */
window.MaterialPresetChips = (function () {
    function createInstance(options) {
        var opts = options || {};
        var kind = opts.kind === 'boundary' ? 'boundary' : 'material';
        var items = [];
        var activeInput = null;

        function ph() {
            if (typeof opts.getSelectPlaceholder === 'function') return opts.getSelectPlaceholder();
            return opts.selectPlaceholder || '';
        }

        function emptyLabel() {
            if (typeof opts.getEmptyManageLabel === 'function') return opts.getEmptyManageLabel();
            return opts.emptyManageLabel || '';
        }

        function removeTitle() {
            if (typeof opts.getRemoveTitle === 'function') return opts.getRemoveTitle();
            return opts.removeTitle || '';
        }

        function getTargets() {
            return (opts.renderTargets || []).filter(function (t) { return t && t.selectEl; });
        }

        function bindSelect(selectEl, inputEl) {
            if (!selectEl || selectEl._mdcPresetBound) return;
            selectEl._mdcPresetBound = true;
            selectEl.addEventListener('change', function () {
                var v = String(selectEl.value || '').trim();
                if (v) applyName(v, inputEl);
                selectEl.value = '';
            });
        }

        function renderIntoSelect(selectEl) {
            if (!selectEl) return;
            selectEl.innerHTML = '';
            var opt0 = document.createElement('option');
            opt0.value = '';
            opt0.textContent = ph();
            selectEl.appendChild(opt0);
            items.forEach(function (item) {
                var opt = document.createElement('option');
                opt.value = item.name;
                opt.textContent = item.name;
                selectEl.appendChild(opt);
            });
            selectEl.value = '';
        }

        function asElList(v) {
            if (!v) return [];
            return Array.isArray(v) ? v : [v];
        }

        function fillManageMenu(menu) {
            if (!menu) return;
            menu.innerHTML = '';
            if (!items.length) {
                var emptyLi = document.createElement('li');
                emptyLi.className = 'dropdown-item-text small text-muted px-2 py-1';
                emptyLi.textContent = emptyLabel();
                menu.appendChild(emptyLi);
                return;
            }
            items.forEach(function (item) {
                var li = document.createElement('li');
                var row = document.createElement('div');
                row.className = 'dropdown-item-text d-flex align-items-center justify-content-between gap-2 py-1 px-2 small';
                row.innerHTML = '<span class="text-truncate"></span>'
                    + '<button type="button" class="btn btn-link btn-sm p-0 text-danger flex-shrink-0"><i class="bi bi-x-lg"></i></button>';
                row.querySelector('span').textContent = item.name;
                var delBtn = row.querySelector('button');
                delBtn.title = removeTitle();
                delBtn.setAttribute('aria-label', removeTitle());
                delBtn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    removeItem(item.id);
                });
                li.appendChild(row);
                menu.appendChild(li);
            });
        }

        function renderManageMenu() {
            asElList(opts.manageWrapEl).forEach(function (wrap) {
                if (wrap) wrap.classList.remove('d-none');
            });
            asElList(opts.manageMenuEl).forEach(fillManageMenu);
        }

        function render() {
            getTargets().forEach(function (t) {
                bindSelect(t.selectEl, t.input);
                renderIntoSelect(t.selectEl);
            });
            renderManageMenu();
        }

        function applyName(name, explicitTarget) {
            var target = explicitTarget || activeInput;
            if (!target) return;
            target.value = name;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.focus();
        }

        async function load() {
            if (!opts.getHeaders) return;
            try {
                var headers = await opts.getHeaders();
                var res = await fetch('/api/me/material-presets?kind=' + encodeURIComponent(kind), {
                    headers: headers,
                    cache: 'no-store'
                });
                var d = await res.json().catch(function () { return {}; });
                if (!res.ok) {
                    items = [];
                    render();
                    return;
                }
                items = Array.isArray(d.items) ? d.items : [];
                render();
            } catch (_) {
                items = [];
                render();
            }
        }

        async function saveFromInput(inputEl) {
            if (!inputEl || !opts.getHeaders) return;
            var name = String(inputEl.value || '').trim();
            if (!name) return;
            try {
                var headers = await opts.getHeaders();
                headers['Content-Type'] = 'application/json';
                var res = await fetch('/api/me/material-presets', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ name: name, kind: kind })
                });
                var d = await res.json().catch(function () { return {}; });
                if (!res.ok) return;
                if (d.item) {
                    var exists = items.some(function (x) { return x.id === d.item.id; });
                    if (!exists) items.unshift(d.item);
                    else items = items.map(function (x) { return x.id === d.item.id ? d.item : x; });
                    render();
                } else {
                    await load();
                }
            } catch (_) { /* ignore */ }
        }

        async function removeItem(id) {
            if (!id || !opts.getHeaders) return;
            try {
                var headers = await opts.getHeaders();
                var res = await fetch('/api/me/material-presets/' + encodeURIComponent(id), {
                    method: 'DELETE',
                    headers: headers
                });
                if (!res.ok) return;
                items = items.filter(function (x) { return x.id !== id; });
                render();
            } catch (_) { /* ignore */ }
        }

        function bindInputs() {
            (opts.inputs || []).forEach(function (el) {
                if (!el) return;
                el.addEventListener('focus', function () { activeInput = el; });
            });
            (opts.fieldSaveBtns || []).forEach(function (pair) {
                if (!pair || !pair.btn || !pair.input) return;
                pair.btn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    saveFromInput(pair.input);
                });
            });
            getTargets().forEach(function (t) {
                bindSelect(t.selectEl, t.input);
            });
        }

        bindInputs();
        load();

        return { reload: load, reloadI18n: render };
    }

    return { init: createInstance };
})();
