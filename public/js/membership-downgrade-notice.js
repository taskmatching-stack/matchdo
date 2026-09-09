/**
 * 登入後顯示待確認的會員降級通知（可稽核留存於 membership_downgrade_notices）
 */
(function (global) {
  var modalEl = null;
  var modalInstance = null;
  var loading = false;

  function getToken() {
    if (global.AuthService && typeof global.AuthService.getSession === 'function') {
      return global.AuthService.getSession().then(function (s) {
        return s && s.access_token ? s.access_token : null;
      });
    }
    return Promise.resolve(null);
  }

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.id = 'membershipDowngradeNoticeModal';
    modalEl.setAttribute('tabindex', '-1');
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.innerHTML = [
      '<div class="modal-dialog modal-dialog-centered modal-lg">',
      '  <div class="modal-content">',
      '    <div class="modal-header">',
      '      <h5 class="modal-title" id="membershipDowngradeNoticeTitle"></h5>',
      '    </div>',
      '    <div class="modal-body">',
      '      <pre id="membershipDowngradeNoticeBody" class="mb-0 small text-wrap" style="white-space:pre-wrap;font-family:inherit;"></pre>',
      '      <p class="text-muted small mt-3 mb-0">此說明已記錄於您的帳號，供日後查核。</p>',
      '    </div>',
      '    <div class="modal-footer flex-wrap gap-2">',
      '      <a href="/client/my-custom-products.html" class="btn btn-outline-primary btn-sm">前往我的設計</a>',
      '      <a href="/subscription-plans.html" class="btn btn-outline-secondary btn-sm">查看方案</a>',
      '      <button type="button" class="btn btn-primary btn-sm" id="membershipDowngradeNoticeAckBtn">我已了解</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modalEl);
    return modalEl;
  }

  function showNotice(notice) {
    if (!notice || !notice.id) return Promise.resolve();
    ensureModal();
    document.getElementById('membershipDowngradeNoticeTitle').textContent = notice.title || '方案調整通知';
    document.getElementById('membershipDowngradeNoticeBody').textContent = notice.body_text || '';
    var ackBtn = document.getElementById('membershipDowngradeNoticeAckBtn');
    if (typeof global.bootstrap === 'undefined') return Promise.resolve();
    if (!modalInstance) modalInstance = new global.bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

    return getToken().then(function (token) {
      if (!token) return;
      return fetch('/api/me/membership-notices/' + encodeURIComponent(notice.id) + '/shown', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: '{}'
      });
    }).then(function () {
      return new Promise(function (resolve) {
        var done = false;
        function finish() {
          if (done) return;
          done = true;
          resolve();
        }
        ackBtn.onclick = function () {
          getToken().then(function (token) {
            if (!token) { finish(); return; }
            return fetch('/api/me/membership-notices/' + encodeURIComponent(notice.id) + '/acknowledge', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
              body: JSON.stringify({ via: 'login_modal' })
            });
          }).then(function () {
            if (modalInstance) modalInstance.hide();
            finish();
          }).catch(finish);
        };
        modalInstance.show();
        modalEl.addEventListener('hidden.bs.modal', finish, { once: true });
      });
    });
  }

  function pollPending() {
    if (loading) return;
    loading = true;
    getToken().then(function (token) {
      if (!token) { loading = false; return; }
      return fetch('/api/me/membership-notices/pending', {
        headers: { Authorization: 'Bearer ' + token }
      }).then(function (r) { return r.ok ? r.json() : null; });
    }).then(function (data) {
      var list = (data && data.notices) || [];
      var chain = Promise.resolve();
      list.forEach(function (notice) {
        chain = chain.then(function () { return showNotice(notice); });
      });
      return chain;
    }).catch(function () {}).finally(function () { loading = false; });
  }

  global.MatchdoMembershipDowngradeNotice = { pollPending: pollPending };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(pollPending, 800);
    });
  } else {
    setTimeout(pollPending, 800);
  }
})(typeof window !== 'undefined' ? window : this);
