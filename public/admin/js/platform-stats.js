(function () {
  'use strict';

  var SECTIONS = { category: 1, combo: 1, points: 1, actions: 1 };
  var loadedKey = '';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function showMsg(text, isErr) {
    var el = $('statsMsg');
    if (!el) return;
    el.className = 'alert mb-2 py-2 small ' + (isErr ? 'alert-danger' : 'alert-info');
    el.textContent = text;
    el.classList.remove('d-none');
  }

  function hideMsg() {
    var el = $('statsMsg');
    if (el) el.classList.add('d-none');
  }

  async function getAuthHeaders() {
    if (!window.AuthService || !AuthService.getSession) return {};
    var session = await AuthService.getSession();
    var token = session && session.access_token;
    if (!token) return {};
    return { Authorization: 'Bearer ' + token };
  }

  function getDateRange() {
    return {
      from: ($('fromDate') && $('fromDate').value) || '',
      to: ($('toDate') && $('toDate').value) || ''
    };
  }

  function setQuickRange(kind) {
    var fromEl = $('fromDate');
    var toEl = $('toDate');
    if (!fromEl || !toEl) return;
    var today = new Date();
    toEl.value = fmtDate(today);
    if (kind === 'all') {
      fromEl.value = '';
      toEl.value = '';
      return;
    }
    var days = parseInt(kind, 10) || 7;
    var from = new Date(today);
    from.setDate(from.getDate() - (days - 1));
    fromEl.value = fmtDate(from);
  }

  function showRangeMeta(from, to) {
    var el = $('rangeMeta');
    if (!el) return;
    if (!from && !to) {
      el.textContent = '全部時間';
      return;
    }
    el.textContent = (from || '…') + ' ～ ' + (to || '…');
  }

  function updateUrl(section, subTab) {
    if (!window.history || !window.history.replaceState) return;
    var u = new URL(window.location.href);
    u.searchParams.set('section', section);
    if (subTab) u.searchParams.set('tab', subTab);
    window.history.replaceState(null, '', u.pathname + u.search);
  }

  function getCurrentSection() {
    var s = (new URLSearchParams(window.location.search).get('section') || 'category').trim();
    return SECTIONS[s] ? s : 'category';
  }

  function toggleCategoryFilters(show) {
    var el = $('categoryFilters');
    if (el) el.classList.toggle('d-none', !show);
  }

  function showSection(name) {
    var key = SECTIONS[name] ? name : 'category';
    ['category', 'combo', 'points', 'actions'].forEach(function (k) {
      var panel = $('section' + k.charAt(0).toUpperCase() + k.slice(1));
      if (panel) panel.classList.toggle('d-none', k !== key);
    });
    document.querySelectorAll('[data-section]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-section') === key);
    });
    toggleCategoryFilters(key === 'category');
    updateUrl(key, getSubTab(key));
  }

  function getSubTab(section) {
    var tab = (new URLSearchParams(window.location.search).get('tab') || '').trim();
    if (section === 'category') {
      return tab === 'design' || tab === 'promo' ? tab : 'vendor';
    }
    if (section === 'combo') {
      return { overview: 1, materials: 1, pairs: 1, palette: 1 }[tab] ? tab : 'overview';
    }
    return '';
  }

  function showSubPanel(section, name, panelMap, tabSelector) {
    var key = panelMap[name] ? name : Object.keys(panelMap)[0];
    Object.keys(panelMap).forEach(function (k) {
      if (panelMap[k]) panelMap[k].classList.toggle('d-none', k !== key);
    });
    var prefix = section === 'category' ? '#subTabCategory ' : '#subTabCombo ';
    document.querySelectorAll(prefix + tabSelector).forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-panel') === key);
    });
    updateUrl(section, key);
  }

  var categoryPanels = {
    vendor: $('panelVendor'),
    design: $('panelDesign'),
    promo: $('panelPromo')
  };

  var comboPanels = {
    overview: $('panelComboOverview'),
    materials: $('panelComboMaterials'),
    pairs: $('panelComboPairs'),
    palette: $('panelComboPalette')
  };

  function initSectionTabs() {
    document.querySelectorAll('[data-section]').forEach(function (el) {
      el.addEventListener('click', function () {
        var sec = el.getAttribute('data-section');
        showSection(sec);
        loadCurrentSection(true);
      });
    });
    showSection(getCurrentSection());
  }

  function initSubTabs() {
    document.querySelectorAll('#subTabCategory .tab-btn').forEach(function (el) {
      el.addEventListener('click', function () {
        showSubPanel('category', el.getAttribute('data-panel'), categoryPanels, '.tab-btn');
      });
    });
    document.querySelectorAll('#subTabCombo .tab-btn').forEach(function (el) {
      el.addEventListener('click', function () {
        showSubPanel('combo', el.getAttribute('data-panel'), comboPanels, '.tab-btn');
      });
    });
    var sec = getCurrentSection();
    var sub = getSubTab(sec);
    if (sec === 'category') showSubPanel('category', sub, categoryPanels, '.tab-btn');
    if (sec === 'combo') showSubPanel('combo', sub, comboPanels, '.tab-btn');
  }

  function numCell(n, extraClass) {
    var cls = 'col-num' + (extraClass ? ' ' + extraClass : '');
    return '<td class="' + cls + '">' + (n != null ? n : 0) + '</td>';
  }

  function setTableFoot(footId, html) {
    var el = $(footId);
    if (!el) return;
    el.innerHTML = html || '';
  }

  function sumRowCounts(rows, field) {
    return (rows || []).reduce(function (n, r) { return n + (r[field] || 0); }, 0);
  }

  function sumVendorCategories(categories) {
    var t = {
      official_prototype_records: 0, vendor_prototype_records: 0,
      official_prototype_images: 0, vendor_prototype_images: 0,
      official_material_records: 0, vendor_material_records: 0,
      official_material_images: 0, vendor_material_images: 0
    };
    (categories || []).forEach(function (c) {
      t.official_prototype_records += c.official_prototype_records || 0;
      t.vendor_prototype_records += c.vendor_prototype_records || 0;
      t.official_prototype_images += c.official_prototype_images || 0;
      t.vendor_prototype_images += c.vendor_prototype_images || 0;
      t.official_material_records += c.official_material_records || 0;
      t.vendor_material_records += c.vendor_material_records || 0;
      t.official_material_images += c.official_material_images || 0;
      t.vendor_material_images += c.vendor_material_images || 0;
    });
    return t;
  }

  function renderVendorGrandTotal(summary) {
    if (!summary) return '';
    return '<tr><td class="col-main">總計</td><td class="col-sub"></td>' + vendorNumCells(summary) + '</tr>';
  }

  function renderSimpleGrandTotal(summary) {
    if (!summary) return '';
    return '<tr><td class="col-main">總計</td><td class="col-sub"></td>' + numCell(summary.records) + numCell(summary.images) + '</tr>';
  }

  function renderPromoGrandTotal(summary) {
    if (!summary) return '';
    return '<tr><td class="col-main">總計</td><td class="col-sub"></td>'
      + numCell(summary.promo_page, 'col-promo-page') + numCell(summary.promo_camera, 'col-promo-camera') + '</tr>';
  }

  function renderCountGrandTotal(label, total, colSpan) {
    var cs = colSpan || 1;
    var labelCell = '<td' + (cs > 1 ? ' colspan="' + cs + '"' : '') + '>' + esc(label) + '</td>';
    return '<tr>' + labelCell + '<td class="col-num">' + (total != null ? total.toLocaleString() : 0) + '</td></tr>';
  }

  function renderPointsFuncGrandTotal(totalCount, totalPoints) {
    return '<tr><td>總計</td><td class="col-num">' + (totalCount || 0).toLocaleString()
      + '</td><td class="col-num">' + (totalPoints || 0).toLocaleString() + '</td><td></td></tr>';
  }

  function renderPointsLevelGrandTotal(rows) {
    var users = sumRowCounts(rows, 'user_count');
    var times = sumRowCounts(rows, 'count');
    var points = sumRowCounts(rows, 'total_points');
    var avg = users > 0 ? Math.round(points / users) : null;
    return '<tr><td>總計</td><td class="col-num">' + users.toLocaleString()
      + '</td><td class="col-num">' + times.toLocaleString()
      + '</td><td class="col-num">' + points.toLocaleString()
      + '</td><td class="col-num">' + (avg != null ? avg.toLocaleString() : '—') + '</td></tr>';
  }

  function catGroupKey(cat) {
    return String(cat.category_key || 'cat').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function catHeadMainCell(cat) {
    var gk = catGroupKey(cat);
    var title = esc(cat.category_name) + ' (' + esc(cat.category_key) + ')';
    var label = esc(cat.category_name);
    if (cat.is_active === false) label += ' <span class="badge bg-secondary">停</span>';
    return '<button type="button" class="cat-toggle" data-cat="' + gk + '" aria-expanded="true" title="收合／展開子分類">▼</button>'
      + '<span title="' + title + '">' + label + '</span>';
  }

  function toggleCatGroup(btn) {
    var gk = btn.getAttribute('data-cat');
    var expanded = btn.getAttribute('aria-expanded') !== 'false';
    var next = !expanded;
    btn.setAttribute('aria-expanded', next ? 'true' : 'false');
    btn.textContent = next ? '▼' : '▶';
    var tbody = btn.closest('tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr.row-cat-body[data-cat="' + gk + '"]').forEach(function (tr) {
      tr.classList.toggle('d-none', !next);
    });
  }

  function bindCatGroupToggles(root) {
    if (!root) return;
    root.querySelectorAll('.cat-toggle').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleCatGroup(btn);
      });
    });
    root.querySelectorAll('tr.row-cat-head').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('.cat-toggle')) return;
        var btn = tr.querySelector('.cat-toggle');
        if (btn) toggleCatGroup(btn);
      });
    });
  }

  function subCell(sub) {
    var html = esc(sub.subcategory_name);
    if (sub.is_active === false) html += ' <span class="badge bg-secondary">停</span>';
    return html;
  }

  function rowInactiveClass(isActive, isSub) {
    if (isActive === false) return isSub ? ' row-sub-inactive' : ' row-inactive';
    return '';
  }

  function visibleSubs(subs, pickFn) {
    return (subs || []).filter(function (sub) { return pickFn(sub); });
  }

  function vendorNumCells(row) {
    return numCell(row.official_prototype_records, 'col-proto')
      + numCell(row.vendor_prototype_records, 'col-proto')
      + numCell(row.official_prototype_images, 'col-proto')
      + numCell(row.vendor_prototype_images, 'col-proto col-group-end')
      + numCell(row.official_material_records, 'col-mat')
      + numCell(row.vendor_material_records, 'col-mat')
      + numCell(row.official_material_images, 'col-mat')
      + numCell(row.vendor_material_images, 'col-mat');
  }

  function hasVendorRowData(row) {
    return row && (row.prototype_records || row.prototype_images || row.material_records || row.material_images);
  }

  function renderVendorRows(categories) {
    if (!categories || !categories.length) {
      return '<tr><td colspan="10" class="text-muted p-2">尚無分類或資料</td></tr>';
    }
    var html = [];
    categories.forEach(function (cat) {
      var cls = rowInactiveClass(cat.is_active, false);
      var gk = catGroupKey(cat);
      var subs = cat.subcategories || [];
      html.push('<tr class="row-cat-head row-total' + cls + '" data-cat="' + gk + '"><td class="col-main">' + catHeadMainCell(cat) + '</td><td class="col-sub">合計</td>'
        + vendorNumCells(cat) + '</tr>');
      subs.forEach(function (sub) {
        html.push('<tr class="row-sub row-cat-body' + cls + rowInactiveClass(sub.is_active, true) + '" data-cat="' + gk + '"><td class="col-main cat-main-empty"></td><td class="col-sub">' + subCell(sub) + '</td>' + vendorNumCells(sub) + '</tr>');
      });
    });
    return html.join('');
  }

  function renderSimpleRows(categories, orphanMode) {
    if (!categories || !categories.length) {
      return '<tr><td colspan="4" class="text-muted p-2">尚無分類或資料</td></tr>';
    }
    var html = [];
    categories.forEach(function (cat) {
      var cls = rowInactiveClass(cat.is_active, false) + (orphanMode ? ' row-orphan' : '');
      var gk = catGroupKey(cat);
      var subs = cat.subcategories || [];
      var main = orphanMode ? '<code class="small">' + esc(cat.category_key) + '</code>' : catHeadMainCell(cat);
      html.push('<tr class="row-cat-head row-total' + cls + '" data-cat="' + gk + '"><td class="col-main">' + main + '</td><td class="col-sub">合計</td>' + numCell(cat.records) + numCell(cat.images) + '</tr>');
      subs.forEach(function (sub) {
        html.push('<tr class="row-sub row-cat-body' + cls + rowInactiveClass(sub.is_active, true) + '" data-cat="' + gk + '"><td class="col-main cat-main-empty"></td><td class="col-sub">' + subCell(sub) + '</td>' + numCell(sub.records) + numCell(sub.images) + '</tr>');
      });
    });
    return html.join('');
  }

  function hasPromoRowData(row) {
    return row && (row.promo_page || row.promo_camera);
  }

  function promoNumCells(row) {
    return numCell(row.promo_page, 'col-promo-page') + numCell(row.promo_camera, 'col-promo-camera');
  }

  function renderPromoRows(categories, orphanMode) {
    if (!categories || !categories.length) {
      return '<tr><td colspan="4" class="text-muted p-2">尚無分類或資料</td></tr>';
    }
    var html = [];
    categories.forEach(function (cat) {
      var cls = rowInactiveClass(cat.is_active, false) + (orphanMode ? ' row-orphan' : '');
      var gk = catGroupKey(cat);
      var subs = cat.subcategories || [];
      var main = orphanMode ? '<code class="small">' + esc(cat.category_key) + '</code>' : catHeadMainCell(cat);
      html.push('<tr class="row-cat-head row-total' + cls + '" data-cat="' + gk + '"><td class="col-main">' + main + '</td><td class="col-sub">合計</td>' + promoNumCells(cat) + '</tr>');
      subs.forEach(function (sub) {
        html.push('<tr class="row-sub row-cat-body' + cls + rowInactiveClass(sub.is_active, true) + '" data-cat="' + gk + '"><td class="col-main cat-main-empty"></td><td class="col-sub">' + subCell(sub) + '</td>' + promoNumCells(sub) + '</tr>');
      });
    });
    return html.join('');
  }

  function fillCategoryTable(tbodyId, html, footId, footHtml) {
    var tb = $(tbodyId);
    if (!tb) return;
    tb.innerHTML = html;
    bindCatGroupToggles(tb);
    if (footId) setTableFoot(footId, footHtml);
  }

  function fillOrphan(wrapId, tbodyId, list, orphanMode, footId, footHtml) {
    var wrap = $(wrapId);
    var tb = $(tbodyId);
    if (!wrap || !tb) return;
    if (!list || !list.length) {
      wrap.classList.add('d-none');
      tb.innerHTML = '';
      if (footId) setTableFoot(footId, '');
      return;
    }
    wrap.classList.remove('d-none');
    fillCategoryTable(tbodyId, renderSimpleRows(list, orphanMode), footId, footHtml);
  }

  function fillPromoOrphan(wrapId, tbodyId, list, footId, footHtml) {
    var wrap = $(wrapId);
    var tb = $(tbodyId);
    if (!wrap || !tb) return;
    if (!list || !list.length) {
      wrap.classList.add('d-none');
      tb.innerHTML = '';
      if (footId) setTableFoot(footId, '');
      return;
    }
    wrap.classList.remove('d-none');
    fillCategoryTable(tbodyId, renderPromoRows(list, true), footId, footHtml);
  }

  function fillTable(tbodyId, rows, renderRow, colSpan, footId, footHtml) {
    var tb = $(tbodyId);
    if (!tb) return;
    var cs = colSpan || 4;
    if (!rows || !rows.length) {
      tb.innerHTML = '<tr><td colspan="' + cs + '" class="text-muted p-2">尚無資料</td></tr>';
      if (footId) setTableFoot(footId, '');
      return;
    }
    tb.innerHTML = rows.map(renderRow).join('');
    if (footId) setTableFoot(footId, footHtml || '');
  }

  function cacheKey() {
    var r = getDateRange();
    var catExtra = '';
    if ($('chkPublicOnly') && $('chkPublicOnly').checked) catExtra += 'p';
    if ($('chkIncludeInactive') && $('chkIncludeInactive').checked) catExtra += 'i';
    return r.from + '|' + r.to + '|' + catExtra;
  }

  async function loadCategory(headers, range) {
    var qs = new URLSearchParams();
    if (range.from) qs.set('from_date', range.from);
    if (range.to) qs.set('to_date', range.to);
    if ($('chkPublicOnly') && $('chkPublicOnly').checked) qs.set('public_only', '1');
    if ($('chkIncludeInactive') && $('chkIncludeInactive').checked) qs.set('include_inactive', '1');
    var res = await fetch('/api/admin/vendor-asset-category-stats?' + qs.toString(), { headers: headers });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || '分類統計載入失敗');
    showRangeMeta(data.from_date, data.to_date);
    var va = data.vendor_assets || {};
    var dd = data.design_drafts || {};
    var ps = data.promo_scenes || {};
    var vs = va.summary || {};
    $('vaOfficialProtoRec').textContent = vs.official_prototype_records != null ? vs.official_prototype_records : '—';
    $('vaVendorProtoRec').textContent = vs.vendor_prototype_records != null ? vs.vendor_prototype_records : '—';
    $('vaOfficialMatRec').textContent = vs.official_material_records != null ? vs.official_material_records : '—';
    $('vaVendorMatRec').textContent = vs.vendor_material_records != null ? vs.vendor_material_records : '—';
    $('ddRec').textContent = (dd.summary && dd.summary.records != null) ? dd.summary.records : '—';
    $('ddImg').textContent = (dd.summary && dd.summary.images != null) ? dd.summary.images : '—';
    $('psPromoPage').textContent = (ps.summary && ps.summary.promo_page != null) ? ps.summary.promo_page : '—';
    $('psPromoCamera').textContent = (ps.summary && ps.summary.promo_camera != null) ? ps.summary.promo_camera : '—';
    $('tabMetaVendor').textContent =
      '· 官 ' + (vs.official_prototype_records != null ? vs.official_prototype_records : '—')
      + ' / 廠 ' + (vs.vendor_prototype_records != null ? vs.vendor_prototype_records : '—');
    $('tabMetaDesign').textContent = '· ' + ((dd.summary && dd.summary.records != null) ? dd.summary.records : '—') + ' 筆';
    var promoTotal = ((ps.summary && ps.summary.promo_page) || 0) + ((ps.summary && ps.summary.promo_camera) || 0);
    $('tabMetaPromo').textContent = '· ' + (promoTotal || '—') + ' 張';
    $('secMetaCategory').textContent =
      '官原型 ' + (vs.official_prototype_records != null ? vs.official_prototype_records : '—')
      + ' / 廠原型 ' + (vs.vendor_prototype_records != null ? vs.vendor_prototype_records : '—');
    $('scanMeta').textContent = '掃描：素材 ' + (vs.asset_rows_scanned || 0) + '｜設計稿 ' + ((dd.summary && dd.summary.rows_scanned) || 0) + '｜情境圖 ' + ((ps.summary && ps.summary.rows_scanned) || 0);
    fillCategoryTable('tblVendor', renderVendorRows(va.categories), 'tfootVendor', renderVendorGrandTotal(vs));
    if (va.orphan_categories && va.orphan_categories.length) {
      $('orphanVendorWrap').classList.remove('d-none');
      var orphanVa = va.orphan_categories.map(function (c) {
        return {
          category_key: c.category_key,
          category_name: c.category_key,
          is_active: true,
          prototype_records: c.prototype_records,
          prototype_images: c.prototype_images,
          material_records: c.material_records,
          material_images: c.material_images,
          official_prototype_records: c.official_prototype_records,
          vendor_prototype_records: c.vendor_prototype_records,
          official_prototype_images: c.official_prototype_images,
          vendor_prototype_images: c.vendor_prototype_images,
          official_material_records: c.official_material_records,
          vendor_material_records: c.vendor_material_records,
          official_material_images: c.official_material_images,
          vendor_material_images: c.vendor_material_images,
          subcategories: c.subcategories || []
        };
      });
      fillCategoryTable('tblOrphanVendor', renderVendorRows(orphanVa), 'tfootOrphanVendor', renderVendorGrandTotal(sumVendorCategories(orphanVa)));
    } else {
      $('orphanVendorWrap').classList.add('d-none');
      $('tblOrphanVendor').innerHTML = '';
      setTableFoot('tfootOrphanVendor', '');
    }
    fillCategoryTable('tblDesign', renderSimpleRows(dd.categories, false), 'tfootDesign', renderSimpleGrandTotal(dd.summary));
    fillOrphan('orphanDesignWrap', 'tblOrphanDesign', dd.orphan_categories, true, 'tfootOrphanDesign',
      dd.orphan_categories && dd.orphan_categories.length ? renderSimpleGrandTotal({
        records: sumRowCounts(dd.orphan_categories, 'records'),
        images: sumRowCounts(dd.orphan_categories, 'images')
      }) : '');
    if (ps.promo_table_missing) {
      $('tblPromo').innerHTML = '<tr><td colspan="4" class="text-muted p-2">表不存在</td></tr>';
      setTableFoot('tfootPromo', '');
    } else {
      fillCategoryTable('tblPromo', renderPromoRows(ps.categories, false), 'tfootPromo', renderPromoGrandTotal(ps.summary));
      fillPromoOrphan('orphanPromoWrap', 'tblOrphanPromo', ps.orphan_categories, 'tfootOrphanPromo',
        ps.orphan_categories && ps.orphan_categories.length ? renderPromoGrandTotal({
          promo_page: sumRowCounts(ps.orphan_categories, 'promo_page'),
          promo_camera: sumRowCounts(ps.orphan_categories, 'promo_camera')
        }) : '');
    }
  }

  async function loadCombo(headers, range) {
    var qs = new URLSearchParams();
    if (range.from) qs.set('from_date', range.from);
    if (range.to) qs.set('to_date', range.to);
    var res = await fetch('/api/admin/material-combo-analytics?' + qs.toString(), { headers: headers });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || '材料組合載入失敗');
    showRangeMeta(data.from_date, data.to_date);
    var s = data.summary || {};
    $('sumTotal').textContent = s.total != null ? s.total : '—';
    $('sumGen').textContent = s.from_generations != null ? s.from_generations : '—';
    $('sumDesign').textContent = s.from_design_references != null ? s.from_design_references : '—';
    $('sumDual').textContent = s.dual_count != null ? s.dual_count : '—';
    $('sumTri').textContent = s.tri_count != null ? s.tri_count : '—';
    $('sumPalette').textContent = s.with_palette_source != null ? s.with_palette_source : '—';
    $('tabMetaComboOverview').textContent = '· 總 ' + (s.total != null ? s.total : '—');
    $('secMetaCombo').textContent = '總 ' + (s.total != null ? s.total : '—');
    var topMain = (data.top_main_materials && data.top_main_materials[0]) ? data.top_main_materials[0] : null;
    var topPair = (data.top_material_combinations && data.top_material_combinations[0]) ? data.top_material_combinations[0] : null;
    $('tabMetaComboMaterials').textContent = topMain ? ('· ' + topMain.label + ' ' + topMain.count) : '· —';
    $('tabMetaComboPairs').textContent = topPair ? ('· ' + topPair.count) : '· —';
    $('tabMetaComboPalette').textContent = '· ' + (s.with_palette_source != null ? s.with_palette_source : '—');
    if (data.generations_table_missing) {
      showMsg('材料組合生成表尚未建立；設計稿引用仍會統計。', false);
    }
    fillTable('tblMain', data.top_main_materials, function (r) {
      return '<tr><td class="col-label">' + esc(r.label) + '</td><td class="col-num">' + r.count + '</td></tr>';
    }, 2, 'tfootMain', renderCountGrandTotal('總計', sumRowCounts(data.top_main_materials, 'count')));
    fillTable('tblAccent', data.top_accent_materials, function (r) {
      return '<tr><td class="col-label">' + esc(r.label) + '</td><td class="col-num">' + r.count + '</td></tr>';
    }, 2, 'tfootAccent', renderCountGrandTotal('總計', sumRowCounts(data.top_accent_materials, 'count')));
    fillTable('tblPairs', data.top_material_combinations, function (r) {
      return '<tr><td class="col-label">' + esc(r.label) + '</td><td class="col-num">' + r.count + '</td></tr>';
    }, 2, 'tfootPairs', renderCountGrandTotal('總計', sumRowCounts(data.top_material_combinations, 'count')));
    fillTable('tblPalette', data.top_palette_sources, function (r) {
      return '<tr><td>' + esc(r.type_name) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.scope) + '</td><td class="col-num">' + r.count + '</td></tr>';
    }, 4, 'tfootPalette', '<tr><td colspan="3">總計</td><td class="col-num">' + sumRowCounts(data.top_palette_sources, 'count').toLocaleString() + '</td></tr>');
  }

  async function loadPoints(headers, range) {
    var qs = new URLSearchParams();
    if (range.from) qs.set('from_date', range.from);
    if (range.to) qs.set('to_date', range.to);
    var res = await fetch('/api/admin/points-usage-stats?' + qs.toString(), { headers: headers });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || '點數統計載入失敗');
    showRangeMeta(range.from, range.to);
    var stats = data.stats || [];
    var byLevel = data.by_level || [];
    var daily = data.daily_totals || [];
    $('pointsSummary').textContent = '共 ' + (data.total_count || 0).toLocaleString() + ' 筆、' + (data.total_points || 0).toLocaleString() + ' 點';
    $('secMetaPoints').textContent = (data.total_points || 0).toLocaleString() + ' 點';
    fillTable('tblPointsFunc', stats, function (s) {
      return '<tr><td>' + esc(s.description || '其他') + '</td><td class="col-num">' + (s.times || 0).toLocaleString() + '</td><td class="col-num">' + (s.total_points || 0).toLocaleString() + '</td><td class="col-num">' + (s.avg_points != null ? s.avg_points.toLocaleString() : '—') + '</td></tr>';
    }, 4, 'tfootPointsFunc', renderPointsFuncGrandTotal(data.total_count, data.total_points));
    fillTable('tblPointsLevel', byLevel, function (b) {
      return '<tr><td>' + esc(b.member_level || '一般') + '</td><td class="col-num">' + (b.user_count || 0).toLocaleString() + '</td><td class="col-num">' + (b.count || 0).toLocaleString() + '</td><td class="col-num">' + (b.total_points || 0).toLocaleString() + '</td><td class="col-num">' + (b.avg_per_user != null ? b.avg_per_user.toLocaleString() : '—') + '</td></tr>';
    }, 5, 'tfootPointsLevel', renderPointsLevelGrandTotal(byLevel));
    fillTable('tblPointsDaily', daily, function (d) {
      return '<tr><td>' + esc(d.date) + '</td><td class="col-num">' + (d.total_points || 0).toLocaleString() + '</td></tr>';
    }, 2, 'tfootPointsDaily', renderCountGrandTotal('總計', sumRowCounts(daily, 'total_points')));
  }

  async function loadActions(headers, range) {
    var qs = new URLSearchParams();
    if (range.from) qs.set('from_date', range.from);
    if (range.to) qs.set('to_date', range.to);
    var res = await fetch('/api/admin/design-action-stats?' + qs.toString(), { headers: headers });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || '設計行為載入失敗');
    showRangeMeta(range.from, range.to);
    var items = [
      ['找廠商訂製', data.find_vendor_count],
      ['再設計並生圖成功', data.redesign_generate_ok_count],
      ['IG 分享', data.share_instagram_count],
      ['Pinterest 分享', data.share_pinterest_count],
      ['FB 分享', data.share_facebook_count],
      ['Line 分享', data.share_line_count],
      ['複製連結', data.share_copy_link_count]
    ];
    var total = items.reduce(function (n, row) { return n + (row[1] || 0); }, 0);
    $('secMetaActions').textContent = total.toLocaleString() + ' 次';
    $('tblActions').innerHTML = items.map(function (row) {
      return '<tr><td>' + esc(row[0]) + '</td><td class="col-num">' + (row[1] != null ? row[1].toLocaleString() : '0') + '</td></tr>';
    }).join('');
    setTableFoot('tfootActions', renderCountGrandTotal('總計', total));
  }

  async function loadCurrentSection(force) {
    var section = getCurrentSection();
    var key = section + ':' + cacheKey();
    if (!force && loadedKey === key) return;
    var headers = await getAuthHeaders();
    if (!headers.Authorization) {
      showMsg('請先登入管理員帳號', true);
      return;
    }
    var range = getDateRange();
    showMsg('載入中…', false);
    try {
      if (section === 'category') await loadCategory(headers, range);
      else if (section === 'combo') await loadCombo(headers, range);
      else if (section === 'points') await loadPoints(headers, range);
      else if (section === 'actions') await loadActions(headers, range);
      loadedKey = key;
      hideMsg();
    } catch (e) {
      showMsg(e.message || '載入失敗', true);
    }
  }

  function init() {
    initSectionTabs();
    initSubTabs();
    $('btnLoad').addEventListener('click', function () {
      loadedKey = '';
      loadCurrentSection(true);
    });
    document.querySelectorAll('[data-range]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setQuickRange(btn.getAttribute('data-range'));
        loadedKey = '';
        loadCurrentSection(true);
      });
    });
    ['chkPublicOnly', 'chkIncludeInactive'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', function () { loadedKey = ''; loadCurrentSection(true); });
    });
    loadCurrentSection(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
