'use strict';

const path = require('path');

let zhMessages = null;
let enMessages = null;

function loadMessages() {
    if (zhMessages) return;
    zhMessages = require(path.join(__dirname, '..', 'public', 'locales', 'zh-TW.json'));
    enMessages = require(path.join(__dirname, '..', 'public', 'locales', 'en.json'));
}

function t(lang, key) {
    loadMessages();
    var fullKey = key.indexOf('helpGuides.') === 0 ? key : ('helpGuides.' + key);
    var m = lang === 'en' ? enMessages : zhMessages;
    return (m && m[fullKey]) || (zhMessages && zhMessages[fullKey]) || fullKey;
}

function docTitleSuffix(lang) {
    return t(lang, 'docSuffix');
}

module.exports = {
    t: t,
    docTitleSuffix: docTitleSuffix
};
