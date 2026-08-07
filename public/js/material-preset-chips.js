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

        function shouldShowWrapWhenEmpty() {
            return opts.showWhenEmpty !== false;
        }

        function render() {
            if (!opts.chipsEl) return;
            opts.chipsEl.innerHTML = '';
            if (!items.length) {
                var empty = document.createElement('span');
                empty.className = 'small text-muted';
                empty.textContent = opts.emptyLabel || '尚無常用項目，請在欄位輸入後按「存此欄」';
                opts.chipsEl.appendChild(empty);
            } else {
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
            setWrapVisible(shouldShowWrapWhenEmpty() || items.length > 0);
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
            flashHint((opts.fillOkLabel || '已填入') + '：' + name, 'success');
        }

        function flashHint(msg, tone) {
            tone = tone || 'muted';
            if (opts.statusEl) {
                opts.statusEl.textContent = msg;
                opts.statusEl.classList.remove('text-muted', 'text-danger', 'text-success');
                opts.statusEl.classList.add(tone === 'success' ? 'text-success' : (tone === 'danger' ? 'text-danger' : 'text-muted'));
            }
            if (opts.hintEl) {
                opts.hintEl.textContent = msg;
                opts.hintEl.classList.remove('d-none');
                window.clearTimeout(flashHint._t);
                flashHint._t = window.setTimeout(function () {
                    if (opts.hintEl) opts.hintEl.classList.add('d-none');
                }, 2800);
            }
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
                    if (res.status === 401 || res.status === 403) setWrapVisible(false);
                    else if (res.status === 503) flashHint(d.error || '常用儲存尚未啟用（請聯絡管理員）', 'danger');
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
            if (inputEl) activeInput = inputEl;
            return saveActive();
        }

        async function saveActive() {
            var target = activeInput;
            if (!target) {
                flashHint(opts.hintFocus || '請先點一下要存的欄位', 'danger');
                return;
            }
            var name = String(target.value || '').trim();
            if (!name) {
                flashHint(opts.hintEmpty || '欄位是空的，無法存為常用', 'danger');
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
                    flashHint(d.error || '儲存失敗', 'danger');
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
                flashHint(d.duplicate ? ('已在常用清單：' + name) : ('已存為常用：' + name), 'success');
            } catch (_) {
                flashHint('儲存失敗', 'danger');
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
            (opts.fieldSaveBtns || []).forEach(function (pair) {
                if (!pair || !pair.btn || !pair.input) return;
                pair.btn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    saveFromInput(pair.input);
                });
            });
        }

        bindInputs();
        if (shouldShowWrapWhenEmpty()) setWrapVisible(true);
        load();

        return { reload: load, saveFromInput: saveFromInput };
    }

    return {
        init: createInstance
    };
})();
