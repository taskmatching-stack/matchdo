#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('../lib/nav-cp-menu-html.js');

var html = lib.buildNavCpMenuInnerHtml(function (k) { return k; });
var css = fs.readFileSync(path.join(__dirname, '../public/css/nav-cp-menu.css'), 'utf8');
var siteHeader = fs.readFileSync(path.join(__dirname, '../public/js/site-header.js'), 'utf8');

var required = [
    'nav-cp-section--structure',
    'nav-cp-section--style',
    'nav-cp-section--marketing',
    'nav-cp-section--assist',
    'nav-cp-link--design'
];
var forbidden = ['dropdown-item', 'dropdown-header', 'nav-cp-item', 'nav-cp-h'];

required.forEach(function (token) {
    if (!html.includes(token)) throw new Error('HTML missing ' + token);
});
forbidden.forEach(function (token) {
    if (html.includes(token)) throw new Error('HTML has forbidden ' + token);
});
if (!css.includes('#site-header .nav-cp-menu .nav-cp-section--style')) {
    throw new Error('CSS missing scoped style section');
}
if (!siteHeader.includes('buildNavCpMenuInnerHtml(t)')) {
    throw new Error('site-header.js missing buildNavCpMenuInnerHtml usage');
}
if (siteHeader.includes('nav-cp-menu-css')) {
    throw new Error('site-header.js must not inject nav-cp-menu.css (use style.css @import)');
}

console.log('OK nav-cp-menu rewrite');
