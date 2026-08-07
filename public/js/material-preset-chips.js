'use strict';

/** 材料組合：帳號常用文字 chips（材質／分界處；點選填入、可刪） */
window.MaterialPresetChips = (function () {
    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function createInstance(options) {
        var opts = options || {};
        var kind = opts.kind === 'boundary' ? 'boundary' : 'material';
        var items = [];
        var activeInput = null;

        function setWrapVisible(show) {
            if (!opts.wrapEl) return;
            opts.wrapEl.classList.toggle('d-none', !show);
        }

        function render() {
            if (!opts.chipsEl) return;
            opts.chipsEl.innerHTML = '';
            if (!items.length) {
                setWrapVisible(false);
                return;
            }
            setWrapVisible(true);
            items.forEach(function (item) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-sm btn-outline-secondary mdc-mat-preset-chip';
                btn.title = opts.fillTitle || '填入欄位';
                btn.innerHTML = escapeHtml(item.name)
                    + ' <span class="mdc-mat-preset-del" data-id="' + escapeHtml(item.id) + '" title="' + escapeHtml(opts.removeTitle || '移除') + '" aria-label="' + escapeHtml(opts.removeTitle || '移除') + '">×</span>';
                btn.addEventListener('click', function (ev) {
                    if (ev.target && ev.target.classList && ev.target.classList.contains('mdc-mat-preset-del')) return;
                    applyName(item.name);
                });
                var del = btn.querySelector('.mdc-mat-preset-del');
                if (del) {
                    del.addEventListener('click', function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        removeItem(item.id);
                    });
                }
                opts.chipsEl.appendChild(btn);
            });
        }

        function applyName(name) {
            var target = activeInput;
            if (!target && opts.inputs && opts.inputs.length) {
                for (var i = 0; i < opts.inputs.length; i++) {
                    if (opts.inputs[i]) { target = opts.inputs[i]; break; }
                }
            }
            if (!target) {
                flashHint(opts.hintFocus || '請先點一下要填入的欄位');
                return;
            }
            target.value = name;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.focus();
        }

        function flashHint(msg) {
            if (!opts.hintEl) return;
            opts.hintEl.textContent = msg;
            opts.hintEl.classList.remove('d-none');
            window.clearTimeout(flashHint._t);
            flashHint._t = window.setTimeout(function () {
                if (opts.hintEl) opts.hintEl.classList.add('d-none');
            }, 2200);
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

        async function saveActive() {
            var target = activeInput;
            if (!target) {
                flashHint(opts.hintFocus || '請先點一下要存的欄位');
                return;
            }
            var name = String(target.value || '').trim();
            if (!name) {
                flashHint(opts.hintEmpty || '欄位是空的，無法存為常用');
                return;
            }
            if (!opts.getHeaders) return;
            try {
                var headers = await opts.getHeaders();
                headers['Content-Type'] = 'application/json';
                var res = await fetch('/api/me/material-presets', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ name: name, kind: kind })
                });
                var d = await res.json().catch(function () { return {}; });
                if (!res.ok) {
                    flashHint(d.error || '儲存失敗');
                    return;
                }
                if (d.item) {
                    var exists = items.some(function (x) { return x.id === d.item.id; });
                    if (!exists) items.unshift(d.item);
                    else {
                        items = items.map(function (x) { return x.id === d.item.id ? d.item : x; });
                    }
                    render();
                } else {
                    await load();
                }
                flashHint(d.duplicate ? '已在常用清單' : '已存為常用');
            } catch (_) {
                flashHint('儲存失敗');
            }
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
            if (opts.saveBtn) {
                opts.saveBtn.addEventListener('click', function () { saveActive(); });
            }
        }

        bindInputs();
        load();

        return { reload: load };
    }

    return {
        init: createInstance
    };
})();
