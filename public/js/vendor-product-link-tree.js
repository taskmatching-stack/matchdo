(function () {
    'use strict';

    var MODE = (document.body && document.body.getAttribute('data-vplt-mode')) || 'guide';
    var IS_VENDOR = MODE === 'vendor';

    var state = {
        prototypes: [],
        assets: [],
        links: [],
        orphans: [],
        checks: [],
        selectedPrototypeId: null,
        draftLinkedIds: [],
        dirty: false,
        token: null,
        guideManufacturerName: '',
        guideSelectedIds: [],
        guidePayload: null
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

    function kindLabel(kind) {
        if (kind === 'material') return tr('productTree.kindMaterial', '材料');
        if (kind === 'part') return tr('productTree.kindPart', '配件');
        return kind || '';
    }

    function assetImageItems(a) {
        if (!a) return [];
        if (Array.isArray(a.image_items) && a.image_items.length) {
            return a.image_items.filter(function (it) { return it && it.url; });
        }
        if (Array.isArray(a.image_urls) && a.image_urls.length) {
            return a.image_urls.map(function (u, i) {
                return { url: u, label: '', sort_order: i, is_cover: i === 0 };
            });
        }
        var u = (a.image_url || '').trim();
        return u ? [{ url: u, label: '', sort_order: 0, is_cover: true }] : [];
    }

    function assetLightboxCaption(a) {
        if (!a) return '';
        var parts = [(a.title || '').trim(), kindLabel(a.asset_kind)];
        var desc = (a.description || '').trim();
        if (desc) parts.push(desc.length > 160 ? desc.slice(0, 160) + '…' : desc);
        return parts.filter(Boolean).join(' · ');
    }

    function dataImageItemsAttr(a) {
        var items = assetImageItems(a);
        if (!items.length) return '';
        return ' data-image-items="' + esc(JSON.stringify(items)) + '"';
    }

    function enlargeImgHtml(a, className, style) {
        var items = assetImageItems(a);
        if (!items.length) return '';
        var cap = assetLightboxCaption(a);
        var cls = 'matchdo-enlarge-trigger' + (className ? ' ' + className : '');
        var st = style ? ' style="' + style + '"' : '';
        var title = esc(tr('baseModels.clickImageEnlarge', '點擊放大'));
        return '<img src="' + esc(items[0].url) + '" alt="" class="' + cls + '"' + st +
            dataImageItemsAttr(a) +
            ' data-lightbox-caption="' + esc(cap) + '" title="' + title + '" loading="lazy">';
    }

    function assetById(id) {
        return state.assets.find(function (a) { return a.id === id; }) || null;
    }

    function prototypeById(id) {
        return state.prototypes.find(function (p) { return p.id === id; }) || null;
    }

    function linkedIdsForPrototype(prototypeId) {
        if (IS_VENDOR && state.selectedPrototypeId === prototypeId && state.dirty) {
            return state.draftLinkedIds.slice();
        }
        return state.links
            .filter(function (l) { return l.prototype_asset_id === prototypeId; })
            .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
            .map(function (l) { return l.linked_asset_id; });
    }

    function setDirty(linkedIds) {
        state.draftLinkedIds = linkedIds.slice();
        state.dirty = true;
        var btn = document.getElementById('btn-save-links');
        if (btn) btn.disabled = false;
        renderCanvas();
        renderChecks();
        renderPrototypeList();
    }

    function addLink(assetId) {
        if (!state.selectedPrototypeId || !assetId) return;
        var ids = linkedIdsForPrototype(state.selectedPrototypeId);
        if (ids.indexOf(assetId) >= 0) return;
        ids.push(assetId);
        if (IS_VENDOR) setDirty(ids);
        else renderCanvas();
    }

    function removeLink(assetId) {
        if (!state.selectedPrototypeId) return;
        var ids = linkedIdsForPrototype(state.selectedPrototypeId).filter(function (id) { return id !== assetId; });
        if (IS_VENDOR) setDirty(ids);
        else renderCanvas();
    }

    function showAlert(msg, kind) {
        var el = document.getElementById('vplt-alert');
        if (!el) return;
        el.className = 'alert alert-' + (kind || 'warning');
        el.textContent = msg;
        el.classList.remove('d-none');
    }

    function hideAlert() {
        var el = document.getElementById('vplt-alert');
        if (el) el.classList.add('d-none');
    }

    function renderPrototypeList() {
        var root = document.getElementById('vplt-prototype-list');
        if (!root) return;
        root.innerHTML = '';
        if (!state.prototypes.length) {
            root.innerHTML = '<p class="text-muted small">' + esc(tr('productTree.noPrototypes', '尚無主產品')) + '</p>';
            return;
        }
        state.prototypes.forEach(function (p) {
            var linkCount = linkedIdsForPrototype(p.id).length;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'vplt-prototype-item' + (p.id === state.selectedPrototypeId ? ' active' : '');
            var thumb = assetImageItems(p).length
                ? enlargeImgHtml(p, '', 'width:40px;height:40px;object-fit:cover;border-radius:6px')
                : '<span class="rounded bg-light d-inline-block" style="width:40px;height:40px"></span>';
            btn.innerHTML = thumb +
                '<span class="flex-grow-1 min-w-0"><span class="vplt-proto-title d-block">' + esc(p.title || p.id) + '</span>' +
                '<span class="text-muted" style="font-size:.7rem">' + linkCount + ' ' + esc(tr('productTree.linkCount', '項關聯')) + '</span></span>';
            btn.addEventListener('click', function () {
                selectPrototype(p.id);
            });
            root.appendChild(btn);
        });
    }

    function renderCanvas() {
        var canvas = document.getElementById('vplt-canvas');
        if (!canvas) return;
        canvas.classList.remove('vplt-drop-target');
        var pid = state.selectedPrototypeId;
        var proto = prototypeById(pid);
        if (!proto) {
            canvas.innerHTML = '<p class="text-muted">' + esc(tr('productTree.pickPrototype', '請選擇左側主產品')) + '</p>';
            return;
        }
        var linkedIds = linkedIdsForPrototype(pid);
        var childrenHtml = '';
        if (!linkedIds.length) {
            childrenHtml = '<div class="vplt-empty-children">' + esc(tr('productTree.noLinksYet', '尚未關聯材料或配件')) + '</div>';
        } else {
            childrenHtml = '<div class="vplt-children">';
            linkedIds.forEach(function (aid) {
                var a = assetById(aid);
                if (!a) return;
                var k = a.asset_kind;
                var removeBtn = IS_VENDOR
                    ? '<button type="button" class="btn btn-sm btn-link text-danger vplt-child-remove" data-remove="' + esc(aid) + '" title="移除">&times;</button>'
                    : '';
                var picked = !IS_VENDOR && state.guideSelectedIds.indexOf(aid) >= 0;
                var clickCls = !IS_VENDOR ? ' vplt-child-card--clickable' : '';
                var pickCls = picked ? ' vplt-child-card--picked' : '';
                childrenHtml += '<div class="vplt-child-card vplt-child-card--' + esc(k) + clickCls + pickCls + '" data-guide-asset="' + esc(aid) + '">' + removeBtn +
                    '<span class="badge bg-light text-secondary vplt-kind-badge">' + esc(kindLabel(k)) + '</span>' +
                    (assetImageItems(a).length
                        ? enlargeImgHtml(a, 'vplt-card-thumb', '')
                        : '<div class="bg-light rounded mx-auto mb-1" style="width:72px;height:72px"></div>') +
                    '<div class="vplt-child-title">' + esc(a.title || aid) + '</div></div>';
            });
            childrenHtml += '</div>';
        }
        canvas.innerHTML =
            '<div class="vplt-root-card" id="vplt-root-drop">' +
            (assetImageItems(proto).length ? enlargeImgHtml(proto, 'vplt-root-thumb', '') : '') +
            '<div class="fw-semibold">' + esc(proto.title || '') + '</div>' +
            '<div class="small text-muted">' + esc(tr('productTree.rootLabel', '主產品')) + '</div></div>' +
            childrenHtml;

        canvas.querySelectorAll('[data-remove]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                removeLink(btn.getAttribute('data-remove'));
            });
        });

        if (!IS_VENDOR) {
            canvas.querySelectorAll('[data-guide-asset]').forEach(function (card) {
                card.addEventListener('click', function (e) {
                    if (e.target.closest('img.matchdo-enlarge-trigger')) return;
                    toggleGuideSelection(card.getAttribute('data-guide-asset'));
                });
            });
        }

        if (IS_VENDOR) {
            var dropRoot = document.getElementById('vplt-root-drop');
            if (dropRoot) {
                dropRoot.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    canvas.classList.add('vplt-drop-target');
                });
                dropRoot.addEventListener('dragleave', function () {
                    canvas.classList.remove('vplt-drop-target');
                });
                dropRoot.addEventListener('drop', function (e) {
                    e.preventDefault();
                    canvas.classList.remove('vplt-drop-target');
                    var aid = e.dataTransfer.getData('text/vnd.asset-id');
                    if (aid) addLink(aid);
                });
            }
        }
    }

    function renderChecks() {
        var box = document.getElementById('vplt-checks');
        if (!box) return;
        box.innerHTML = '';
        var pid = state.selectedPrototypeId;
        if (!pid) return;
        var items = [];
        var linkN = linkedIdsForPrototype(pid).length;
        if (!linkN) {
            items.push(tr('productTree.checkNoLinks', '尚未關聯材料或配件'));
        }
        var orphanInPool = state.orphans.length;
        if (IS_VENDOR && orphanInPool) {
            items.push(tr('productTree.checkOrphans', '有 {n} 筆素材未掛到任何主產品').replace('{n}', String(orphanInPool)));
        }
        if (!items.length) {
            box.innerHTML = '<p class="text-success mb-0"><i class="bi bi-check-circle me-1"></i>' +
                esc(tr('productTree.checkOk', '此主產品已有關聯')) + '</p>';
            return;
        }
        var ul = document.createElement('ul');
        ul.className = 'mb-0 ps-3';
        items.forEach(function (t) {
            var li = document.createElement('li');
            li.textContent = t;
            ul.appendChild(li);
        });
        box.appendChild(ul);
    }

    function renderOrphanPool() {
        var pool = document.getElementById('vplt-orphan-pool');
        if (!pool || !IS_VENDOR) return;
        pool.innerHTML = '';
        var orphans = state.assets.filter(function (a) {
            return state.orphans.indexOf(a.id) >= 0 || !state.links.some(function (l) { return l.linked_asset_id === a.id; });
        });
        var linkedSet = new Set(linkedIdsForPrototype(state.selectedPrototypeId));
        orphans = orphans.filter(function (a) { return !linkedSet.has(a.id); });
        if (!orphans.length) {
            pool.innerHTML = '<p class="text-muted small mb-0">' + esc(tr('productTree.noOrphans', '無未關聯素材')) + '</p>';
            return;
        }
        orphans.forEach(function (a) {
            var row = document.createElement('div');
            row.className = 'vplt-orphan-item';
            row.draggable = true;
            row.setAttribute('data-asset-id', a.id);
            row.innerHTML = (assetImageItems(a).length
                ? enlargeImgHtml(a, 'vplt-orphan-thumb', 'width:36px;height:36px;object-fit:cover;border-radius:4px')
                : '') +
                '<span class="text-truncate flex-grow-1">' + esc(a.title || a.id) + ' <span class="text-muted">(' + esc(kindLabel(a.asset_kind)) + ')</span></span>' +
                '<button type="button" class="btn btn-sm btn-outline-primary py-0">+</button>';
            row.addEventListener('dragstart', function (e) {
                e.dataTransfer.setData('text/vnd.asset-id', a.id);
            });
            row.querySelector('button').addEventListener('click', function () { addLink(a.id); });
            pool.appendChild(row);
        });
    }

    function selectPrototype(id) {
        if (state.dirty && IS_VENDOR) {
            if (!window.confirm(tr('productTree.discardDirty', '有未儲存的關聯變更，要切換主產品嗎？'))) return;
        }
        state.selectedPrototypeId = id;
        state.draftLinkedIds = linkedIdsForPrototype(id);
        state.dirty = false;
        var btn = document.getElementById('btn-save-links');
        if (btn) btn.disabled = true;
        renderPrototypeList();
        renderCanvas();
        renderChecks();
        renderOrphanPool();
    }

    function toggleGuideSelection(assetId) {
        if (!assetId) return;
        var idx = state.guideSelectedIds.indexOf(assetId);
        if (idx >= 0) state.guideSelectedIds.splice(idx, 1);
        else state.guideSelectedIds.push(assetId);
        renderCanvas();
        renderGuidePanel();
    }

    function renderGuidePanel() {
        if (IS_VENDOR) return;
        var summary = document.getElementById('vplt-guide-summary');
        var selRoot = document.getElementById('vplt-guide-selected');
        var data = state.guidePayload;
        if (summary && data) {
            var tpl = tr('productTree.guideSummary', '材料 {m} 項 · 配件 {p} 項');
            summary.textContent = tpl
                .replace('{m}', String(data.material_count != null ? data.material_count : 0))
                .replace('{p}', String(data.part_count != null ? data.part_count : 0));
        }
        if (!selRoot) return;
        selRoot.innerHTML = '';
        if (!state.guideSelectedIds.length) {
            selRoot.innerHTML = '<p class="text-muted small mb-0">' + esc(tr('productTree.guideNoneSelected', '尚未點選')) + '</p>';
            return;
        }
        state.guideSelectedIds.forEach(function (aid) {
            var a = assetById(aid);
            if (!a) return;
            var row = document.createElement('div');
            row.className = 'vplt-guide-sel-item';
            row.innerHTML = (assetImageItems(a).length
                ? enlargeImgHtml(a, 'vplt-guide-sel-thumb', 'width:32px;height:32px;object-fit:cover;border-radius:4px')
                : '') +
                '<span class="flex-grow-1 text-truncate">' + esc(a.title || aid) + ' <span class="text-muted">(' + esc(kindLabel(a.asset_kind)) + ')</span></span>' +
                '<button type="button" class="btn btn-sm btn-link text-danger py-0">&times;</button>';
            row.querySelector('button').addEventListener('click', function (e) {
                e.stopPropagation();
                toggleGuideSelection(aid);
            });
            selRoot.appendChild(row);
        });
    }

    function buildStartDesignUrl(p) {
        if (!p || !p.id) return '/custom-product.html';
        var ret = qs('return_to');
        if (ret) {
            try {
                var decoded = decodeURIComponent(ret);
                var u = new URL(decoded, window.location.origin);
                u.searchParams.set('prototype_asset_id', p.id);
                if (p.manufacturer_id) u.searchParams.set('manufacturer_id', p.manufacturer_id);
                return u.pathname + u.search + u.hash;
            } catch (e) { /* fall through */ }
        }
        var designUrl = '/custom-product.html?prototype_asset_id=' + encodeURIComponent(p.id);
        if (p.manufacturer_id) {
            designUrl += '&manufacturer_id=' + encodeURIComponent(p.manufacturer_id);
        }
        return designUrl;
    }

    function persistGuideSelectionForDesign() {
        if (!state.guideSelectedIds.length) {
            try { sessionStorage.removeItem('matchdo.guideLinkedAssetIds'); } catch (e) {}
            return;
        }
        try {
            sessionStorage.setItem('matchdo.guideLinkedAssetIds', JSON.stringify(state.guideSelectedIds));
        } catch (e) {}
    }

    function wireStartDesignButton(p) {
        var startBtn = document.getElementById('btn-start-design');
        if (!startBtn || !p || !p.id) return;
        startBtn.href = buildStartDesignUrl(p);
        var ret = qs('return_to');
        var lbl = startBtn.querySelector('[data-i18n="productTree.startDesign"]') || startBtn.querySelector('span');
        if (lbl && ret) {
            lbl.textContent = tr('productTree.startDesignBack', '回到設計並帶入此款');
        } else if (lbl) {
            lbl.textContent = tr('productTree.startDesign', '用此款開始設計');
        }
        if (!startBtn.__vpltStartWired) {
            startBtn.__vpltStartWired = true;
            startBtn.addEventListener('click', persistGuideSelectionForDesign);
        }
    }

    function updateGuideChrome(data) {
        var p = data && data.prototype;
        if (p && p.title) {
            document.title = (p.title + ' - ' + tr('productTree.guideTitle', '看可搭配'));
        }
        var chip = document.getElementById('vplt-vendor-chip');
        if (chip && p) {
            var mname = p.manufacturer_name || state.guideManufacturerName || '';
            if (mname) {
                var profile = p.manufacturer_id ? '/vendor-profile.html?id=' + encodeURIComponent(p.manufacturer_id) : '#';
                chip.innerHTML = '<i class="bi bi-building me-1"></i>' + tr('productTree.byVendor', '廠商：') +
                    '<a href="' + esc(profile) + '">' + esc(mname) + '</a>';
                chip.classList.remove('d-none');
            }
        }
        wireStartDesignButton(p);
        var hintEl = document.getElementById('vplt-start-design-hint');
        if (hintEl) hintEl.classList.remove('d-none');
        var changeBtn = document.getElementById('btn-change-style');
        if (changeBtn && p && p.manufacturer_id) {
            changeBtn.href = '/custom-product.html?tab=vendor-styles&manufacturer_id=' + encodeURIComponent(p.manufacturer_id);
        }
        if (document.body) document.body.classList.add('vplt-page--single');
    }

    function applyGuidePayload(data) {
        state.guidePayload = data;
        var p = data.prototype;
        state.guideManufacturerName = p.manufacturer_name || '';
        state.prototypes = [{
            id: p.id,
            title: p.title,
            description: p.description,
            image_url: p.image_url,
            image_urls: p.image_urls,
            image_items: p.image_items,
            asset_kind: 'prototype',
            manufacturer_id: p.manufacturer_id,
            manufacturer_name: p.manufacturer_name
        }];
        state.assets = (data.linked_assets || []).map(function (a) {
            return {
                id: a.id,
                title: a.title,
                description: a.description,
                image_url: a.image_url,
                image_urls: a.image_urls,
                image_items: a.image_items,
                asset_kind: a.asset_kind
            };
        });
        state.links = (data.linked_assets || []).map(function (a, idx) {
            return {
                prototype_asset_id: p.id,
                linked_asset_id: a.id,
                sort_order: a.sort_order != null ? a.sort_order : idx
            };
        });
        state.orphans = [];
        state.checks = [];
        state.guideSelectedIds = [];
        updateGuideChrome(data);
        selectPrototype(p.id);
        renderGuidePanel();
    }

    function normalizeAssetNode(a) {
        if (!a) return a;
        return {
            id: a.id,
            title: a.title,
            description: a.description,
            image_url: a.image_url,
            image_urls: a.image_urls,
            image_items: a.image_items,
            asset_kind: a.asset_kind,
            is_public: a.is_public
        };
    }

    function applyVendorPayload(data) {
        state.prototypes = (data.prototypes || []).map(normalizeAssetNode);
        state.assets = (data.assets || []).map(normalizeAssetNode);
        state.links = data.links || [];
        state.orphans = data.orphans || [];
        state.checks = data.checks || [];
        var pre = qs('prototype_asset_id') || qs('highlight') || '';
        var pick = pre && state.prototypes.some(function (p) { return p.id === pre; }) ? pre : (state.prototypes[0] && state.prototypes[0].id);
        if (pick) selectPrototype(pick);
        else renderPrototypeList();
    }

    async function loadVendorTree() {
        var headers = { Authorization: 'Bearer ' + state.token };
        var r = await fetch('/api/me/vendor-product-link-tree', { headers: headers });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(data.error || '載入失敗');
        if (!data.table_ready) {
            showAlert(tr('productTree.needMigration', '請先執行 docs/add-vendor-asset-prototype-links.sql'), 'danger');
        }
        applyVendorPayload(data);
    }

    async function loadGuideTree() {
        var pid = qs('prototype_asset_id');
        if (!pid) {
            window.location.replace('/custom-product.html?tab=vendor-styles');
            return;
        }
        var r = await fetch('/api/vendor-assets/' + encodeURIComponent(pid) + '/link-tree');
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) {
            showAlert(data.error || tr('productTree.loadFailed', '載入失敗'), 'danger');
            return;
        }
        applyGuidePayload(data);
    }

    async function saveLinks() {
        if (!state.selectedPrototypeId || !state.token) return;
        var btn = document.getElementById('btn-save-links');
        if (btn) btn.disabled = true;
        try {
            var r = await fetch('/api/me/vendor-assets/' + encodeURIComponent(state.selectedPrototypeId) + '/prototype-links', {
                method: 'PUT',
                headers: {
                    Authorization: 'Bearer ' + state.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ linked_asset_ids: state.draftLinkedIds })
            });
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok) throw new Error(data.error || '儲存失敗');
            state.links = state.links.filter(function (l) { return l.prototype_asset_id !== state.selectedPrototypeId; });
            state.draftLinkedIds.forEach(function (aid, idx) {
                state.links.push({
                    prototype_asset_id: state.selectedPrototypeId,
                    linked_asset_id: aid,
                    sort_order: idx
                });
            });
            state.dirty = false;
            state.orphans = state.assets.filter(function (a) {
                return !state.links.some(function (l) { return l.linked_asset_id === a.id; });
            }).map(function (a) { return a.id; });
            renderOrphanPool();
            renderChecks();
            renderPrototypeList();
            if (typeof window.showToast === 'function') window.showToast(tr('productTree.saved', '已儲存關聯'), 'success');
        } catch (e) {
            showAlert(e.message, 'danger');
            if (btn) btn.disabled = false;
        }
    }

    function setupReturnButton() {
        var ret = qs('return_to');
        var btn = document.getElementById('btn-return-design');
        if (btn && ret) {
            btn.href = ret;
            btn.classList.remove('d-none');
        }
    }

    function showApp() {
        document.getElementById('vplt-loading').classList.add('d-none');
        document.getElementById('vplt-app').classList.remove('d-none');
    }

    async function initVendor() {
        if (typeof AuthService === 'undefined') {
            showAlert('AuthService 未載入', 'danger');
            return;
        }
        var session = await AuthService.getSession();
        if (!session || !session.access_token) {
            document.getElementById('auth-alert').classList.remove('d-none');
            document.getElementById('vplt-loading').classList.add('d-none');
            return;
        }
        state.token = session.access_token;
        document.getElementById('btn-save-links').addEventListener('click', saveLinks);
        try {
            await loadVendorTree();
            hideAlert();
            showApp();
        } catch (e) {
            showAlert(e.message, 'danger');
            document.getElementById('vplt-loading').classList.add('d-none');
        }
    }

    async function initGuide() {
        setupReturnButton();
        try {
            await loadGuideTree();
            hideAlert();
            showApp();
        } catch (e) {
            showAlert(e.message, 'danger');
            document.getElementById('vplt-loading').classList.add('d-none');
        }
    }

    function init() {
        if (window.i18n && typeof window.i18n.applyPage === 'function') window.i18n.applyPage();
        if (IS_VENDOR) initVendor();
        else initGuide();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
