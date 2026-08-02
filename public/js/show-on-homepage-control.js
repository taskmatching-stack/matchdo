/**
 * 生成時「展示在首頁媒體牆」勾選（付費可取消；免費強制公開）
 * 設計區、情境圖、商攝導演 Web／App 共用
 */
(function (global) {
  var canControl = false;
  var loaded = false;
  var loadPromise = null;

  function t(key, fb) {
    if (global.i18n && typeof global.i18n.t === 'function') {
      var v = global.i18n.t(key);
      if (v && v !== key) return v;
    }
    return fb || key;
  }

  function loadCanControl() {
    if (loaded) return Promise.resolve(canControl);
    if (loadPromise) return loadPromise;
    loadPromise = (function () {
      if (typeof global.canControlDesignShowOnHomepage === 'function') {
        return global.canControlDesignShowOnHomepage().then(function (c) {
          canControl = !!c;
          loaded = true;
          return canControl;
        });
      }
      if (global.AuthService && typeof global.AuthService.getSession === 'function') {
        return global.AuthService.getSession().then(function (session) {
          var token = session && (session.access_token || (session.session && session.session.access_token));
          if (!token) {
            loaded = true;
            return false;
          }
          return global.fetch('/api/me/capabilities', { headers: { Authorization: 'Bearer ' + token } })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              canControl = !!(data && data.can_control_design_show_on_homepage);
              loaded = true;
              return canControl;
            });
        });
      }
      loaded = true;
      return Promise.resolve(false);
    })().catch(function () {
      loaded = true;
      return false;
    });
    return loadPromise;
  }

  function syncCheckbox(checkboxId, hintId) {
    var cb = document.getElementById(checkboxId);
    var hint = hintId ? document.getElementById(hintId) : null;
    if (!cb) return;
    if (canControl) {
      cb.disabled = false;
      if (!cb.dataset.userTouched) cb.checked = true;
      if (hint) {
        hint.textContent = t('customProduct.paidUserShowHint', '可勾選是否展示在首頁媒體牆');
      }
    } else {
      cb.checked = true;
      cb.disabled = true;
      if (hint) {
        hint.textContent = t('customProduct.freeUserShowHint', '免費用戶預設展示在首頁，無法取消');
      }
    }
  }

  function init(checkboxId, hintId) {
    var cb = document.getElementById(checkboxId);
    if (!cb) return;
    cb.addEventListener('change', function () {
      cb.dataset.userTouched = '1';
    });
    loadCanControl().then(function () {
      syncCheckbox(checkboxId, hintId);
    });
  }

  function readChecked(checkboxId) {
    var cb = document.getElementById(checkboxId);
    return !cb || !!cb.checked;
  }

  global.MatchdoShowOnHomepageControl = {
    init: init,
    readChecked: readChecked,
    refresh: syncCheckbox,
    loadCanControl: loadCanControl
  };
})(typeof window !== 'undefined' ? window : this);
