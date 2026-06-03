(function () {
    'use strict';

    var state = {
        categories: [],
        offset: 0,
        limit: 24,
        total: 0,
        manufacturerId: '',
        vendorName: ''
    };

    function tr(key, fb) {
        if (typeof window.i18n !== 'undefined' && typeof window.i18n.t === 'function') {
            var v = window.i18n.t(key);
            if (v && v !== key) return v;
        }
        return fb || key;
    }

    function qs(name) {
        return new URLSearchParams(window.location.search).get(name) || '';
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

    function getFilters() {
        return {
            category_key: (document.getElementById('bs-filter-category') || {}).value || '',
            subcategory_key: (document.getElementById('bs-filter-subcategory') || {}).value || '',
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

    function fillCategorySelects() {
        var catSel = document.getElementById('bs-filter-category');
        var subSel = document.getElementById('bs-filter-subcategory');
        if (!catSel || !subSel) return;
        var curCat = catSel.value;
        var curSub = subSel.value;
        catSel.innerHTML = '<option value="">' + esc(tr('browseStyles.filterAll', '全部')) + '</option>';
        state.categories.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.key;
            opt.textContent = c.label || c.key;
            catSel.appendChild(opt);
        });
        if (curCat) catSel.value = curCat;
        refreshSubcategoryOptions();
        if (curSub) subSel.value = curSub;
    }

    function refreshSubcategoryOptions() {
        var catSel = document.getElementById('bs-filter-category');
        var subSel = document.getElementById('bs-filter-subcategory');
        if (!catSel || !subSel) return;
        var catKey = catSel.value;
        subSel.innerHTML = '<option value="">' + esc(tr('browseStyles.filterAll', '全部')) + '</option>';
        if (!catKey) {
            subSel.disabled = true;
            return;
        }
        var cat = state.categories.find(function (c) { return c.key === catKey; });
        var subs = (cat && cat.subcategories) ? cat.subcategories : [];
        subs.forEach(function (s) {
            var opt = document.createElement('option');
            opt.value = s.key;
            opt.textContent = s.label || s.key;
            subSel.appendChild(opt);
        });
        subSel.disabled = !subs.length;
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
        el.innerHTML = '<span><i class="bi bi-building me-1"></i>' +
            esc(tr('browseStyles.vendorFilterBanner', '目前僅顯示「{name}」的款式').replace('{name}', name)) +
            '</span> <a href="/browse-styles.html" class="ms-2 small">' + esc(clearLbl) + '</a>';
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
        items.forEach(function (it) {
            var returnTo = encodeURIComponent('/custom-product.html');
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

    async function loadCategories() {
        try {
            var r = await fetch('/api/categories', { cache: 'no-store' });
            var data = await r.json().catch(function () { return {}; });
            var list = Array.isArray(data.categories) ? data.categories : [];
            state.categories = list.map(function (c) {
                return {
                    key: c.key,
                    label: c.name || c.key,
                    subcategories: (c.sub || []).map(function (sk) {
                        return { key: sk, label: sk };
                    })
                };
            });
        } catch (e) {
            state.categories = [];
        }
        fillCategorySelects();
        var catFromUrl = qs('category_key');
        var subFromUrl = qs('subcategory_key');
        if (catFromUrl) {
            var catSel = document.getElementById('bs-filter-category');
            if (catSel) catSel.value = catFromUrl;
            refreshSubcategoryOptions();
            if (subFromUrl) {
                var subSel = document.getElementById('bs-filter-subcategory');
                if (subSel) subSel.value = subFromUrl;
            }
        }
    }

    async function loadItems() {
        var loading = document.getElementById('bs-loading');
        var alertEl = document.getElementById('bs-alert');
        if (loading) loading.classList.remove('d-none');
        if (alertEl) alertEl.classList.add('d-none');
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
            document.getElementById('bs-loading').classList.add('d-none');
        }
    }

    function onFilterChange() {
        state.offset = 0;
        loadItems();
    }

    function init() {
        if (window.i18n && typeof window.i18n.applyPage === 'function') window.i18n.applyPage();
        state.manufacturerId = qs('manufacturer_id');
        state.vendorName = qs('vendor_name');
        if (state.manufacturerId) showVendorBanner();
        var catSel = document.getElementById('bs-filter-category');
        var subSel = document.getElementById('bs-filter-subcategory');
        var vendorSel = document.getElementById('bs-filter-vendor');
        var qInput = document.getElementById('bs-filter-q');
        if (catSel) catSel.addEventListener('change', function () {
            refreshSubcategoryOptions();
            onFilterChange();
        });
        if (subSel) subSel.addEventListener('change', onFilterChange);
        if (vendorSel) vendorSel.addEventListener('change', onFilterChange);
        if (qInput) qInput.addEventListener('input', debounce(onFilterChange, 400));
        loadCategories().then(loadItems);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
