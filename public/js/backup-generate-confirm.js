/**
 * 生圖備援確認：滿額／忙碌時詢問「改用備援或稍後再送」。文案不出現模型名稱。
 */
(function (global) {
  'use strict';

  var MSG_CONFIRM_ZH = '目前主要產生通道較忙。確定＝改用備援方式產生；取消＝稍後再送出。';
  var MSG_CONFIRM_EN = 'The main generate channel is busy. OK = use a backup method. Cancel = send later.';
  var MSG_LATER_ZH = '已取消，可稍後再送出。';
  var MSG_LATER_EN = 'Cancelled. You can send it later.';

  function isEn() {
    try {
      var lang = global.i18n && global.i18n.getLang && global.i18n.getLang();
      return String(lang || '').toLowerCase().indexOf('en') === 0;
    } catch (_) {
      return false;
    }
  }

  function t(key, zh, en) {
    try {
      if (global.i18n && typeof global.i18n.t === 'function') {
        var v = global.i18n.t(key);
        if (v && v !== key) return v;
      }
    } catch (_) {}
    return isEn() ? en : zh;
  }

  function isBackupConfirm(resOrStatus, data) {
    var payload = data;
    if (resOrStatus && typeof resOrStatus === 'object' && resOrStatus.status != null) {
      payload = resOrStatus.data || data || resOrStatus;
    }
    return !!(payload && payload.code === 'backup_confirm');
  }

  function askConfirm() {
    return global.confirm(t('genBackup.confirm', MSG_CONFIRM_ZH, MSG_CONFIRM_EN));
  }

  function laterMessage() {
    return t('genBackup.later', MSG_LATER_ZH, MSG_LATER_EN);
  }

  function declinedResult(res) {
    return {
      ok: false,
      status: 409,
      declined: true,
      data: Object.assign({}, (res && res.data) || {}, {
        error: laterMessage(),
        code: 'backup_declined'
      })
    };
  }

  function withAcceptBackup(payload, sendFn) {
    return Promise.resolve(sendFn(payload)).then(function (res) {
      if (!isBackupConfirm(res)) return res;
      if (!askConfirm()) return declinedResult(res);
      return sendFn(Object.assign({}, payload || {}, { accept_backup: true }));
    });
  }

  function retryFormData(fd, sendFn) {
    return Promise.resolve(sendFn(fd)).then(function (res) {
      if (!isBackupConfirm(res)) return res;
      if (!askConfirm()) return declinedResult(res);
      if (fd && typeof fd.set === 'function') fd.set('accept_backup', '1');
      else if (fd && typeof fd.append === 'function') fd.append('accept_backup', '1');
      return sendFn(fd);
    });
  }

  global.MatchdoImageBackupConfirm = {
    isBackupConfirm: isBackupConfirm,
    askConfirm: askConfirm,
    laterMessage: laterMessage,
    withAcceptBackup: withAcceptBackup,
    retryFormData: retryFormData
  };
})(typeof window !== 'undefined' ? window : this);
