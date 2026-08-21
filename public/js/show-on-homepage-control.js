/**
 * 生成時「展示在首頁媒體牆」勾選（付費可取消；免費強制公開）
 * 設計區、情境圖、商攝導演 Web／App 共用
 *
 * defaultChecked：付費可控制時的預設勾選（未碰過開關前）。
 * 人像攝影傳 false＝預設不上媒體牆；產品／空間維持 true。
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

  function syncCheckbox(checkboxId, hintId, options) {
    var cb = document.getElementById(checkboxId);
    var hint = hintId ? document.getElementById(hintId) : null;
    if (!cb) return;
    var opts = options && typeof options === 'object' ? options : {};
    var defaultChecked = typeof opts.defaultChecked === 'boolean' ? opts.defaultChecked : true;
    if (canControl) {
      cb.disabled = false;
      if (!cb.dataset.userTouched) cb.checked = defaultChecked;
      if (hint) {
        hint.textContent = defaultChecked === false
          ? t('customProduct.paidUserPortraitShowHint', '人像預設不上媒體牆，可自行勾選公開')
          : t('customProduct.paidUserShowHint', '可勾選是否展示在首頁媒體牆');
      }
    } else {
      cb.checked = true;
      cb.disabled = true;
      if (hint) {
        hint.textContent = t('customProduct.freeUserShowHint', '免費用戶預設展示在首頁，無法取消');
      }
    }
  }

  function init(checkboxId, hintId, options) {
    var cb = document.getElementById(checkboxId);
    if (!cb) return;
    cb.addEventListener('change', function () {
      cb.dataset.userTouched = '1';
    });
    loadCanControl().then(function () {
      syncCheckbox(checkboxId, hintId, options);
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
