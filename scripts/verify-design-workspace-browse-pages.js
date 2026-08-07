#!/usr/bin/env node
/**
 * 驗證新版廠商／官方版型列表頁 HTML 結構（對齊 material-dual-color）
 * 用法：node scripts/verify-design-workspace-browse-pages.js
 * 通過後才將 lib/*-browse-page.js 貼回取代 lib/vendor-styles-page.js 等原檔。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const vendor = require('../lib/vendor-styles-browse-page');
const official = require('../lib/official-templates-browse-page');
const materialHtml = fs.readFileSync(
    path.join(__dirname, '../public/client/material-dual-color.html'),
    'utf8'
);

const opts = { items: [], total: 0, categories: [], categoryKey: '', base: 'http://localhost:3000' };
const vendorHtml = vendor.buildVendorStylesHtml(opts);
const officialHtml = official.buildOfficialTemplatesHtml(opts);

function idx(h, s) { return h.indexOf(s); }

function assertOrder(h, label, a, b) {
    const ia = idx(h, a);
    const ib = idx(h, b);
    if (ia < 0 || ib < 0 || ia >= ib) {
        throw new Error(label + ': expected "' + a + '" before "' + b + '" (got ' + ia + ', ' + ib + ')');
    }
}

function checkPage(h, name) {
    assertOrder(h, name, 'design-workspace-head', 'design-workspace-frame');
    assertOrder(h, name, 'design-workspace-frame', 'data-design-workspace-tabs');
    assertOrder(h, name, 'data-design-workspace-tabs', 'design-workspace-body');
    if (!h.includes('design-workspace-tabs.js?v=7')) {
        throw new Error(name + ': missing design-workspace-tabs.js mount script');
    }
    if (!h.includes('nav-link')) {
        /* SSR 不內嵌 Tab；由 JS mount — 初始 HTML 不應有 cp-tab-strip */
    }
    if (h.includes('cp-tab-groups')) {
        throw new Error(name + ': should not SSR inline tabs (use data-design-workspace-tabs)');
    }
    assertOrder(h, name, 'id="site-header"', 'auth-config.js');
    assertOrder(h, name, 'auth-config.js', 'site-header.js');
    assertOrder(h, name, 'site-header.js', 'design-workspace-shell');
    if (!h.includes('id="bs-bundle-js"')) {
        throw new Error(name + ': missing head #bs-bundle-js defer bootstrap');
    }
    console.log('OK', name);
}

// 材料組合參考：標題在 frame 外、Tab mount 在 frame 內
if (!materialHtml.includes('data-design-workspace-tabs')) {
    throw new Error('material-dual-color.html reference missing data-design-workspace-tabs');
}
assertOrder(materialHtml, 'material reference', 'design-workspace-head', 'design-workspace-frame');
assertOrder(materialHtml, 'material reference', 'design-workspace-frame', 'data-design-workspace-tabs');
console.log('OK material-dual-color.html reference');

checkPage(vendorHtml, 'vendor-styles-browse-page');
checkPage(officialHtml, 'official-templates-browse-page');

const outDir = path.join(__dirname, '../tmp');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'vendor-styles-browse-preview.html'), vendorHtml, 'utf8');
fs.writeFileSync(path.join(outDir, 'official-templates-browse-preview.html'), officialHtml, 'utf8');

console.log('\nPreview files:');
console.log('  tmp/vendor-styles-browse-preview.html');
console.log('  tmp/official-templates-browse-preview.html');
console.log('\nTo try on server (after review), in server.js change require to:');
console.log("  ./lib/vendor-styles-browse-page");
console.log("  ./lib/official-templates-browse-page");
console.log('Then restart npm start and open /vendor-styles/ /official-templates/');
console.log('\nAll checks passed.');
