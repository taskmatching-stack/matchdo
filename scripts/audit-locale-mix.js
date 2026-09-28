#!/usr/bin/env node
/**
 * 掃 zh-TW.json 是否含「像英文 UI」卻無中文；並列出 en 有、zh 缺鍵。
 * 用法：node scripts/audit-locale-mix.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const zhPath = path.join(__dirname, '..', 'public', 'locales', 'zh-TW.json');
const enPath = path.join(__dirname, '..', 'public', 'locales', 'en.json');
const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const ALLOW_PREFIX = [
    /^MOQ/i, /^LOGO/i, /^AI /i, /^Embed/i, /^EMBED/i, /^Google/i, /^Email/i, /^PayPal/i,
    /^JPG/i, /^PNG/i, /^WebP/i, /^SEED/i, /^API/i, /^MatchDO/i, /^support@/i, /^image /i,
    /^Manual/i, /FLUX/i, /^FAQ/i, /^OK$/i, /^vs\./i, /^HTTP/i, /^UI/i, /^UX/i,
    /^iframe/i, /^JSON/i, /^SQL/i, /^docs\//i
];

function likelyEnglishUi(s) {
    const t = String(s || '').trim();
    if (!t || t.length < 5) return false;
    if (CJK.test(t)) return false;
    if (!/[A-Za-z]{4,}/.test(t)) return false;
    if (ALLOW_PREFIX.some((re) => re.test(t))) return false;
    return true;
}

const badZh = [];
for (const k of Object.keys(zh)) {
    const z = String(zh[k] || '').trim();
    const e = String(en[k] || '').trim();
    if (likelyEnglishUi(z)) {
        badZh.push({ key: k, zh: z.slice(0, 100), sameAsEn: e === z });
    }
}
const missingZh = Object.keys(en).filter((k) => zh[k] === undefined);
const missingEn = Object.keys(zh).filter((k) => en[k] === undefined);

console.log('=== zh-TW.json values that look like English UI (no CJK) ===');
console.log('Count:', badZh.length);
badZh.sort((a, b) => a.key.localeCompare(b.key)).forEach((row) => {
    console.log((row.sameAsEn ? '[=en] ' : '      ') + row.key + ' => ' + row.zh);
});

console.log('\n=== Keys in en.json missing from zh-TW.json ===');
console.log('Count:', missingZh.length);
missingZh.slice(0, 30).forEach((k) => console.log('  ' + k));
if (missingZh.length > 30) console.log('  … +' + (missingZh.length - 30));

console.log('\n=== Keys in zh-TW.json missing from en.json ===');
console.log('Count:', missingEn.length);
missingEn.slice(0, 30).forEach((k) => console.log('  ' + k));
if (missingEn.length > 30) console.log('  … +' + (missingEn.length - 30));
