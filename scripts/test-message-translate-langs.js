#!/usr/bin/env node
'use strict';
const m = require('../lib/message-translate-langs');

const cases = [
    ['en-US', 'en'],
    ['ja', 'ja'],
    ['', ''],
    ['zh-CN', 'zh-TW'],
    ['pt-br', 'pt']
];
let ok = true;
cases.forEach(function (pair) {
    const got = m.normalizeMessageTranslateTargetLang(pair[0]);
    if (got !== pair[1]) {
        ok = false;
        console.error('normalize fail', pair[0], 'expected', pair[1], 'got', got);
    }
});
const list = m.listMessageTranslateTargetLangsForApi('en');
if (!list.length || list[0].code !== 'zh-TW') {
    ok = false;
    console.error('listMessageTranslateTargetLangsForApi failed');
}
if (m.defaultMessageTranslateTargetFromUiLocale('zh-TW') !== 'zh-TW') ok = false;
if (m.defaultMessageTranslateTargetFromUiLocale('en') !== 'en') ok = false;
console.log(ok ? 'OK message-translate-langs' : 'FAIL');
process.exit(ok ? 0 : 1);
