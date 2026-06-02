/**
 * 管理員備註／處理歷程（會員 user、廠商 manufacturer、供應商 supplier）
 */
(function (global) {
    var modalEl = null;
    var modalInst = null;
    var state = { entityType: '', entityId: '', label: '', onSaved: null };

    function esc(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function getToken() {
        if (global.AuthService && typeof AuthService.getSession === 'function') {
            return AuthService.getSession().then(function (s) {
                return s && (s.access_token || (s.session && s.session.access_token));
            });
        }
        return Promise.resolve(null);
    }

    function fmtTime(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString('zh-TW', { hour12: false });
        } catch (e) {
            return iso;
        }
    }

    function actionLabel(action) {
        if (action === 'note_update') return '備註更新';
        if (action === 'comment') return '處理紀錄';
        return action || '紀錄';
    }

    function ensureModal() {
        if (document.getElementById('adminFollowupModal')) {
            modalEl = document.getElementById('adminFollowupModal');
            return;
        }
        var html = '<div class="modal fade" id="adminFollowupModal" tabindex="-1" aria-hidden="true">' +
            '<div class="modal-dialog modal-lg modal-dialog-scrollable">' +
            '<div class="modal-content">' +
            '<div class="modal-header py-2">' +
            '<h6 class="modal-title">管理備註／處理歷程</h6>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
            '</div>' +
            '<div class="modal-body">' +
            '<p class="small text-muted mb-2" id="adminFollowupLabel"></p>' +
            '<div id="adminFollowupLoadErr" class="alert alert-warning small d-none"></div>' +
            '<div class="mb-3">' +
            '<label class="form-label small fw-semibold mb-1">待處理備註</label>' +
            '<textarea class="form-control form-control-sm" id="adminFollowupPending" rows="3" placeholder="須處理狀況、待辦、聯絡紀錄摘要…"></textarea>' +
            '<div class="form-text small">列表會顯示摘要；清空並儲存可表示已無待辦。</div>' +
            '</div>' +
            '<div class="mb-3">' +
            '<label class="form-label small fw-semibold mb-1">本次處理紀錄（選填）</label>' +
            '<textarea class="form-control form-control-sm" id="adminFollowupLogNote" rows="2" placeholder="例：已電話確認、已補點數、待回覆素材…"></textarea>' +
            '<div class="form-text small">儲存後會追加至下方歷程，不會覆蓋過往紀錄。</div>' +
            '</div>' +
            '<div>' +
            '<label class="form-label small fw-semibold mb-1">處理歷程</label>' +
            '<div id="adminFollowupLogs" class="border rounded p-2 bg-light" style="max-height:240px;overflow-y:auto">' +
            '<p class="text-muted small mb-0">載入中…</p></div>' +
            '</div>' +
            '</div>' +
            '<div class="modal-footer py-2">' +
            '<button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">關閉</button>' +
            '<button type="button" class="btn btn-sm btn-primary" id="adminFollowupSave">儲存</button>' +
            '</div></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
        modalEl = document.getElementById('adminFollowupModal');
        document.getElementById('adminFollowupSave').addEventListener('click', onSave);
    }

    function renderLogs(logs) {
        var box = document.getElementById('adminFollowupLogs');
        if (!box) return;
        if (!logs || !logs.length) {
            box.innerHTML = '<p class="text-muted small mb-0">尚無處理歷程</p>';
            return;
        }
        box.innerHTML = logs.map(function (log) {
            return '<div class="border-bottom pb-2 mb-2">' +
                '<div class="d-flex flex-wrap gap-2 align-items-center small text-muted mb-1">' +
                '<span>' + esc(fmtTime(log.created_at)) + '</span>' +
                '<span class="badge bg-secondary">' + esc(actionLabel(log.action)) + '</span>' +
                (log.admin_email ? '<span>' + esc(log.admin_email) + '</span>' : '') +
                '</div>' +
                '<div class="small" style="white-space:pre-wrap">' + esc(log.note || '') + '</div>' +
                '</div>';
        }).join('');
    }

    function loadDetail() {
        var errEl = document.getElementById('adminFollowupLoadErr');
        if (errEl) { errEl.classList.add('d-none'); errEl.textContent = ''; }
        document.getElementById('adminFollowupPending').value = '';
        document.getElementById('adminFollowupLogNote').value = '';
        document.getElementById('adminFollowupLogs').innerHTML = '<p class="text-muted small mb-0">載入中…</p>';
        return getToken().then(function (token) {
            if (!token) throw new Error('請先登入');
            var url = '/api/admin/followups/' + encodeURIComponent(state.entityType) + '/' + encodeURIComponent(state.entityId);
            return fetch(url, { headers: { Authorization: 'Bearer ' + token } }).then(function (r) {
                return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
            });
        }).then(function (res) {
            if (!res.ok) {
                var msg = (res.data && res.data.error) || '載入失敗';
                if (errEl) {
                    errEl.textContent = msg;
                    errEl.classList.remove('d-none');
                }
                document.getElementById('adminFollowupLogs').innerHTML = '<p class="text-muted small mb-0">—</p>';
                return;
            }
            var f = (res.data && res.data.followup) || {};
            document.getElementById('adminFollowupPending').value = f.pending_note || '';
            renderLogs(f.logs || []);
        }).catch(function (e) {
            if (errEl) {
                errEl.textContent = e.message || '載入失敗';
                errEl.classList.remove('d-none');
            }
        });
    }

    function onSave() {
        var btn = document.getElementById('adminFollowupSave');
        btn.disabled = true;
        var body = {
            pending_note: document.getElementById('adminFollowupPending').value,
            log_note: document.getElementById('adminFollowupLogNote').value
        };
        getToken().then(function (token) {
            if (!token) throw new Error('請先登入');
            var url = '/api/admin/followups/' + encodeURIComponent(state.entityType) + '/' + encodeURIComponent(state.entityId);
            return fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify(body)
            }).then(function (r) {
                return r.json().then(function (d) { return { ok: r.ok, data: d }; });
            });
        }).then(function (res) {
            if (!res.ok) {
                alert((res.data && res.data.error) || '儲存失敗');
                return;
            }
            document.getElementById('adminFollowupLogNote').value = '';
            var f = (res.data && res.data.followup) || {};
            renderLogs(f.logs || []);
            if (typeof state.onSaved === 'function') state.onSaved(f);
        }).catch(function (e) {
            alert(e.message || '儲存失敗');
        }).finally(function () {
            btn.disabled = false;
        });
    }

    function renderCellSummary(af) {
        af = af || {};
        var note = (af.pending_note || '').trim();
        var preview = note ? esc(note.length > 48 ? note.slice(0, 48) + '…' : note) : '<span class="text-muted">—</span>';
        var badges = '';
        if (af.has_pending) badges += '<span class="badge bg-warning text-dark me-1">待處理</span>';
        if (af.log_count > 0) badges += '<span class="badge bg-light text-secondary border">' + af.log_count + ' 筆歷程</span>';
        return '<div class="small" style="max-width:200px">' + badges +
            '<div class="mt-1 text-break">' + preview + '</div></div>';
    }

    function open(opts) {
        opts = opts || {};
        state.entityType = opts.entityType || '';
        state.entityId = opts.entityId || '';
        state.label = opts.label || '';
        state.onSaved = opts.onSaved || null;
        if (!state.entityType || !state.entityId) return;
        ensureModal();
        if (!modalInst && global.bootstrap) {
            modalInst = new bootstrap.Modal(modalEl);
        }
        document.getElementById('adminFollowupLabel').textContent = state.label;
        loadDetail().then(function () {
            if (modalInst) modalInst.show();
        });
    }

    global.AdminFollowup = {
        open: open,
        renderCellSummary: renderCellSummary,
        esc: esc
    };
})(typeof window !== 'undefined' ? window : this);
