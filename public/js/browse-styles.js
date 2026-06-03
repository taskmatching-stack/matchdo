/**
 * 廠商公開款式瀏覽：嵌入 custom-product「廠商版型」Tab，或從 browse-styles.html 導向該 Tab。
 * 分類與「產品設計」Tab 共用 #imageCategoryMainSelect / #imageCategorySubSelect。
 */
(function (global) {
    'use strict';

    var state = {
        offset: 0,
        limit: 24,
        total: 0,
        manufacturerId: '',
        vendorName: '',
        embedded: false,
        mounted: false
    };

    function tr(key, fb) {
        if (typeof global.i18n !== 'undefined' && typeof global.i18n.t === 'function') {
            var v = global.i18n.t(key);
            if (v && v !== key) return v;
        }
        return fb || key;
    }

    function qs(name) {
        return new URLSearchParams(global.location.search).get(name) || '';
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function debounce(fn, ms) {
        var t;
        return function () {
            var args = arguments;
            var ctx = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    }

    function isEmbedded() {
        return !!document.getElementById('panel-vendor-styles');
    }

    function getCategoryKeys() {
        return {
            mainKey: (document.getElementById('imageCategoryMainSelect') || {}).value || '',
            subKey: (document.getElementById('imageCategorySubSelect') || {}).value || ''
        };
    }

    function categoryLabel(key, fb) {
        if (!key) return fb || '';
        var k = 'category.' + String(key);
        return tr(k, fb || key);
    }

    function updateCategorySummary() {
        var box = document.getElementById('bs-category-summary');
        var mainEl = document.getElementById('bs-cat-main-label');
        var subEl = document.getElementById('bs-cat-sub-label');
        if (!box || !mainEl || !subEl) return;
        var cats = getCategoryKeys();
        if (!cats.mainKey) {
            box.classList.add('d-none');
            return;
        }
        var data = (typeof CustomProductCatPicker !== 'undefined' && CustomProductCatPicker.getCategoriesData)
            ? CustomProductCatPicker.getCategoriesData() : [];
        var cat = data.find(function (c) { return String(c.key) === String(cats.mainKey); });
        var sub = cat && cat.subcategories
            ? cat.subcategories.find(function (s) { return String(s.key) === String(cats.subKey); })
            : null;
        mainEl.textContent = categoryLabel(cats.mainKey, cat ? cat.name : cats.mainKey);
        subEl.textContent = cats.subKey
            ? categoryLabel(cats.subKey, sub ? sub.name : cats.subKey)
            : '—';
        box.classList.remove('d-none');
    }

    function getFilters() {
        var cats = getCategoryKeys();
        return {
            category_key: cats.mainKey || '',
            subcategory_key: cats.subKey || '',
            manufacturer_id: (document.getElementById('bs-filter-vendor') || {}).value || state.manufacturerId || '',
            q: (document.getElementById('bs-filter-q') || {}).value || ''
        };
    }

    function buildQuery(extra) {
        var f = getFilters();
        var p = new URLSearchParams();
        if (f.category_key) p.set('category_key', f.category_key);
        if (f.subcategory_key) p.set('subcategory_key', f.subcategory_key);
        var mid = f.manufacturer_id || state.manufacturerId;
        if (mid) p.set('manufacturer_id', mid);
        if (f.q) p.set('q', f.q);
        p.set('limit', String(state.limit));
        p.set('offset', String(state.offset));
        if (extra) Object.keys(extra).forEach(function (k) { p.set(k, extra[k]); });
        return p.toString();
    }

    function fillVendorSelect(manufacturers) {
        var sel = document.getElementById('bs-filter-vendor');
        if (!sel) return;
        var cur = sel.value || state.manufacturerId;
        sel.innerHTML = '<option value="">' + esc(tr('browseStyles.filterAllVendors', '全部廠商')) + '</option>';
        (manufacturers || []).forEach(function (m) {
            var opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name || m.id;
            sel.appendChild(opt);
        });
        if (cur) sel.value = cur;
        if (state.manufacturerId && !sel.value) sel.value = state.manufacturerId;
    }

    function showVendorBanner() {
        var el = document.getElementById('bs-vendor-banner');
        if (!el || !state.manufacturerId) return;
        var name = state.vendorName || tr('browseStyles.vendorDefault', '此廠商');
        var clearLbl = tr('browseStyles.clearVendorFilter', '顯示全部廠商');
        var clearUrl = '/custom-product.html?tab=vendor-styles';
        el.innerHTML = '<span><i class="bi bi-building me-1"></i>' +
            esc(tr('browseStyles.vendorFilterBanner', '目前僅顯示「{name}」的款式').replace('{name}', name)) +
            '</span> <a href="' + esc(clearUrl) + '" class="ms-2 small">' + esc(clearLbl) + '</a>';
        el.classList.remove('d-none');
    }

    function renderPager() {
        var nav = document.getElementById('bs-pager');
        if (!nav) return;
        nav.innerHTML = '';
        if (state.total <= state.limit) {
            nav.classList.add('d-none');
            return;
        }
        nav.classList.remove('d-none');
        var prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'btn btn-sm btn-outline-secondary';
        prev.disabled = state.offset <= 0;
        prev.textContent = tr('browseStyles.prevPage', '上一頁');
        prev.addEventListener('click', function () {
            state.offset = Math.max(0, state.offset - state.limit);
            loadItems();
        });
        var info = document.createElement('span');
        info.className = 'align-self-center small text-muted px-2';
        var page = Math.floor(state.offset / state.limit) + 1;
        var pages = Math.max(1, Math.ceil(state.total / state.limit));
        info.textContent = page + ' / ' + pages;
        var next = document.createElement('button');
        next.type = 'button';
        next.className = 'btn btn-sm btn-outline-secondary';
        next.disabled = state.offset + state.limit >= state.total;
        next.textContent = tr('browseStyles.nextPage', '下一頁');
        next.addEventListener('click', function () {
            state.offset += state.limit;
            loadItems();
        });
        nav.appendChild(prev);
        nav.appendChild(info);
        nav.appendChild(next);
    }

    function renderGrid(items) {
        var grid = document.getElementById('bs-grid');
        var empty = document.getElementById('bs-empty');
        var loading = document.getElementById('bs-loading');
        if (loading) loading.classList.add('d-none');
        if (!items.length) {
            if (grid) grid.classList.add('d-none');
            if (empty) empty.classList.remove('d-none');
            return;
        }
        if (empty) empty.classList.add('d-none');
        if (!grid) return;
        grid.classList.remove('d-none');
        grid.innerHTML = '';
        var returnTo = encodeURIComponent('/custom-product.html?tab=product-design');
        items.forEach(function (it) {
            var guideUrl = '/product-tree.html?prototype_asset_id=' + encodeURIComponent(it.id) + '&return_to=' + returnTo;
            var thumb = it.image_url
                ? '<img src="' + esc(it.image_url) + '" alt="">'
                : '<i class="bi bi-image text-muted fs-2"></i>';
            var mTpl = tr('browseStyles.linkSummary', '材料 {m} · 配件 {p}');
            var linkLbl = mTpl.replace('{m}', String(it.material_count || 0)).replace('{p}', String(it.part_count || 0));
            var card = document.createElement('article');
            card.className = 'bs-card';
            var profileUrl = it.manufacturer_profile_url || ('/vendor-profile.html?id=' + encodeURIComponent(it.manufacturer_id || ''));
            card.innerHTML =
                '<a href="' + esc(guideUrl) + '" class="text-decoration-none text-dark">' +
                '<div class="bs-card-thumb">' + thumb + '</div></a>' +
                '<div class="bs-card-body">' +
                '<div class="bs-card-title">' + esc(it.title || '') + '</div>' +
                '<div class="bs-card-vendor"><a href="' + esc(profileUrl) + '">' + esc(it.manufacturer_name || '') + '</a></div>' +
                '<div class="bs-card-badges"><span class="badge bg-light text-secondary border">' + esc(linkLbl) + '</span></div>' +
                '</div>' +
                '<div class="bs-card-actions">' +
                '<a href="' + esc(guideUrl) + '" class="btn btn-sm btn-primary w-100">' +
                esc(tr('browseStyles.viewMatchGuide', '看可搭配')) + '</a></div>';
            grid.appendChild(card);
        });
    }

    async function loadItems() {
        updateCategorySummary();
        var cats = getCategoryKeys();
        var loading = document.getElementById('bs-loading');
        var empty = document.getElementById('bs-empty');
        var grid = document.getElementById('bs-grid');
        var alertEl = document.getElementById('bs-alert');
        if (!cats.mainKey) {
            if (loading) loading.classList.add('d-none');
            if (grid) grid.classList.add('d-none');
            if (empty) {
                empty.classList.remove('d-none');
                empty.querySelector('p').textContent = tr('customProduct.vendorStylesPickCategoryFirst', '請先到「產品設計」Tab 選擇主分類與子分類。');
            }
            return;
        }
        if (loading) loading.classList.remove('d-none');
        if (alertEl) alertEl.classList.add('d-none');
        if (empty) empty.classList.add('d-none');
        try {
            var r = await fetch('/api/vendor-assets/browse-prototypes?' + buildQuery());
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok) throw new Error(data.error || tr('browseStyles.loadFailed', '載入失敗'));
            state.total = data.total || 0;
            fillVendorSelect(data.manufacturers || []);
            renderGrid(data.items || []);
            renderPager();
        } catch (e) {
            if (alertEl) {
                alertEl.textContent = e.message;
                alertEl.classList.remove('d-none');
            }
            if (loading) loading.classList.add('d-none');
        }
    }

    function onFilterChange() {
        state.offset = 0;
        loadItems();
    }

    function wireControls() {
        var vendorSel = document.getElementById('bs-filter-vendor');
        var qInput = document.getElementById('bs-filter-q');
        var goCat = document.getElementById('bs-go-set-category');
        if (vendorSel) vendorSel.addEventListener('change', onFilterChange);
        if (qInput) qInput.addEventListener('input', debounce(onFilterChange, 400));
        if (goCat) {
            goCat.addEventListener('click', function () {
                var tabEl = document.getElementById('tab-product-design');
                if (tabEl && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                    bootstrap.Tab.getOrCreateInstance(tabEl).show();
                }
            });
        }
        document.addEventListener('matchdo:categoryChanged', function () {
            onFilterChange();
        });
        var tabVendor = document.getElementById('tab-vendor-styles');
        if (tabVendor) {
            tabVendor.addEventListener('shown.bs.tab', function () {
                loadItems();
            });
        }
    }

    function mountEmbedded() {
        if (state.mounted) return;
        state.mounted = true;
        state.embedded = true;
        state.manufacturerId = qs('manufacturer_id');
        state.vendorName = qs('vendor_name');
        if (state.manufacturerId) showVendorBanner();
        wireControls();
        if (qs('tab') === 'vendor-styles') {
            loadItems();
        }
    }

    function redirectStandalone() {
        var p = new URLSearchParams(global.location.search);
        p.set('tab', 'vendor-styles');
        global.location.replace('/custom-product.html?' + p.toString());
    }

    function init() {
        if (global.i18n && typeof global.i18n.applyPage === 'function') global.i18n.applyPage();
        if (isEmbedded()) {
            mountEmbedded();
            return;
        }
        if (document.body && document.body.classList.contains('browse-styles-page')) {
            redirectStandalone();
        }
    }

    global.VendorStyleBrowse = { loadItems: loadItems, mountEmbedded: mountEmbedded };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(typeof window !== 'undefined' ? window : this);
