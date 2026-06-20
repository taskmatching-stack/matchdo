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
        guideSelectedPrototypeVariants: [],
        guideVariantByAssetId: {},
        guideExpandedAssetIds: Object.create(null),
        guidePartSectionExpanded: Object.create(null),
        guidePayload: null,
        guideLinkMetaByAssetId: {}
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

    /** 色款列：依 url 去重，避免封面與圖庫重複 */
    function variantImageItems(a) {
        var seen = {};
        return assetImageItems(a).filter(function (it) {
            var u = (it.url || '').trim();
            if (!u || seen[u]) return false;
            seen[u] = true;
            return true;
        });
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

    function defaultGuideVariant(a) {
        var items = assetImageItems(a);
        if (!items.length) return null;
        var cover = items.find(function (it) { return it.is_cover; }) || items[0];
        return { url: cover.url, label: (cover.label || '').trim() };
    }

    function getGuideVariant(assetId) {
        if (state.guideVariantByAssetId[assetId]) return state.guideVariantByAssetId[assetId];
        var a = assetById(assetId);
        return a ? defaultGuideVariant(a) : null;
    }

    function isPrototypeVariantSelected(url) {
        if (!url) return false;
        return state.guideSelectedPrototypeVariants.some(function (v) { return v.url === url; });
    }

    function togglePrototypeVariantSelection(assetId, url, label) {
        if (!url || !assetId) return;
        var list = state.guideSelectedPrototypeVariants;
        var idx = -1;
        for (var i = 0; i < list.length; i++) {
            if (list[i].url === url) { idx = i; break; }
        }
        if (idx >= 0) {
            list.splice(idx, 1);
        } else {
            if (list.length >= 3) {
                showAlert(tr('productTree.guidePrototypeMax', '主產品角度最多選 3 張（與設計頁原型槽上限相同）'), 'warning');
                return;
            }
            list.push({ url: url, label: label || '' });
        }
        if (list.length) {
            state.guideVariantByAssetId[assetId] = list[list.length - 1];
        } else {
            clearGuideVariantPreview(assetId);
        }
        refreshVariantCardVisuals(assetId);
        renderGuidePanel();
    }

    /** 看可搭配：主產品多圖時預選前 3 張角度（與設計頁原型槽上限相同） */
    function seedDefaultPrototypeVariantSelection(prototypeId) {
        if (IS_VENDOR || !prototypeId) return;
        var p = prototypeById(prototypeId);
        if (!p) return;
        var items = variantImageItems(p);
        if (!items.length) return;
        var take = Math.min(3, items.length);
        state.guideSelectedPrototypeVariants = [];
        for (var i = 0; i < take; i++) {
            var it = items[i];
            state.guideSelectedPrototypeVariants.push({
                url: it.url,
                label: guideTileOptionLabel(p, it, i, items.length)
            });
        }
        var last = state.guideSelectedPrototypeVariants[state.guideSelectedPrototypeVariants.length - 1];
        if (last) {
            state.guideVariantByAssetId[prototypeId] = { url: last.url, label: last.label || '' };
        }
    }

    function assetDisplayImageUrl(a, assetId) {
        if (!IS_VENDOR && assetId) {
            var v = getGuideVariant(assetId);
            if (v && v.url) return v.url;
        }
        var items = assetImageItems(a);
        return items.length ? items[0].url : '';
    }

    function isVariantPanelExpanded(assetId) {
        return !!state.guideExpandedAssetIds[assetId];
    }

    function applyGuideVariantChoice(assetId, url, label) {
        if (!url) return;
        if (prototypeById(assetId)) {
            togglePrototypeVariantSelection(assetId, url, label);
            return;
        }
        state.guideVariantByAssetId[assetId] = { url: url, label: label || '' };
        refreshVariantCardVisuals(assetId);
        if (state.guideSelectedIds.indexOf(assetId) < 0) {
            state.guideSelectedIds.push(assetId);
            enforceGuideSelectionRules(assetId);
        }
        renderGuidePanel();
    }

    function guideLightboxItems(a) {
        var raw = variantImageItems(a);
        return raw.map(function (x, idx) {
            return {
                url: x.url,
                label: guideTileOptionLabel(a, x, idx, raw.length)
            };
        });
    }

    function openVariantLightbox(a, it) {
        if (!a || !it || !it.url) return;
        if (!window.MatchdoImageLightbox || typeof window.MatchdoImageLightbox.open !== 'function') return;
        var cap = assetLightboxCaption(a);
        var items = !IS_VENDOR ? guideLightboxItems(a) : variantImageItems(a).map(function (x) {
            return { url: x.url, label: (x.label || '').trim() };
        });
        var url = (it.url || '').trim();
        var idx = 0;
        for (var i = 0; i < items.length; i++) {
            if (items[i].url === url) { idx = i; break; }
        }
        var lab = (it.label || '').trim();
        var fullCap = cap + (lab ? ' · ' + lab : '');
        window.MatchdoImageLightbox.open({
            imageItems: items,
            index: idx,
            caption: fullCap,
            alt: lab || cap
        });
    }

    function variantZoomBtnHtml(a, it) {
        var zoomTitle = tr('baseModels.clickImageEnlarge', '放大預覽');
        return '<button type="button" class="vplt-variant-zoom-btn" aria-label="' + esc(zoomTitle) + '"' +
            ' title="' + esc(zoomTitle) + '"><i class="bi bi-zoom-in" aria-hidden="true"></i></button>';
    }

    function onVariantOptionPointer(e, opt, assetId, afterPick) {
        if (e.target.closest('.vplt-variant-zoom-btn')) return;
        e.preventDefault();
        e.stopPropagation();
        var url = (opt.getAttribute('data-variant-url') || '').trim();
        var label = (opt.getAttribute('data-variant-label') || '').replace(/&quot;/g, '"').trim();
        if (IS_VENDOR) {
            state.guideVariantByAssetId[assetId] = { url: url, label: label || '' };
            refreshVariantCardVisuals(assetId);
        } else {
            applyGuideVariantChoice(assetId, url, label);
        }
        if (typeof afterPick === 'function') afterPick();
    }

    function wireVariantOptionClick(opt, assetId, afterPick) {
        opt.addEventListener('click', function (e) {
            onVariantOptionPointer(e, opt, assetId, afterPick);
        });
    }

    function wireVariantZoomButtons(root, assetIdResolver) {
        if (!root) return;
        root.querySelectorAll('.vplt-variant-zoom-btn').forEach(function (btn) {
            if (btn.__vpltZoomWired) return;
            btn.__vpltZoomWired = true;
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var cell = btn.closest('.vplt-variant-option-cell');
                var opt = cell && cell.querySelector('.vplt-variant-option');
                var tile = btn.closest('.vplt-guide-tile');
                var aid = assetIdResolver(btn, opt, cell);
                var a = assetById(aid);
                if (!a) return;
                var url = (btn.getAttribute('data-zoom-url') || '').trim();
                if (!url && opt) url = (opt.getAttribute('data-variant-url') || '').trim();
                if (!url && tile) url = (tile.getAttribute('data-variant-url') || '').trim();
                if (!url) url = assetDisplayImageUrl(a, aid);
                var label = (btn.getAttribute('data-zoom-label') || '').replace(/&quot;/g, '"').trim();
                if (!label && tile) label = (tile.getAttribute('data-variant-label') || '').replace(/&quot;/g, '"').trim();
                var it = { url: url, label: label };
                openVariantLightbox(a, it);
            });
        });
    }

    function buildVariantOptionCellHtml(a, it, activeUrl, cap) {
        var isActive = it.url === activeUrl;
        var lab = (it.label || '').trim();
        return '<div class="vplt-variant-option-cell">' +
            '<button type="button" role="option" class="vplt-variant-option' + (isActive ? ' is-active' : '') + '"' +
            ' data-variant-url="' + esc(it.url) + '"' +
            ' data-variant-label="' + esc(lab) + '"' +
            ' aria-selected="' + (isActive ? 'true' : 'false') + '"' +
            ' title="' + esc(lab || tr('productTree.colorVariant', '色款')) + '">' +
            '<img src="' + esc(it.url) + '" alt="' + esc(lab) + '" loading="lazy">' +
            '<span class="vplt-variant-option-label">' + esc(lab || '—') + '</span></button>' +
            variantZoomBtnHtml(a, it) + '</div>';
    }

    function variantLabelHtml(a, assetId) {
        if (IS_VENDOR || variantImageItems(a).length <= 1) return '';
        if (!IS_VENDOR && document.body && document.body.classList.contains('vplt-page--guide')) return '';
        var v = getGuideVariant(assetId);
        if (!v || !v.label) return '';
        return '<div class="vplt-variant-active-label text-muted">' + esc(v.label) + '</div>';
    }

    function variantSideToggleHtml(a, assetId) {
        var items = variantImageItems(a);
        if (items.length <= 1) return '';
        var expanded = isVariantPanelExpanded(assetId);
        var n = items.length;
        var label = expanded
            ? tr('productTree.collapseVariants', '收合色款')
            : (tr('productTree.expandVariants', '選色款') + ' (' + n + ')');
        return '<button type="button" class="vplt-variant-side-toggle" aria-expanded="' + (expanded ? 'true' : 'false') + '"' +
            ' title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
            '<i class="bi bi-chevron-' + (expanded ? 'left' : 'right') + '" aria-hidden="true"></i>' +
            (expanded ? '' : '<span class="vplt-variant-side-count">' + n + '</span>') +
            '</button>';
    }

    function variantCollapsedBlockHtml(a, assetId) {
        var displayUrl = assetDisplayImageUrl(a, assetId);
        var inner = '';
        if (displayUrl) {
            var lab = (getGuideVariant(assetId) && getGuideVariant(assetId).label) || '';
            inner = '<div class="vplt-variant-thumb-wrap">' +
                '<img src="' + esc(displayUrl) + '" alt="' + esc(lab) + '" class="vplt-card-thumb" loading="lazy">' +
                variantZoomBtnHtml(a, { url: displayUrl, label: lab }) + '</div>';
        } else {
            inner = '<div class="bg-light rounded mx-auto mb-1" style="width:84px;height:84px"></div>';
        }
        inner += variantLabelHtml(a, assetId);
        return '<div class="vplt-variant-collapsed" aria-hidden="false">' +
            '<div class="vplt-variant-collapsed-inner">' + inner + '</div></div>';
    }

    /** 橫向色帶（全寬）；手機改底部 sheet */
    function variantPickerPanelHtml(a, assetId) {
        var items = variantImageItems(a);
        if (items.length <= 1) return '';
        var activeUrl = assetDisplayImageUrl(a, assetId);
        var cap = assetLightboxCaption(a);
        var v = getGuideVariant(assetId);
        var activeLabel = (v && v.label) ? v.label : '';
        var stripInner = items.map(function (it) {
            return buildVariantOptionCellHtml(a, it, activeUrl, cap);
        }).join('');
        var browseLbl = (tr('productTree.browseAllColors', '瀏覽全部 {n} 色') || '瀏覽全部 {n} 色').replace('{n}', String(items.length));
        return '<div class="vplt-variant-picker" data-variant-picker-asset="' + esc(assetId) + '">' +
            '<div class="vplt-variant-mobile-bar">' +
            '<span class="vplt-variant-mobile-label">' + esc(activeLabel || tr('productTree.pickColorHint', '點下方瀏覽色款')) + '</span>' +
            '<button type="button" class="btn btn-sm btn-outline-primary vplt-variant-browse-btn" data-browse-asset="' + esc(assetId) + '">' +
            esc(browseLbl) + ' <i class="bi bi-chevron-up" aria-hidden="true"></i></button>' +
            '</div>' +
            '<div class="vplt-variant-hstrip" role="listbox" aria-label="' +
            esc(tr('productTree.pickColorVariant', '選擇色款')) + '">' + stripInner + '</div></div>';
    }

    function variantExpandedBlockHtml(a, assetId) {
        return '<div class="vplt-variant-expanded-wrap" aria-hidden="true">' + variantPickerPanelHtml(a, assetId) + '</div>';
    }

    function syncVariantSideToggle(btn, a, assetId) {
        if (!btn || !a) return;
        var items = variantImageItems(a);
        var expanded = isVariantPanelExpanded(assetId);
        var n = items.length;
        var label = expanded
            ? tr('productTree.collapseVariants', '收合色款')
            : (tr('productTree.expandVariants', '選色款') + ' (' + n + ')');
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.innerHTML = '<i class="bi bi-chevron-' + (expanded ? 'left' : 'right') + '" aria-hidden="true"></i>' +
            (expanded ? '' : '<span class="vplt-variant-side-count">' + n + '</span>');
    }

    function syncVariantCardExpanded(card) {
        if (!card) return;
        var assetId = card.getAttribute('data-guide-asset');
        var a = assetById(assetId);
        var expanded = isVariantPanelExpanded(assetId);
        var unit = card.closest('.vplt-variant-unit');
        var guidePage = !IS_VENDOR && document.body && document.body.classList.contains('vplt-page--guide');
        card.classList.toggle('vplt-child-card--expanded', expanded);
        if (unit) {
            unit.classList.toggle('vplt-variant-unit--expanded', expanded && !guidePage);
        }
        var collapsed = card.querySelector('.vplt-variant-collapsed');
        var expandedWrap = card.querySelector('.vplt-variant-expanded-wrap');
        if (guidePage && unit) {
            var panel = unit.querySelector('.vplt-variant-expand-panel');
            var hidePanel = !expanded || isGuideMobileVariantUi();
            if (panel) panel.classList.toggle('d-none', hidePanel);
            if (collapsed) collapsed.setAttribute('aria-hidden', 'false');
            if (expandedWrap) expandedWrap.setAttribute('aria-hidden', 'true');
        } else {
            if (collapsed) collapsed.setAttribute('aria-hidden', expanded ? 'true' : 'false');
            if (expandedWrap) expandedWrap.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        }
        syncVariantSideToggle(card.querySelector('.vplt-variant-side-toggle'), a, assetId);
    }

    function syncAllVariantCardsExpanded() {
        var canvas = document.getElementById('vplt-canvas');
        if (!canvas) return;
        canvas.querySelectorAll('.vplt-child-card--has-variants').forEach(syncVariantCardExpanded);
    }

    function isGuideMobileVariantUi() {
        return !IS_VENDOR && typeof window.matchMedia === 'function' &&
            window.matchMedia('(max-width: 768px)').matches;
    }

    function toggleGuideVariantExpanded(assetId) {
        if (!assetId) return;
        if (isGuideMobileVariantUi()) {
            if (state.guideExpandedAssetIds[assetId]) {
                closeVariantSheet();
            } else {
                state.guideExpandedAssetIds[assetId] = true;
                openVariantSheet(assetId);
                syncAllVariantCardsExpanded();
            }
            return;
        }
        if (state.guideExpandedAssetIds[assetId]) {
            delete state.guideExpandedAssetIds[assetId];
        } else {
            state.guideExpandedAssetIds[assetId] = true;
        }
        syncAllVariantCardsExpanded();
        if (state.guideExpandedAssetIds[assetId]) {
            wireGuideVariantOptions(assetId);
        }
    }

    function wireGuideVariantOptions(assetId) {
        if (!assetId) return;
        var sel = '.vplt-variant-expand-panel[data-expand-panel="' + assetId + '"] .vplt-variant-option, ' +
            '.vplt-child-card--has-variants[data-guide-asset="' + assetId + '"] .vplt-variant-option';
        document.querySelectorAll(sel).forEach(function (opt) {
            if (opt.__vpltOptWired) return;
            opt.__vpltOptWired = true;
            wireVariantOptionClick(opt, assetId);
        });
    }

    function refreshVariantCardVisuals(assetId) {
        var a = assetById(assetId);
        if (!a) return;
        var displayUrl = assetDisplayImageUrl(a, assetId);
        var activeUrl = displayUrl;
        if (!IS_VENDOR) {
            var tiles = document.querySelectorAll('.vplt-guide-tile[data-guide-asset="' + assetId + '"]');
            if (tiles.length) {
                var picked = state.guideSelectedIds.indexOf(assetId) >= 0;
                var a = assetById(assetId);
                var kindKey = a && a.asset_kind === 'prototype' ? 'prototype' : (a && a.asset_kind) || 'part';
                var multi = a && variantImageItems(a).length > 1;
                tiles.forEach(function (tile) {
                    var url = (tile.getAttribute('data-variant-url') || '').trim();
                    var on = (kindKey === 'prototype' && multi)
                        ? isPrototypeVariantSelected(url)
                        : (!url || url === activeUrl);
                    var vis = guideTileSelectionVisuals(kindKey, picked, on, multi);
                    tile.classList.toggle('vplt-guide-tile--active-view', vis.showFrame);
                    tile.classList.toggle('vplt-guide-tile--picked', vis.isPicked);
                    tile.setAttribute('aria-pressed', vis.isPicked ? 'true' : 'false');
                    var media = tile.querySelector('.vplt-guide-tile-media');
                    if (!media) return;
                    media.querySelectorAll('.vplt-guide-tile-badge').forEach(function (b) { b.remove(); });
                    var badge = guideTileBadgeHtml(kindKey, picked, on, multi);
                    if (badge) {
                        var wrap = document.createElement('div');
                        wrap.innerHTML = badge;
                        if (wrap.firstChild) media.insertBefore(wrap.firstChild, media.firstChild);
                    }
                });
                return;
            }
        }
        var card = document.querySelector('[data-guide-asset="' + assetId + '"]');
        if (!card) return;
        var thumb = card.querySelector('.vplt-variant-collapsed .vplt-card-thumb');
        if (thumb && displayUrl) {
            thumb.src = displayUrl;
            var v0 = getGuideVariant(assetId);
            if (v0 && v0.label) thumb.alt = v0.label;
        }
        var labelEl = card.querySelector('.vplt-variant-active-label');
        var v = getGuideVariant(assetId);
        if (labelEl) {
            if (v && v.label) {
                labelEl.textContent = v.label;
                labelEl.classList.remove('d-none');
            } else {
                labelEl.classList.add('d-none');
            }
        } else if (v && v.label) {
            var inner = card.querySelector('.vplt-variant-collapsed-inner');
            if (inner) {
                var el = document.createElement('div');
                el.className = 'vplt-variant-active-label text-muted';
                el.textContent = v.label;
                inner.appendChild(el);
            }
        }
        var mobileLabel = card.querySelector('.vplt-variant-mobile-label');
        if (mobileLabel) {
            mobileLabel.textContent = (v && v.label) ? v.label : tr('productTree.pickColorHint', '點下方瀏覽色款');
        }
        var activeUrl = displayUrl;
        card.querySelectorAll('.vplt-variant-option').forEach(function (opt) {
            var url = (opt.getAttribute('data-variant-url') || '').trim();
            var on = url === activeUrl;
            opt.classList.toggle('is-active', on);
            opt.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        syncVariantSideToggle(card.querySelector('.vplt-variant-side-toggle'), a, assetId);
    }

    function closeVariantSheet() {
        var sheet = document.getElementById('vpltVariantSheet');
        if (!sheet) return;
        var openAssetId = sheet.getAttribute('data-open-asset-id') || '';
        sheet.classList.remove('open');
        sheet.setAttribute('aria-hidden', 'true');
        sheet.removeAttribute('data-open-asset-id');
        document.body.style.overflow = '';
        var grid = document.getElementById('vpltVariantSheetGrid');
        if (grid) grid.innerHTML = '';
        if (openAssetId && state.guideExpandedAssetIds[openAssetId]) {
            delete state.guideExpandedAssetIds[openAssetId];
            syncAllVariantCardsExpanded();
        }
    }

    function openVariantSheet(assetId) {
        var a = assetById(assetId);
        if (!a) return;
        var items = variantImageItems(a);
        var sheet = document.getElementById('vpltVariantSheet');
        var grid = document.getElementById('vpltVariantSheetGrid');
        var titleEl = document.getElementById('vpltVariantSheetTitle');
        if (!sheet || !grid) return;
        sheet.setAttribute('data-open-asset-id', assetId);
        var activeUrl = assetDisplayImageUrl(a, assetId);
        var cap = assetLightboxCaption(a);
        if (titleEl) {
            titleEl.textContent = (a.title || tr('productTree.colorVariant', '色款')) + ' — ' +
                (tr('productTree.pickColorVariant', '選擇色款'));
        }
        grid.innerHTML = items.map(function (it) {
            return buildVariantOptionCellHtml(a, it, activeUrl, cap);
        }).join('');
        grid.querySelectorAll('.vplt-variant-option').forEach(function (opt) {
            wireVariantOptionClick(opt, assetId, closeVariantSheet);
        });
        wireVariantZoomButtons(grid, function () { return assetId; });
        sheet.classList.add('open');
        sheet.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function wireVariantSheetUi() {
        if (IS_VENDOR || window.__vpltVariantSheetWired) return;
        window.__vpltVariantSheetWired = true;
        var sheet = document.getElementById('vpltVariantSheet');
        if (!sheet) return;
        sheet.querySelector('.vplt-variant-sheet-backdrop').addEventListener('click', closeVariantSheet);
        document.getElementById('vpltVariantSheetClose').addEventListener('click', closeVariantSheet);
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.vplt-variant-browse-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            openVariantSheet(btn.getAttribute('data-browse-asset'));
        });
    }

    function enlargeImgHtml(a, className, style, displayUrl) {
        var items = assetImageItems(a);
        if (!items.length) return '';
        var src = (displayUrl || items[0].url || '').trim();
        if (!src) return '';
        var cap = assetLightboxCaption(a);
        var cls = 'matchdo-enlarge-trigger' + (className ? ' ' + className : '');
        var st = style ? ' style="' + style + '"' : '';
        var title = esc(tr('baseModels.clickImageEnlarge', '點擊放大'));
        return '<img src="' + esc(src) + '" alt="" class="' + cls + '"' + st +
            dataImageItemsAttr(a) +
            ' data-lightbox-caption="' + esc(cap) + '" title="' + title + '" loading="lazy">';
    }

    function assetById(id) {
        var a = state.assets.find(function (x) { return x.id === id; });
        if (a) return a;
        return prototypeById(id) || null;
    }

    function assetHasColorVariants(a) {
        return !!(a && variantImageItems(a).length > 1);
    }

    function simpleThumbHtml(a, assetId) {
        var displayUrl = assetId ? assetDisplayImageUrl(a, assetId) : ((assetImageItems(a)[0] || {}).url || '');
        if (!displayUrl) {
            return '<div class="bg-light rounded mx-auto mb-1" style="width:84px;height:84px"></div>';
        }
        var lab = '';
        if (assetId && !IS_VENDOR) {
            var v = getGuideVariant(assetId);
            lab = (v && v.label) || '';
        }
        return '<div class="vplt-variant-thumb-wrap">' +
            '<img src="' + esc(displayUrl) + '" alt="' + esc(lab) + '" class="vplt-card-thumb" loading="lazy">' +
            variantZoomBtnHtml(a, { url: displayUrl, label: lab }) + '</div>';
    }

    function guideKindLabelForKey(kindKey) {
        if (kindKey === 'prototype') return tr('productTree.rootLabel', '主產品');
        return kindLabel(kindKey);
    }

    function isAutoGeneratedTileLabel(s) {
        var t = String(s || '').trim();
        if (!t || t.length < 18) return false;
        return /^[a-zA-Z0-9_.-]+$/.test(t);
    }

    /** 多圖時標籤：色款名／角度 N；勿用檔名或 id 當 caption */
    function guideTileOptionLabel(a, it, index, total) {
        var raw = (it && it.label) ? String(it.label).trim() : '';
        if (raw && !isAutoGeneratedTileLabel(raw)) return raw;
        if (total <= 1) {
            var title = (a.title || '').trim();
            if (title && !isAutoGeneratedTileLabel(title)) return title;
            return tr('productTree.unnamedItem', '未命名');
        }
        var n = String((index || 0) + 1);
        if (a.asset_kind === 'prototype') {
            return (tr('productTree.angleN', '角度 {n}') || '角度 {n}').replace('{n}', n);
        }
        return (tr('productTree.colorOptionN', '色款 {n}') || '色款 {n}').replace('{n}', n);
    }

    function guideTileSelectionVisuals(kindKey, picked, isActive, multi) {
        if (kindKey === 'prototype' && multi) {
            return { isPicked: !!isActive, showFrame: !!isActive };
        }
        var isPicked = kindKey !== 'prototype' && picked && isActive;
        var showFrame = false;
        if (kindKey === 'prototype') {
            showFrame = !!isActive;
        } else if (picked) {
            showFrame = !!isActive || !multi;
        }
        return { isPicked: isPicked, showFrame: showFrame };
    }

    function guideTileBadgeHtml(kindKey, picked, isActive, multi) {
        if (!isActive) return '';
        if (kindKey === 'prototype' && multi) {
            return '<span class="vplt-guide-tile-badge vplt-guide-tile-badge--picked">' +
                esc(tr('productTree.guidePickedBadge', '已選')) + '</span>';
        }
        if (picked) {
            return '<span class="vplt-guide-tile-badge vplt-guide-tile-badge--picked">' +
                esc(tr('productTree.guidePickedBadge', '已選')) + '</span>';
        }
        return '';
    }

    function guideTileZoomBtnHtml(a, url, label) {
        if (!url) return '';
        var zoomTitle = tr('baseModels.clickImageEnlarge', '放大預覽');
        return '<button type="button" class="vplt-variant-zoom-btn vplt-guide-tile-zoom-btn"' +
            ' data-zoom-url="' + esc(url) + '"' +
            ' data-zoom-label="' + esc(label || '') + '"' +
            ' aria-label="' + esc(zoomTitle) + '" title="' + esc(zoomTitle) + '">' +
            '<i class="bi bi-zoom-in" aria-hidden="true"></i></button>';
    }

    function guideTileMediaHtml(a, it, optionLabel, badgeHtml) {
        var url = (it && it.url) ? it.url : '';
        if (!url) {
            return '<div class="vplt-guide-tile-media vplt-guide-tile-media--empty" aria-hidden="true"></div>';
        }
        return '<div class="vplt-guide-tile-media">' +
            (badgeHtml || '') +
            '<img src="' + esc(url) + '" alt="' + esc(optionLabel || '') + '" class="vplt-guide-tile-img" loading="eager" decoding="async">' +
            guideTileZoomBtnHtml(a, url, optionLabel) +
            '</div>';
    }

    /** 主產品／配件／材料同一套：多圖 = 多格，選取以 teal 外框 + 角標（預覽中／已選）表示 */
    function guideTileHtml(a, aid, kindKey, picked, variantIt, variantIndex, variantTotal) {
        var kindCls = kindKey === 'prototype' ? 'prototype' : (kindKey === 'material' ? 'material' : 'part');
        var items = variantImageItems(a);
        var total = variantTotal != null ? variantTotal : items.length;
        var idx = variantIndex != null ? variantIndex : 0;
        var it = variantIt || items[0] || null;
        var imgUrl = (it && it.url) ? it.url : assetDisplayImageUrl(a, aid);
        var activeUrl = assetDisplayImageUrl(a, aid);
        var multi = total > 1;
        var optionLabel = guideTileOptionLabel(a, it, idx, total);
        var displayName = esc(optionLabel);
        var subKind = multi ? '' : ('<span class="vplt-guide-tile-kind">' + esc(guideKindLabelForKey(kindKey)) + '</span>');
        var isActive = (kindKey === 'prototype' && multi)
            ? isPrototypeVariantSelected(imgUrl)
            : (!multi || imgUrl === activeUrl);
        var vis = guideTileSelectionVisuals(kindKey, picked, isActive, multi);
        var pickCls = vis.isPicked ? ' vplt-guide-tile--picked' : '';
        var activeCls = vis.showFrame ? ' vplt-guide-tile--active-view' : '';
        var interCls = (kindKey !== 'prototype' || multi) ? ' vplt-guide-tile--interactive' : '';
        var variantAttrs = multi && it && it.url
            ? ' data-variant-url="' + esc(it.url) + '" data-variant-label="' + esc(optionLabel) + '"'
            : '';
        var badgeHtml = guideTileBadgeHtml(kindKey, picked, isActive, multi);
        var pressedAttr = vis.isPicked ? ' aria-pressed="true"' : ' aria-pressed="false"';
        return '<div class="vplt-guide-tile vplt-guide-tile--' + esc(kindCls) + interCls + pickCls + activeCls + '"' +
            ' data-guide-asset="' + esc(aid) + '" role="listitem"' + variantAttrs + pressedAttr + ' tabindex="0">' +
            guideTileMediaHtml(a, it, optionLabel, badgeHtml) +
            '<span class="vplt-guide-tile-name">' + displayName + '</span>' +
            subKind +
            '</div>';
    }

    function guideTilesForAsset(a, aid, kindKey, picked) {
        var items = variantImageItems(a);
        if (items.length <= 1) {
            return [guideTileHtml(a, aid, kindKey, picked, items[0] || null, 0, 1)];
        }
        return items.map(function (it, idx) {
            return guideTileHtml(a, aid, kindKey, picked, it, idx, items.length);
        });
    }

    function isGuidePartSectionExpanded(assetId) {
        return !!state.guidePartSectionExpanded[assetId];
    }

    function setGuidePartSectionExpanded(assetId, expanded) {
        if (!assetId) return;
        if (expanded) state.guidePartSectionExpanded[assetId] = true;
        else delete state.guidePartSectionExpanded[assetId];
    }

    function syncGuidePartSectionDom(section) {
        if (!section) return;
        var aid = section.getAttribute('data-guide-section-asset') || '';
        var expanded = isGuidePartSectionExpanded(aid);
        section.classList.toggle('vplt-guide-section--expanded', expanded);
        section.classList.toggle('vplt-guide-section--collapsed', !expanded);
        var btn = section.querySelector('[data-guide-section-toggle]');
        var body = section.querySelector('.vplt-guide-section-body');
        var chevron = section.querySelector('.vplt-guide-section-chevron');
        if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (body) {
            if (expanded) body.removeAttribute('hidden');
            else body.setAttribute('hidden', '');
        }
        if (chevron) {
            chevron.classList.toggle('bi-chevron-down', !expanded);
            chevron.classList.toggle('bi-chevron-up', expanded);
        }
    }

    function guideSectionRailHtml(tilesHtml) {
        var prevLbl = esc(tr('productTree.railScrollPrev', '向左捲動'));
        var nextLbl = esc(tr('productTree.railScrollNext', '向右捲動'));
        return '<div class="vplt-guide-rail-nav">' +
            '<button type="button" class="vplt-guide-rail-arrow vplt-guide-rail-arrow--prev" aria-label="' + prevLbl + '">' +
            '<i class="bi bi-chevron-left" aria-hidden="true"></i></button>' +
            '<div class="vplt-guide-rail-viewport">' +
            '<div class="vplt-guide-rail-scroll" tabindex="0">' +
            '<div class="vplt-guide-rail" role="list">' + tilesHtml + '</div></div></div>' +
            '<button type="button" class="vplt-guide-rail-arrow vplt-guide-rail-arrow--next" aria-label="' + nextLbl + '">' +
            '<i class="bi bi-chevron-right" aria-hidden="true"></i></button>' +
            '</div>';
    }

    function guideSectionHtml(sectionKind, heading, tilesHtml, sectionAssetId) {
        if (!tilesHtml) return '';
        var rail = guideSectionRailHtml(tilesHtml);
        var isPartCollapsible = sectionKind === 'part' && sectionAssetId && !IS_VENDOR;
        if (!isPartCollapsible) {
            return '<section class="vplt-guide-section vplt-guide-section--' + esc(sectionKind) + '">' +
                '<h3 class="vplt-guide-section-title">' + heading + '</h3>' +
                rail + '</section>';
        }
        var expanded = isGuidePartSectionExpanded(sectionAssetId);
        var stateCls = expanded ? ' vplt-guide-section--expanded' : ' vplt-guide-section--collapsed';
        var expandLbl = esc(tr('productTree.sectionExpand', '展開配件選項'));
        var collapseLbl = esc(tr('productTree.sectionCollapse', '收合配件選項'));
        var toggleAria = expanded ? collapseLbl : expandLbl;
        var chevronCls = expanded ? 'bi-chevron-up' : 'bi-chevron-down';
        return '<section class="vplt-guide-section vplt-guide-section--part vplt-guide-section--collapsible' + stateCls + '"' +
            ' data-guide-section-asset="' + esc(sectionAssetId) + '">' +
            '<button type="button" class="vplt-guide-section-toggle"' +
            ' data-guide-section-toggle="' + esc(sectionAssetId) + '"' +
            ' aria-expanded="' + (expanded ? 'true' : 'false') + '" aria-label="' + toggleAria + '">' +
            '<h3 class="vplt-guide-section-title">' + heading +
            ' <i class="bi ' + chevronCls + ' vplt-guide-section-chevron" aria-hidden="true"></i></h3>' +
            '</button>' +
            '<div class="vplt-guide-section-body"' + (expanded ? '' : ' hidden') + '>' + rail + '</div>' +
            '</section>';
    }

    /** 區塊標題：分類在前、商品名在後（主產品 · 角粒殼3.0） */
    function guideSectionHeadingHtml(kindKey, a) {
        var kindLbl = esc(guideKindLabelForKey(kindKey));
        var kindSpan = '<span class="vplt-guide-section-tag vplt-guide-section-tag--' + esc(kindKey) + '">' + kindLbl + '</span>';
        if (!a) return kindSpan;
        var title = esc(a.title || a.id || '');
        if (!title) return kindSpan;
        return kindSpan + ' <span class="vplt-guide-section-name">' + title + '</span>';
    }

    function vendorSectionRemoveBtnHtml(aid) {
        return ' <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-1 align-baseline vplt-vendor-unlink"' +
            ' data-remove="' + esc(aid) + '" title="' + esc(tr('productTree.removeLink', '移除關聯')) + '">&times;</button>';
    }

    function wireVendorCanvasDrop(canvas) {
        if (!canvas) return;
        var wrap = canvas.closest('.vplt-canvas-wrap') || canvas;
        if (wrap.__vpltDropWired) return;
        wrap.__vpltDropWired = true;
        wrap.addEventListener('dragover', function (e) {
            e.preventDefault();
            canvas.classList.add('vplt-drop-target');
        });
        wrap.addEventListener('dragleave', function (e) {
            if (e.target === wrap || !wrap.contains(e.relatedTarget)) {
                canvas.classList.remove('vplt-drop-target');
            }
        });
        wrap.addEventListener('drop', function (e) {
            e.preventDefault();
            canvas.classList.remove('vplt-drop-target');
            var aid = e.dataTransfer.getData('text/vnd.asset-id');
            if (aid) addLink(aid);
        });
    }

    function wireVendorLinkRemoveButtons(canvas) {
        if (!canvas) return;
        canvas.querySelectorAll('[data-remove]').forEach(function (btn) {
            if (btn.__vpltRemoveWired) return;
            btn.__vpltRemoveWired = true;
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                removeLink(btn.getAttribute('data-remove'));
            });
        });
    }

    function renderGuideCanvas(proto, linkedIds) {
        var sections = '';
        var protoTiles = guideTilesForAsset(proto, proto.id, 'prototype', false).join('');
        sections += guideSectionHtml('prototype', guideSectionHeadingHtml('prototype', proto), protoTiles);

        var partIds = [];
        var materialIds = [];
        linkedIds.forEach(function (aid) {
            var a = assetById(aid);
            if (!a) return;
            if (a.asset_kind === 'part') partIds.push(aid);
            else if (a.asset_kind === 'material') materialIds.push(aid);
        });

        partIds.forEach(function (aid) {
            var a = assetById(aid);
            if (!a) return;
            var picked = state.guideSelectedIds.indexOf(aid) >= 0;
            var heading = guideSectionHeadingHtml('part', a) + (IS_VENDOR ? vendorSectionRemoveBtnHtml(aid) : '');
            sections += guideSectionHtml('part', heading,
                guideTilesForAsset(a, aid, 'part', picked).join(''), aid);
        });

        materialIds.forEach(function (aid) {
            var a = assetById(aid);
            if (!a) return;
            var picked = state.guideSelectedIds.indexOf(aid) >= 0;
            var heading = guideSectionHeadingHtml('material', a) + (IS_VENDOR ? vendorSectionRemoveBtnHtml(aid) : '');
            sections += guideSectionHtml('material', heading,
                guideTilesForAsset(a, aid, 'material', picked).join(''));
        });

        if (!linkedIds.length && !IS_VENDOR) {
            sections += '<p class="vplt-guide-rail-note text-muted small mb-0 mt-2">' +
                esc(tr('productTree.noLinksYet', '尚未關聯材料或配件')) + '</p>';
        } else if (!linkedIds.length && IS_VENDOR) {
            sections += '<p class="vplt-guide-rail-note text-muted small mb-0 mt-2">' +
                esc(tr('productTree.vendorLinkHint', '從右側「未關聯素材」拖曳或點 + 加入配件／材料')) + '</p>';
        }

        return '<div class="vplt-guide-sections">' + sections + '</div>';
    }

    function wireGuideRailNav(canvas) {
        if (!canvas) return;
        canvas.querySelectorAll('.vplt-guide-rail-nav').forEach(function (nav) {
            if (nav.__vpltNavWired) return;
            nav.__vpltNavWired = true;
            var scroll = nav.querySelector('.vplt-guide-rail-scroll');
            var prev = nav.querySelector('.vplt-guide-rail-arrow--prev');
            var next = nav.querySelector('.vplt-guide-rail-arrow--next');
            if (!scroll || !prev || !next) return;

            function updateArrows() {
                var max = scroll.scrollWidth - scroll.clientWidth;
                var sl = scroll.scrollLeft;
                var overflow = max > 4;
                nav.classList.toggle('vplt-guide-rail-nav--overflow', overflow);
                prev.disabled = !overflow || sl <= 4;
                next.disabled = !overflow || sl >= max - 4;
            }

            function scrollStep(dir) {
                var step = Math.max(Math.round(scroll.clientWidth * 0.72), 180);
                scroll.scrollBy({ left: dir * step, behavior: 'smooth' });
            }

            prev.addEventListener('click', function (e) {
                e.preventDefault();
                scrollStep(-1);
            });
            next.addEventListener('click', function (e) {
                e.preventDefault();
                scrollStep(1);
            });
            scroll.addEventListener('scroll', updateArrows, { passive: true });
            if (typeof ResizeObserver !== 'undefined') {
                var ro = new ResizeObserver(updateArrows);
                ro.observe(scroll);
                var rail = scroll.querySelector('.vplt-guide-rail');
                if (rail) ro.observe(rail);
            } else {
                window.addEventListener('resize', updateArrows);
            }
            updateArrows();
            setTimeout(updateArrows, 120);
        });
    }

    function wireGuideSectionToggles(canvas) {
        if (!canvas) return;
        canvas.querySelectorAll('[data-guide-section-toggle]').forEach(function (btn) {
            if (btn.__vpltSecWired) return;
            btn.__vpltSecWired = true;
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                var aid = btn.getAttribute('data-guide-section-toggle');
                if (!aid) return;
                var section = btn.closest('.vplt-guide-section');
                setGuidePartSectionExpanded(aid, !isGuidePartSectionExpanded(aid));
                syncGuidePartSectionDom(section);
            });
        });
    }

    function wireGuideRail(canvas) {
        if (!canvas) return;
        wireGuideSectionToggles(canvas);
        wireGuideRailNav(canvas);
        canvas.querySelectorAll('.vplt-guide-tile').forEach(function (tile) {
            if (tile.__vpltTileWired) return;
            tile.__vpltTileWired = true;
            tile.addEventListener('click', function (e) {
                if (e.target.closest('.vplt-variant-zoom-btn')) return;
                var aid = tile.getAttribute('data-guide-asset');
                var url = (tile.getAttribute('data-variant-url') || '').trim();
                var label = (tile.getAttribute('data-variant-label') || '').replace(/&quot;/g, '"').trim();
                if (url) {
                    if (prototypeById(aid)) {
                        togglePrototypeVariantSelection(aid, url, label);
                        return;
                    }
                    var picked = state.guideSelectedIds.indexOf(aid) >= 0;
                    var cur = getGuideVariant(aid);
                    var sameVariant = cur && cur.url === url;
                    if (sameVariant && picked) {
                        toggleGuideSelection(aid);
                        return;
                    }
                    applyGuideVariantChoice(aid, url, label);
                    return;
                }
                if (tile.classList.contains('vplt-guide-tile--interactive')) {
                    toggleGuideSelection(aid);
                }
            });
            tile.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                tile.click();
            });
        });
    }

    /** 框外標題列：主產品／配件／材料 + 商品名（廠商後台用） */
    function guideUnitHeadHtml(a, kindKey) {
        var title = esc(a.title || a.id || '');
        var kindLbl = esc(guideKindLabelForKey(kindKey));
        var kindCls = kindKey === 'prototype' ? 'prototype' : (kindKey === 'material' ? 'material' : 'part');
        return '<div class="vplt-unit-head vplt-unit-head--' + esc(kindCls) + '">' +
            '<span class="vplt-unit-kind">' + kindLbl + '</span>' +
            '<span class="vplt-unit-title">' + title + '</span></div>';
    }

    function guideVariantUnitHtml(a, aid, kindKey, removeBtn, clickCls, pickCls) {
        var expanded = isVariantPanelExpanded(aid);
        var expandedCls = expanded ? ' vplt-child-card--expanded' : '';
        var cardKind = kindKey === 'prototype' ? 'prototype' : kindKey;
        var innerExpanded = IS_VENDOR ? variantExpandedBlockHtml(a, aid) : '';
        var outerPanel = !IS_VENDOR
            ? '<div class="vplt-variant-expand-panel' + (expanded ? '' : ' d-none') + '" data-expand-panel="' + esc(aid) + '">' +
            variantPickerPanelHtml(a, aid) + '</div>'
            : '';
        return '<div class="vplt-variant-unit' + (kindKey === 'prototype' ? ' vplt-variant-unit--root' : '') + '">' +
            guideUnitHeadHtml(a, kindKey) +
            '<div class="vplt-child-card vplt-child-card--' + esc(cardKind) + clickCls + pickCls +
            ' vplt-child-card--has-variants vplt-card-with-side' + expandedCls + '" data-guide-asset="' + esc(aid) + '">' +
            removeBtn +
            '<div class="vplt-variant-layout">' +
            variantCollapsedBlockHtml(a, aid) +
            innerExpanded +
            '</div>' +
            variantSideToggleHtml(a, aid) +
            '</div>' +
            outerPanel +
            '</div>';
    }

    function guideSimpleCardHtml(a, aid, kindKey, removeBtn, clickCls, pickCls) {
        var cardKind = kindKey === 'prototype' ? 'prototype' : kindKey;
        var rootCls = kindKey === 'prototype' ? ' vplt-variant-unit--root' : '';
        return '<div class="vplt-variant-unit' + rootCls + '">' +
            guideUnitHeadHtml(a, kindKey) +
            '<div class="vplt-child-card vplt-child-card--' + esc(cardKind) + clickCls + pickCls +
            '" data-guide-asset="' + esc(aid) + '">' +
            removeBtn +
            simpleThumbHtml(a, aid) +
            '</div></div>';
    }

    function linkedAssetCardHtml(a, aid, removeBtn, clickCls, pickCls) {
        var k = a.asset_kind;
        if (assetHasColorVariants(a)) {
            return guideVariantUnitHtml(a, aid, k, removeBtn, clickCls, pickCls);
        }
        return guideSimpleCardHtml(a, aid, k, removeBtn, clickCls, pickCls);
    }

    function rootCardHtml(proto) {
        var pid = proto.id;
        var dropAttr = IS_VENDOR ? ' id="vplt-root-drop"' : '';
        var inner = assetHasColorVariants(proto)
            ? guideVariantUnitHtml(proto, pid, 'prototype', '', '', '')
            : guideSimpleCardHtml(proto, pid, 'prototype', '', '', '');
        return '<div class="vplt-root-wrap"' + dropAttr + '>' + inner + '</div>';
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
        canvas.innerHTML = renderGuideCanvas(proto, linkedIds);
        wireGuideRailNav(canvas);
        wireVariantZoomButtons(canvas, function (btn) {
            var tile = btn.closest('.vplt-guide-tile');
            return tile ? tile.getAttribute('data-guide-asset') : '';
        });
        if (IS_VENDOR) {
            wireVendorLinkRemoveButtons(canvas);
            wireVendorCanvasDrop(canvas);
        } else {
            wireGuideRail(canvas);
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
        wireExportPdfButton(id);
    }

    function getGuideLinkMeta(assetId) {
        return state.guideLinkMetaByAssetId[assetId] || { allow_multi_pick: true, pick_group: null };
    }

    function normalizePickGroup(g) {
        var s = (g || '').trim();
        return s || null;
    }

    function enforceGuideSelectionRules(selectedId) {
        var meta = getGuideLinkMeta(selectedId);
        var group = normalizePickGroup(meta.pick_group);
        var selectedAsset = assetById(selectedId);
        var selectedKind = selectedAsset ? selectedAsset.asset_kind : null;
        state.guideSelectedIds = state.guideSelectedIds.filter(function (aid) {
            if (aid === selectedId) return true;
            var a = assetById(aid);
            var m = getGuideLinkMeta(aid);
            var g2 = normalizePickGroup(m.pick_group);
            /* 看可搭配：主體材料僅能選一筆；配件複選仍依廠商 allow_multi_pick / pick_group */
            if (!IS_VENDOR && selectedKind === 'material' && a && a.asset_kind === 'material') return false;
            if (group && g2 === group) return false;
            if (!meta.allow_multi_pick && m.allow_multi_pick === false) return false;
            return true;
        });
    }

    function clearGuideVariantPreview(assetId) {
        if (!assetId) return;
        delete state.guideVariantByAssetId[assetId];
    }

    function refreshGuideSelectionVisuals(prevSelectedIds) {
        var touch = {};
        (prevSelectedIds || []).forEach(function (id) { if (id) touch[id] = true; });
        state.guideSelectedIds.forEach(function (id) { if (id) touch[id] = true; });
        Object.keys(touch).forEach(function (id) { refreshVariantCardVisuals(id); });
    }

    function toggleGuideSelection(assetId) {
        if (!assetId) return;
        var prevSelected = state.guideSelectedIds.slice();
        var idx = state.guideSelectedIds.indexOf(assetId);
        if (idx >= 0) {
            state.guideSelectedIds.splice(idx, 1);
            clearGuideVariantPreview(assetId);
        } else {
            state.guideSelectedIds.push(assetId);
            enforceGuideSelectionRules(assetId);
            var a = assetById(assetId);
            if (a && variantImageItems(a).length > 1 && !state.guideVariantByAssetId[assetId]) {
                var def = defaultGuideVariant(a);
                if (def) state.guideVariantByAssetId[assetId] = def;
            }
        }
        if (!IS_VENDOR) {
            refreshGuideSelectionVisuals(prevSelected.concat([assetId]));
            renderGuidePanel();
            return;
        }
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
        var p = prototypeById(state.selectedPrototypeId);
        var protoVariants = state.guideSelectedPrototypeVariants;
        if (!state.guideSelectedIds.length && !protoVariants.length) {
            selRoot.innerHTML = '<p class="text-muted small mb-0">' + esc(tr('productTree.guideNoneSelected', '尚未點選')) + '</p>';
            return;
        }
        protoVariants.forEach(function (v) {
            if (!p || !v || !v.url) return;
            var row = document.createElement('div');
            row.className = 'vplt-guide-sel-item';
            var titleLine = esc(p.title || p.id);
            if (v.label) titleLine += ' <span class="text-primary">· ' + esc(v.label) + '</span>';
            row.innerHTML = '<img src="' + esc(v.url) + '" alt="" class="vplt-guide-sel-thumb" loading="lazy" decoding="async">' +
                '<span class="flex-grow-1 text-truncate">' + titleLine +
                ' <span class="text-muted">(' + esc(tr('productTree.rootLabel', '主產品')) + ')</span></span>' +
                '<button type="button" class="btn btn-sm btn-link text-danger py-0">&times;</button>';
            row.querySelector('button').addEventListener('click', function (e) {
                e.stopPropagation();
                togglePrototypeVariantSelection(p.id, v.url, v.label);
            });
            selRoot.appendChild(row);
        });
        state.guideSelectedIds.forEach(function (aid) {
            var a = assetById(aid);
            if (!a) return;
            var row = document.createElement('div');
            row.className = 'vplt-guide-sel-item';
            var selUrl = assetDisplayImageUrl(a, aid);
            var v = getGuideVariant(aid);
            var titleLine = esc(a.title || aid);
            if (v && v.label) titleLine += ' <span class="text-primary">· ' + esc(v.label) + '</span>';
            row.innerHTML = (selUrl
                ? '<img src="' + esc(selUrl) + '" alt="" class="vplt-guide-sel-thumb" loading="lazy" decoding="async">'
                : '') +
                '<span class="flex-grow-1 text-truncate">' + titleLine + ' <span class="text-muted">(' + esc(kindLabel(a.asset_kind)) + ')</span></span>' +
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
                if (p.category_key) u.searchParams.set('category_key', p.category_key);
                if (p.subcategory_key) u.searchParams.set('subcategory_key', p.subcategory_key);
                return u.pathname + u.search + u.hash;
            } catch (e) { /* fall through */ }
        }
        var designUrl = '/custom-product.html?prototype_asset_id=' + encodeURIComponent(p.id);
        if (p.manufacturer_id) {
            designUrl += '&manufacturer_id=' + encodeURIComponent(p.manufacturer_id);
        }
        if (p.category_key) {
            designUrl += '&category_key=' + encodeURIComponent(p.category_key);
        }
        if (p.subcategory_key) {
            designUrl += '&subcategory_key=' + encodeURIComponent(p.subcategory_key);
        }
        return designUrl;
    }

    function persistGuideSelectionForDesign() {
        if (state.__guidePersistDoneForNav) return;
        state.__guidePersistDoneForNav = true;
        var p = prototypeById(state.selectedPrototypeId);
        try {
            if (p && state.guideSelectedPrototypeVariants.length) {
                sessionStorage.setItem('matchdo.guidePrototypeRefs', JSON.stringify(
                    state.guideSelectedPrototypeVariants.map(function (v) {
                        return {
                            id: p.id,
                            image_url: v.url,
                            label: v.label || '',
                            title: p.title || '',
                            manufacturer_id: p.manufacturer_id || ''
                        };
                    })
                ));
            } else {
                sessionStorage.removeItem('matchdo.guidePrototypeRefs');
            }
            sessionStorage.removeItem('matchdo.guidePrototypeRef');
            if (state.guideSelectedIds.length) {
                var refs = state.guideSelectedIds.map(function (aid) {
                    var a = assetById(aid);
                    var v = getGuideVariant(aid);
                    return {
                        id: aid,
                        image_url: (v && v.url) || (a && a.image_url) || '',
                        label: (v && v.label) || '',
                        title: (a && a.title) || '',
                        asset_kind: a ? a.asset_kind : ''
                    };
                }).filter(function (r) {
                    return r.id && (r.asset_kind === 'material' || r.asset_kind === 'part') && r.image_url;
                });
                if (refs.length) {
                    sessionStorage.setItem('matchdo.guideLinkedAssetRefs', JSON.stringify(refs));
                } else {
                    sessionStorage.removeItem('matchdo.guideLinkedAssetRefs');
                }
            } else {
                sessionStorage.removeItem('matchdo.guideLinkedAssetRefs');
            }
            sessionStorage.removeItem('matchdo.guideLinkedAssetIds');
        } catch (e) {}
    }

    function wireExportPdfButton(prototypeId) {
        var btn = document.getElementById('btn-export-pdf');
        if (!btn || !prototypeId) return;
        if (!btn.__vpltExportWired) {
            btn.__vpltExportWired = true;
            btn.addEventListener('click', function (e) {
                if (!IS_VENDOR) return;
                e.preventDefault();
                var pid = state.selectedPrototypeId;
                if (!pid || !state.token) {
                    showAlert(tr('productTree.loginRequired', '請先登入'), 'warning');
                    return;
                }
                var url = '/api/me/vendor-assets/' + encodeURIComponent(pid) + '/link-tree/export.pdf';
                fetch(url, { headers: { Authorization: 'Bearer ' + state.token } })
                    .then(function (r) {
                        if (!r.ok) throw new Error('pdf');
                        return r.blob();
                    })
                    .then(function (blob) {
                        var a = document.createElement('a');
                        var objUrl = URL.createObjectURL(blob);
                        a.href = objUrl;
                        a.download = 'matchdo-link-tree.pdf';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(function () { URL.revokeObjectURL(objUrl); }, 3000);
                    })
                    .catch(function () {
                        showAlert(tr('productTree.exportPdfFailed', 'PDF 下載失敗'), 'danger');
                    });
            });
        }
        if (IS_VENDOR) {
            btn.href = '#';
            btn.classList.remove('d-none');
        } else {
            btn.href = '/api/vendor-assets/' + encodeURIComponent(prototypeId) + '/link-tree/export.pdf';
            btn.removeAttribute('target');
            btn.classList.remove('d-none');
        }
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
            startBtn.addEventListener('mousedown', function (e) {
                if (e.button === 0) persistGuideSelectionForDesign();
            }, true);
            startBtn.addEventListener('click', persistGuideSelectionForDesign, true);
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
        if (p && p.id) wireExportPdfButton(p.id);
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
        state.guideLinkMetaByAssetId = {};
        state.assets = (data.linked_assets || []).map(function (a) {
            if (a && a.id) {
                state.guideLinkMetaByAssetId[a.id] = {
                    allow_multi_pick: a.allow_multi_pick !== false,
                    pick_group: a.pick_group || null
                };
            }
            return {
                id: a.id,
                title: a.title,
                description: a.description,
                image_url: a.image_url,
                image_urls: a.image_urls,
                image_items: a.image_items,
                asset_kind: a.asset_kind,
                allow_multi_pick: a.allow_multi_pick !== false,
                pick_group: a.pick_group || null
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
        state.guideSelectedPrototypeVariants = [];
        state.guideVariantByAssetId = {};
        state.__guidePersistDoneForNav = false;
        state.guideExpandedAssetIds = Object.create(null);
        state.guidePartSectionExpanded = Object.create(null);
        (data.linked_assets || []).forEach(function (a) {
            if (a && a.id && a.asset_kind === 'part') state.guidePartSectionExpanded[a.id] = true;
        });
        updateGuideChrome(data);
        selectPrototype(p.id);
        seedDefaultPrototypeVariantSelection(p.id);
        refreshVariantCardVisuals(p.id);
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
        wireVariantSheetUi();
        if (IS_VENDOR) initVendor();
        else initGuide();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
