#!/usr/bin/env node
/**
 * 前台 HTML i18n 覆蓋稽核（不含 /admin/、iStudio 舊站）。
 * 用法：node scripts/audit-frontend-i18n.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

function walkHtml(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'admin' || name === 'iStudio-1.0.0') continue;
      walkHtml(p, out);
    } else if (name.endsWith('.html')) {
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      if (rel.startsWith('admin/') || rel.startsWith('iStudio-1.0.0/')) continue;
      out.push(p);
    }
  }
}

function auditFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const html = fs.readFileSync(filePath, 'utf8');
  const hasI18nJs = /i18n\.js/.test(html);
  const dataI18n = (html.match(/data-i18n(-html|-placeholder)?=/g) || []).length;
  const cjkMatches = html.match(CJK) || [];
  const cjkCount = cjkMatches.length;
  const inScript = (html.match(/<script[\s\S]*?<\/script>/gi) || []).join('').match(CJK) || [];
  const scriptCjk = inScript.length;
  const bodyApprox = cjkCount - scriptCjk;
  return { rel, hasI18nJs, dataI18n, cjkCount, bodyApprox, scriptCjk };
}

const files = [];
walkHtml(ROOT, files);
const rows = files.map(auditFile).sort((a, b) => b.bodyApprox - a.bodyApprox);

const noI18n = rows.filter((r) => !r.hasI18nJs && r.bodyApprox > 20);
const lowCoverage = rows.filter((r) => r.hasI18nJs && r.bodyApprox > 80 && r.dataI18n < 8);
const highRisk = rows.filter((r) => r.bodyApprox > 200 && r.dataI18n < 15);

console.log('MatchDO frontend i18n audit (public/, excl. admin & iStudio)\n');
console.log('Files scanned:', rows.length);
console.log('\n--- No i18n.js + substantial Chinese in markup (>20 chars) ---');
noI18n.slice(0, 40).forEach((r) => {
  console.log(`  ${r.rel}  (markup~${r.bodyApprox} CJK, data-i18n=${r.dataI18n})`);
});
if (noI18n.length > 40) console.log(`  … +${noI18n.length - 40} more`);

console.log('\n--- Has i18n.js but few data-i18n hooks (markup CJK>80, hooks<8) ---');
lowCoverage.slice(0, 30).forEach((r) => {
  console.log(`  ${r.rel}  (markup~${r.bodyApprox}, data-i18n=${r.dataI18n})`);
});

console.log('\n--- High Chinese volume, low hooks (markup CJK>200, hooks<15) ---');
highRisk.slice(0, 25).forEach((r) => {
  console.log(`  ${r.rel}  (markup~${r.bodyApprox}, data-i18n=${r.dataI18n})`);
});

console.log('\nTip: DB content EN = title_en etc.; UI EN = data-i18n + public/locales/en.json');
console.log('See docs/FRONTEND-I18N-AUDIT.md for surface checklist.\n');
