/**
 * 產品設計表單 - 唯一維護的 JS
 * 檔案：public/js/custom-product.js（此檔）
 * 頁面：public/custom-product.html
 * 勿改：public/iStudio-1.0.0/js/custom-product.js
 */
$(document).ready(function () {
    function t(key) { return (window.i18n && window.i18n.t) ? window.i18n.t(key) : key; }
    function tr(key, fallback) {
        var v = t(key);
        return (v && v !== key) ? v : (fallback || key);
    }
    let generatedImageData = null;
    // 從廠商頁「用此廠商版型設計」進入時帶入的廠商 id / 名稱（供「從此廠商版型庫選擇」使用）
    var urlParams = typeof window !== 'undefined' && window.location && window.location.search ? new URLSearchParams(window.location.search) : null;
    var refVendorMfrId = urlParams ? (urlParams.get('manufacturer_id') || '').trim() : '';
    var refVendorName = urlParams ? decodeURIComponent(urlParams.get('vendor_name') || '') : '';
    if (refVendorMfrId) {
        $('#btnRefFromThisVendorAssets').removeClass('d-none');
        if (refVendorName) $('#btnRefFromThisVendorAssets').text((t('customProduct.selectFromVendorBasePrefix') || '從 ') + refVendorName + (t('customProduct.selectFromVendorBaseSuffix') || ' 版型庫選擇'));
        else $('#btnRefFromThisVendorAssets').text(t('customProduct.selectFromThisVendorBase') || '從此廠商版型庫選擇');
        $('#btnRefFromVendorAssets').addClass('d-none');
    }
    let lastGeneratedImageUrl = null;  // 最近一次生成的圖 URL（供儲存到後端）
    let lastGeneratedPrompt = null;    // 最近一次前端輸入的提示詞（必存）
    let lastGeneratedSeed = null;      // 最近一次使用的 Seed（可重現風格，供儲存）

    // 設計行為追蹤：再設計進入時設為 true，生圖成功後送 redesign_generate_ok 並可清除
    window.fromRedesign = !!(typeof sessionStorage !== 'undefined' && sessionStorage.getItem('redesignImageUrl'));

    function trackDesignAction(action) {
        try {
            var blob = new Blob([JSON.stringify({ action: action })], { type: 'application/json' });
            if (navigator.sendBeacon) navigator.sendBeacon('/api/track-design-action', blob);
        } catch (e) {}
    }

    // 圖內容分類：與 browse-styles 共用 CustomProductCatPicker（/api/custom-product-categories）
    let categoriesData = [];
    function syncCategoriesDataFromPicker() {
        if (typeof CustomProductCatPicker !== 'undefined' && CustomProductCatPicker.getCategoriesData) {
            var d = CustomProductCatPicker.getCategoriesData();
            if (d && d.length) categoriesData = d;
        }
    }
    (function loadCategories() {
        if (!$('#imageCategoryMainList').length) return;
        if (typeof CustomProductCatPicker === 'undefined') return;
        CustomProductCatPicker.init().then(function () {
            syncCategoriesDataFromPicker();
            if (typeof updateVendorStylesCategorySummary === 'function') updateVendorStylesCategorySummary();
            if (typeof loadVendorStylesTabList === 'function' && isVendorStylesTabActive()) {
                loadVendorStylesTabList();
            }
        });
    })();

    // 參考圖：4 類用途，每類 0～3 張，全站最多 8 張；送 FLUX 後依實際順序標 image 1…N
    var MAX_REF_IMAGES_TOTAL = 8;
    var MAX_REF_IMAGES_PER_SLOT = 3;
    var REF_INTENT_SLOTS = [
        { key: 'prototype', assetKind: 'prototype', titleKey: 'customProduct.refSlotPrototypeTitle', tabKey: 'customProduct.refSlotPrototypeTab', hintKey: 'customProduct.refSlotPrototypeHint', addonPhKey: 'customProduct.refSlotPrototypeAddonPh', titleFb: '主體原型', tabFb: '原型', hintFb: '幾何結構與尺寸', addonPhFb: '造型補充（選填）' },
        { key: 'material', assetKind: 'material', titleKey: 'customProduct.refSlotMaterialTitle', tabKey: 'customProduct.refSlotMaterialTab', hintKey: 'customProduct.refSlotMaterialHint', addonPhKey: 'customProduct.refSlotMaterialAddonPh', titleFb: '主體材料', tabFb: '材料', hintFb: '表面面料、皮革', addonPhFb: '材料補充（選填）' },
        { key: 'part', assetKind: 'part', titleKey: 'customProduct.refSlotPartTitle', tabKey: 'customProduct.refSlotPartTab', hintKey: 'customProduct.refSlotPartHint', addonPhKey: 'customProduct.refSlotPartAddonPh', titleFb: '配件／零件', tabFb: '配件', hintFb: '五金、拉鍊、掛繩', addonPhFb: '配件勿寫顏色' },
        { key: 'pattern', assetKind: 'other', titleKey: 'customProduct.refSlotPatternTitle', tabKey: 'customProduct.refSlotPatternTab', hintKey: 'customProduct.refSlotPatternHint', addonPhKey: 'customProduct.refSlotPatternAddonPh', titleFb: '圖樣／風格', tabFb: '圖樣', hintFb: '印花、紋理、整體風格', addonPhFb: '圖樣補充（選填）' }
    ];

    function refIntentTabLabel(def) {
        var short = tr(def.tabKey, def.tabFb || '');
        if (short) return short;
        return tr(def.titleKey, def.titleFb);
    }
    function emptyRefSlotGroup() { return { items: [], addon: '' }; }

    var CUSTOMIZATION_LEVEL_DEFS = [
        { key: 'mono_graphic', labelKey: 'customProduct.customLevelMonoGraphic', fb: '單色表面圖文' },
        { key: 'color_graphic', labelKey: 'customProduct.customLevelColorGraphic', fb: '彩色表面圖文' },
        { key: 'color_material', labelKey: 'customProduct.customLevelColorMaterial', fb: '主體顏色／材質' },
        { key: 'size_part', labelKey: 'customProduct.customLevelSizePart', fb: '尺寸／零件' },
        { key: 'form_structure', labelKey: 'customProduct.customLevelFormStructure', fb: '造型／結構' }
    ];
    var refSlots = {
        prototype: emptyRefSlotGroup(),
        material: emptyRefSlotGroup(),
        part: emptyRefSlotGroup(),
        pattern: emptyRefSlotGroup()
    };
    var refIntentActiveTab = 'prototype';

    function ensureRefIntentActiveTab() {
        if (!getRefSlotDef(refIntentActiveTab)) refIntentActiveTab = 'prototype';
    }

    function setRefIntentActiveTab(key) {
        if (!getRefSlotDef(key)) return;
        syncRefSlotsFromDom();
        refIntentActiveTab = key;
        renderIntentSlots();
    }

    var VENDOR_PICKER_PAGE_SIZE_KEY = 'matchdo.vendorPickerPageSize';
    var vendorPickerPageSize = 12;
    var vendorPickerOffset = 0;
    var vendorMfrSuggestTimer = null;
    var vendorMfrSuggestSeq = 0;
    var vendorPickerLastTotal = 0;

    function getRefSlotDef(key) {
        for (var i = 0; i < REF_INTENT_SLOTS.length; i++) {
            if (REF_INTENT_SLOTS[i].key === key) return REF_INTENT_SLOTS[i];
        }
        return null;
    }

    function intentKeyFromAssetKind(kind) {
        var k = (kind != null ? String(kind) : '').trim().toLowerCase();
        if (k === 'material') return 'material';
        if (k === 'part') return 'part';
        if (k === 'other') return 'pattern';
        return 'prototype';
    }

    function syncRefSlotAddonsFromDom() {
        $('#refIntentSlots .ref-slot-addon').each(function () {
            var key = $(this).attr('data-ref-slot');
            if (key && refSlots[key]) refSlots[key].addon = $(this).val() || '';
        });
    }

    function syncRefSlotItemNotesFromDom() {
        $('#refIntentSlots .ref-thumb-note').each(function () {
            var key = $(this).attr('data-ref-slot');
            var idx = parseInt($(this).attr('data-ref-index'), 10);
            if (!key || !refSlots[key] || !refSlots[key].items || isNaN(idx) || idx < 0 || idx >= refSlots[key].items.length) return;
            refSlots[key].items[idx].note = $(this).val() || '';
        });
    }

    function syncRefSlotsFromDom() {
        syncRefSlotAddonsFromDom();
        syncRefSlotItemNotesFromDom();
    }

    function countTotalRefImages() {
        var n = 0;
        REF_INTENT_SLOTS.forEach(function (def) {
            var g = refSlots[def.key];
            if (g && g.items) n += g.items.length;
        });
        return n;
    }

    function countSlotRefImages(key) {
        var g = refSlots[key];
        return (g && g.items) ? g.items.length : 0;
    }

    function canAddMoreRefImages(slotKey, addCount) {
        addCount = addCount || 1;
        if (!getRefSlotDef(slotKey)) return false;
        if (countSlotRefImages(slotKey) + addCount > MAX_REF_IMAGES_PER_SLOT) return false;
        if (countTotalRefImages() + addCount > MAX_REF_IMAGES_TOTAL) return false;
        return true;
    }

    function getPrototypeAnchorSource() {
        var g = refSlots.prototype;
        if (!g || !g.items || !g.items.length) return null;
        var s = g.items[0].source || {};
        var vid = s.vendor_asset_id ? String(s.vendor_asset_id).trim() : '';
        return vid ? s : null;
    }

    function getPrototypeLockVendorAssetId() {
        var anchor = getPrototypeAnchorSource();
        return anchor ? String(anchor.vendor_asset_id).trim() : '';
    }

    function hasVendorPrototypeLock() {
        return !!getPrototypeLockVendorAssetId();
    }

    function getPrototypeLockLevelsSet() {
        var anchor = getPrototypeAnchorSource();
        if (!anchor) return {};
        var set = {};
        parseCustomizationLevelsClient(anchor.customization_levels).forEach(function (k) { set[k] = true; });
        return set;
    }

    var prototypeLinkSummary = { material_count: 0, part_count: 0, loaded: false };
    var prototypeLinkSummaryLoading = false;

    function clearPrototypeLinkSummary() {
        prototypeLinkSummary = { material_count: 0, part_count: 0, loaded: false };
        prototypeLinkSummaryLoading = false;
    }

    function isRefTabCoveredByVendorAssociation(tabKey) {
        if (!hasVendorPrototypeLock() || !prototypeLinkSummary.loaded) return false;
        if (tabKey === 'material') return prototypeLinkSummary.material_count > 0;
        if (tabKey === 'part') return prototypeLinkSummary.part_count > 0;
        return false;
    }

    function refreshPrototypeLinkSummary(done) {
        var id = getPrototypeLockVendorAssetId();
        if (!id) {
            clearPrototypeLinkSummary();
            if (typeof done === 'function') done();
            return;
        }
        var anchor = getPrototypeAnchorSource();
        var url = '/api/vendor-assets/prototype-link-summary?prototype_asset_id=' + encodeURIComponent(id);
        if (anchor && anchor.manufacturer_id) {
            url += '&manufacturer_id=' + encodeURIComponent(anchor.manufacturer_id);
        }
        prototypeLinkSummaryLoading = true;
        fetch(url).then(function (r) { return r.json(); }).then(function (data) {
            prototypeLinkSummary = {
                material_count: Number(data && data.material_count) || 0,
                part_count: Number(data && data.part_count) || 0,
                loaded: true
            };
        }).catch(function () {
            prototypeLinkSummary.loaded = true;
        }).finally(function () {
            prototypeLinkSummaryLoading = false;
            if (typeof done === 'function') done();
        });
    }

    function isRefTabScopeHighlighted(tabKey) {
        if (!hasVendorPrototypeLock()) return false;
        var set = getPrototypeLockLevelsSet();
        if (tabKey === 'prototype') return true;
        if (tabKey === 'material') return !!set.color_material;
        if (tabKey === 'part') return !!set.size_part;
        if (tabKey === 'pattern') return !!(set.mono_graphic || set.color_graphic);
        return false;
    }

    /** 無關聯時：依主產品 customization_levels；有關聯該類材／配則視為已提供 */
    function isRefSlotSupportedByPrototypeLock(slotKey) {
        if (!slotKey || slotKey === 'prototype') return true;
        if (!hasVendorPrototypeLock()) return true;
        if (isRefTabCoveredByVendorAssociation(slotKey)) return true;
        return isRefTabScopeHighlighted(slotKey);
    }

    function shouldShowRefTabScopeWarn(slotKey) {
        if (!slotKey || slotKey === 'prototype' || !hasVendorPrototypeLock()) return false;
        if (prototypeLinkSummaryLoading) return false;
        return !isRefSlotSupportedByPrototypeLock(slotKey);
    }

    function getRefSlotScopeLevelKeys(slotKey) {
        if (slotKey === 'material') return ['color_material'];
        if (slotKey === 'part') return ['size_part'];
        if (slotKey === 'pattern') return ['mono_graphic', 'color_graphic'];
        return [];
    }

    function getUnsupportedRefSlotLevelLabels(slotKey) {
        return getRefSlotScopeLevelKeys(slotKey).map(function (k) { return customizationLevelLabel(k); }).join('、');
    }

    function getUnsupportedRefSlotWarningText(slotKey, variant) {
        if (!slotKey || slotKey === 'prototype' || isRefSlotSupportedByPrototypeLock(slotKey)) return '';
        var def = getRefSlotDef(slotKey);
        if (!def) return '';
        var anchor = getPrototypeAnchorSource();
        var title = (anchor && anchor.title) ? String(anchor.title).trim() : tr('customProduct.refSlotPrototypeTab', '原型');
        var levels = getUnsupportedRefSlotLevelLabels(slotKey);
        var tab = tr(def.tabKey, def.tabFb);
        var tpl;
        if (variant === 'alert') {
            tpl = tr('customProduct.refSlotUnsupportedOnAddAlert',
                '廠商對數位原型「{title}」未開放「{levels}」訂製。您仍可使用「{tab}」參考，生圖後請向廠商確認能否製造。');
        } else if (variant === 'generate') {
            tpl = tr('customProduct.refSlotUnsupportedGenerateItem',
                '「{tab}」參考：廠商未開放「{levels}」訂製');
        } else if (variant === 'picker') {
            tpl = tr('customProduct.refSlotUnsupportedPickerHint',
                '此數位原型的廠商未開放「{levels}」訂製。仍可選「{tab}」素材作參考，但廠商可能無法製造。');
        } else if (variant === 'muted') {
            tpl = tr('customProduct.refSlotUnsupportedMutedHint',
                '此數位原型的廠商未開放「{levels}」訂製。您仍可在「{tab}」上傳參考，但廠商可能無法依此製造。');
        } else {
            tpl = tr('customProduct.refSlotUnsupportedActiveWarning',
                '廠商對數位原型「{title}」未開放「{levels}」訂製。已加入的「{tab}」參考仍可生圖，但廠商可能無法製造。');
        }
        return tpl.replace(/\{title\}/g, title).replace(/\{levels\}/g, levels).replace(/\{tab\}/g, tab);
    }

    function showRefScopeWarnDetail(message) {
        if (!message) return;
        var body = document.getElementById('refScopeWarnModalBody');
        if (body) body.textContent = message;
        var el = document.getElementById('refScopeWarnModal');
        if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            var inst = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
            inst.show();
            return;
        }
        alert(message);
    }

    function createRefScopeWarnBtn(message) {
        var label = tr('customProduct.refScopeWarnAria', '超出廠商訂製範圍，點擊查看說明');
        return $('<button type="button" class="btn btn-link p-0 ref-scope-warn-btn flex-shrink-0"></button>')
            .attr('aria-label', label)
            .attr('title', label)
            .html('⚠️')
            .on('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                showRefScopeWarnDetail(message);
            });
    }

    function refSlotHasCustomizationContent(slotKey) {
        var g = refSlots[slotKey];
        if (!g) return false;
        if (g.items && g.items.length) return true;
        return !!((g.addon || '').trim());
    }

    function collectUnsupportedRefSlotWarnings() {
        var lines = [];
        REF_INTENT_SLOTS.forEach(function (def) {
            if (def.key === 'prototype') return;
            if (!refSlotHasCustomizationContent(def.key)) return;
            if (isRefSlotSupportedByPrototypeLock(def.key)) return;
            var line = getUnsupportedRefSlotWarningText(def.key, 'generate');
            if (line) lines.push(line);
        });
        return lines;
    }

    function alertUnsupportedRefScopeBeforeGenerate() {
        var lines = collectUnsupportedRefSlotWarnings();
        if (!lines.length) return;
        var tpl = tr('customProduct.refSlotUnsupportedGenerateWarn',
            '以下參考涉及廠商未開放的訂製項目（仍可繼續生圖）：\n\n{list}\n\n下單前請向廠商確認能否製造。');
        showRefScopeWarnDetail(tpl.replace('{list}', lines.join('\n')));
    }

    function updateVendorPickerUnsupportedScopeHint() {
        var $hint = $('#vendorAssetsPickerUnsupportedScopeHint');
        if (!$hint.length) return;
        var slot = null;
        try { slot = window.__refImportTargetSlot; } catch (e) { slot = null; }
        $hint.empty();
        if (!slot || slot === 'prototype' || !shouldShowRefTabScopeWarn(slot)) {
            $hint.addClass('d-none');
            return;
        }
        var msg = getUnsupportedRefSlotWarningText(slot, 'picker');
        if (!msg) {
            $hint.addClass('d-none');
            return;
        }
        $hint.removeClass('d-none').append(createRefScopeWarnBtn(msg));
    }

    function validatePrototypeSlotAdd(source) {
        var g = refSlots.prototype;
        if (!g || !g.items || !g.items.length) return true;
        var lock = getPrototypeLockVendorAssetId();
        var vid = source && source.vendor_asset_id ? String(source.vendor_asset_id).trim() : '';
        if (lock) {
            if (vid && vid !== lock) {
                var title = (g.items[0].source && g.items[0].source.title) || '';
                var tpl = tr('customProduct.prototypeLockDifferentAsset',
                    '原型已鎖定為「{title}」，無法加入其他數位原型。請先清空「原型」類別後再換。');
                alert(tpl.replace('{title}', title || tr('customProduct.refSlotPrototypeTab', '原型')));
                return false;
            }
            return true;
        }
        if (vid) {
            alert(tr('customProduct.prototypeNeedVendorFirst',
                '原型已使用本機上傳的圖片。若要使用廠商數位原型，請先清空「原型」類別，再從素材庫選擇。'));
            return false;
        }
        return true;
    }

    function filterPrototypeVendorImageItems(imageItems) {
        var existing = {};
        (refSlots.prototype.items || []).forEach(function (it) {
            var u = ((it.source && it.source.image_url) || it.url || '').trim();
            if (u) existing[u] = true;
        });
        return (imageItems || []).filter(function (it) {
            var u = (it.url || '').trim();
            return u && !existing[u];
        });
    }

    function clearRefSlot(key) {
        if (!refSlots[key]) return;
        refSlots[key] = emptyRefSlotGroup();
        if (key === 'prototype') clearPrototypeLinkSummary();
    }

    function addRefImageToSlot(key, url, source) {
        if (!refSlots[key] || !url) return false;
        if (!canAddMoreRefImages(key, 1)) return false;
        if (key === 'prototype' && !validatePrototypeSlotAdd(source || {})) return false;
        var def = getRefSlotDef(key);
        refSlots[key].items.push({
            url: url,
            note: '',
            source: Object.assign({ asset_kind: def ? def.assetKind : 'prototype' }, source || {})
        });
        return true;
    }

    function removeRefImageFromSlot(key, index) {
        var g = refSlots[key];
        if (!g || !g.items || index < 0 || index >= g.items.length) return;
        g.items.splice(index, 1);
    }

    function getRefKindCounts() {
        syncRefSlotsFromDom();
        var c = { prototype: 0, material: 0, part: 0, other: 0, total: 0 };
        REF_INTENT_SLOTS.forEach(function (def) {
            var n = countSlotRefImages(def.key);
            if (!n) return;
            c.total += n;
            if (def.key === 'pattern') c.other += n;
            else c[def.key] += n;
        });
        return c;
    }

    function buildSuggestedPrompt() {
        if (getRefKindCounts().total === 0) return '';
        return t('customProduct.promptSuggestImg2imgMinimal');
    }

    function appendPromptFragment(fragment, target) {
        var frag = (fragment || '').trim();
        if (!frag) return;
        var $ta;
        if (target === 'main' || !target) $ta = $('#productPrompt');
        else $ta = $('#refIntentSlots .ref-slot-addon[data-ref-slot="' + target + '"]');
        if (!$ta.length) return;
        var cur = ($ta.val() || '').trim();
        if (!cur) $ta.val(frag);
        else if (cur.indexOf(frag) < 0) $ta.val(cur + (/[，,。．.\s]$/.test(cur) ? '' : '，') + frag);
        if (target && target !== 'main' && refSlots[target]) refSlots[target].addon = $ta.val() || '';
        $ta.trigger('input');
    }

    function collectOrderedRefItemsWithIndex() {
        syncRefSlotsFromDom();
        var items = [];
        REF_INTENT_SLOTS.forEach(function (def) {
            var g = refSlots[def.key];
            if (!g || !g.items.length) return;
            var rank = def.key === 'prototype' ? 0 : (def.key === 'part' ? 1 : (def.key === 'material' ? 2 : 3));
            g.items.forEach(function (item) {
                if (!item || !item.url) return;
                items.push({ rank: rank, item: item, slotKey: def.key });
            });
        });
        items.sort(function (a, b) { return a.rank - b.rank; });
        return items.slice(0, MAX_REF_IMAGES_TOTAL);
    }

    function composeUserPromptForGenerate() {
        syncRefSlotsFromDom();
        var main = ($('#productPrompt').val() || '').trim();
        var addonLines = REF_INTENT_SLOTS.map(function (def) {
            var a = (refSlots[def.key].addon || '').trim();
            if (!a) return '';
            return tr(def.titleKey, def.titleFb) + '：' + a;
        }).filter(Boolean);
        var perImageLines = [];
        collectOrderedRefItemsWithIndex().forEach(function (row, idx) {
            var note = (row.item.note || '').trim();
            if (!note) return;
            perImageLines.push('image ' + (idx + 1) + '：' + note);
        });
        var blocks = [main].concat(addonLines).concat(perImageLines).filter(Boolean);
        if (blocks.length) return blocks.join('\n');
        if (getRefKindCounts().total > 0) return buildSuggestedPrompt();
        return '';
    }

    function collectReferencePayload() {
        syncRefSlotsFromDom();
        var items = [];
        REF_INTENT_SLOTS.forEach(function (def) {
            var g = refSlots[def.key];
            if (!g || !g.items.length) return;
            var rank = def.key === 'prototype' ? 0 : (def.key === 'part' ? 1 : (def.key === 'material' ? 2 : 3));
            g.items.forEach(function (item) {
                if (!item || !item.url) return;
                var note = (item.note || '').trim();
                items.push({
                    rank: rank,
                    url: item.url,
                    src: Object.assign({}, item.source || {}, {
                        asset_kind: def.assetKind,
                        user_note: note || undefined
                    })
                });
            });
        });
        items.sort(function (a, b) { return a.rank - b.rank; });
        items = items.slice(0, MAX_REF_IMAGES_TOTAL);
        return {
            referenceImages: items.map(function (it) { return it.url; }),
            referenceSources: items.map(function (it) { return it.src; })
        };
    }

    function getActiveRefSourcesList() {
        var list = [];
        REF_INTENT_SLOTS.forEach(function (def) {
            var g = refSlots[def.key];
            if (!g || !g.items.length) return;
            g.items.forEach(function (item) {
                if (!item || !item.url) return;
                list.push(Object.assign({}, item.source || {}, {
                    asset_kind: def.assetKind,
                    image_url: (item.source && item.source.image_url) || item.url
                }));
            });
        });
        return list;
    }

    function updateMultiVendorRefWarning() {
        var $el = $('#refMultiVendorWarning');
        if (!$el.length) return;
        var byId = {};
        getActiveRefSourcesList().forEach(function (s) {
            if (s && s.manufacturer_id) {
                byId[s.manufacturer_id] = (s.manufacturer_name || '').trim() || (t('customProduct.vendorFallback') || '廠商');
            }
        });
        var keys = Object.keys(byId);
        if (keys.length <= 1) {
            $el.addClass('d-none').empty();
            return;
        }
        var names = keys.map(function (k) { return byId[k]; }).join('、');
        var tpl = t('customProduct.multiVendorWarning') || '已混用多家廠商（{names}），下單前請確認。';
        $el.removeClass('d-none').text(tpl.replace('{names}', names));
        updateVendorPickerMultiVendorHint();
    }

    function readFileIntoRefSlot(slotKey, file) {
        if (!file || !getRefSlotDef(slotKey)) return;
        if (!canAddMoreRefImages(slotKey, 1)) {
            alert(tr('customProduct.refSlotsFull', '參考圖已滿（每類最多 ' + MAX_REF_IMAGES_PER_SLOT + ' 張，共 ' + MAX_REF_IMAGES_TOTAL + ' 張）'));
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            var def = getRefSlotDef(slotKey);
            if (addRefImageToSlot(slotKey, reader.result, { asset_kind: def.assetKind })) {
                refIntentActiveTab = slotKey;
                renderIntentSlots();
            }
        };
        reader.onerror = function () { alert(tr('customProduct.loadFailed', '讀取圖片失敗')); };
        reader.readAsDataURL(file);
    }

    function renderRefIntentPanel(def) {
        var g = refSlots[def.key];
        var items = (g && g.items) ? g.items : [];
        var canAdd = canAddMoreRefImages(def.key, 1);
        var slotKey = def.key;
        var $panel = $('<div class="ref-intent-panel"></div>').attr('data-ref-panel', slotKey);
        var hintText = tr(def.hintKey, def.hintFb);
        if (def.key === 'prototype' && items.length && !hasVendorPrototypeLock()) {
            hintText = tr('customProduct.refPrototypeLocalHint',
                '目前為本機圖片，無廠商訂製範圍。請清空後從素材庫選擇數位原型以顯示可訂製項目。');
        }
        var $hintRow = $('<div class="ref-intent-hint-row d-flex align-items-start gap-1 mb-1"></div>');
        $hintRow.append($('<div class="ref-intent-hint flex-grow-1 mb-0"></div>')
            .attr('data-i18n', def.key === 'prototype' && items.length && !hasVendorPrototypeLock() ? 'customProduct.refPrototypeLocalHint' : def.hintKey)
            .text(hintText));
        if (shouldShowRefTabScopeWarn(def.key)) {
            var scopeVariant = refSlotHasCustomizationContent(def.key) ? 'active' : 'muted';
            var scopeMsg = getUnsupportedRefSlotWarningText(def.key, scopeVariant);
            if (scopeMsg) $hintRow.append(createRefScopeWarnBtn(scopeMsg));
        }
        $panel.append($hintRow);
        if (def.key === 'prototype') {
            var anchor = getPrototypeAnchorSource();
            if (anchor) {
                var $scope = $('<div class="ref-intent-scope-block"></div>');
                if (appendPrototypeScopeInline($scope, anchor)) $panel.append($scope);
                if (prototypeLinkSummary.loaded) {
                    var mc = prototypeLinkSummary.material_count;
                    var pc = prototypeLinkSummary.part_count;
                    if (mc > 0 || pc > 0) {
                        var sumTpl = tr('customProduct.prototypeLinkedSummary',
                            '廠商已關聯：材料 {m} 筆、配件 {p} 筆。請在「材料」「配件」分頁點「素材庫」；推薦項目會以品牌色標示。');
                        $panel.append($('<div class="alert alert-light border small py-2 mb-2 ref-intent-linked-summary"></div>')
                            .text(sumTpl.replace('{m}', String(mc)).replace('{p}', String(pc))));
                    }
                }
                var anchorId = anchor && anchor.vendor_asset_id ? String(anchor.vendor_asset_id).trim() : '';
                if (anchorId) {
                    var returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                    var treeUrl = '/product-tree.html?prototype_asset_id=' + encodeURIComponent(anchorId) + '&return_to=' + returnTo;
                    var treeTpl = tr('customProduct.openMatchGuide', '看此款式的可搭配');
                    $panel.append($('<p class="mb-2 mt-1"><a href="' + treeUrl + '" class="small"></a></p>')
                        .find('a').text(treeTpl));
                }
            }
        } else if ((def.key === 'material' || def.key === 'part') && hasVendorPrototypeLock() && prototypeLinkSummary.loaded) {
            var linkN = def.key === 'material' ? prototypeLinkSummary.material_count : prototypeLinkSummary.part_count;
            if (linkN > 0) {
                var tabLbl = tr(def.tabKey, def.tabFb);
                var tabTpl = tr('customProduct.refTabLinkedSummary',
                    '此主產品已關聯 {n} 筆「{tab}」素材。請點「素材庫」；推薦項目會排前並標示「廠商推薦」。');
                $panel.prepend($('<div class="alert alert-light border small py-2 mb-2 ref-intent-linked-summary"></div>')
                    .text(tabTpl.replace('{n}', String(linkN)).replace('{tab}', tabLbl)));
            }
        }
        var $thumbs = $('<div class="ref-intent-thumbs"></div>');
        items.forEach(function (item, ii) {
            var capText = refIntentThumbCaption(item, ii);
            var $cell = $('<div class="ref-intent-thumb-cell"></div>');
            var $thumb = $('<div class="ref-intent-thumb"></div>');
            $thumb.append($('<img alt="">').attr('src', item.url).attr('title', capText));
            $thumb.append($('<button type="button" class="ref-intent-clear" aria-label="移除">×</button>').on('click', function (e) {
                e.stopPropagation();
                removeRefImageFromSlot(slotKey, ii);
                renderIntentSlots();
            }));
            $thumb.on('click', function (e) {
                if ($(e.target).closest('.ref-intent-clear').length) return;
                openRefImagePreviewModal(slotKey, ii);
            });
            $cell.append($thumb);
            $cell.append($('<div class="ref-intent-thumb-caption"></div>').text(capText).attr('title', capText));
            var notePh = tr('customProduct.refThumbNotePh', '此圖補充，例：裝在左側');
            var $note = $('<input type="text" class="form-control form-control-sm ref-thumb-note">')
                .attr('data-ref-slot', slotKey)
                .attr('data-ref-index', String(ii))
                .attr('placeholder', notePh)
                .val((item.note || '').trim());
            $note.on('click mousedown', function (e) { e.stopPropagation(); });
            $cell.append($note);
            $thumbs.append($cell);
        });
        if (canAdd) {
            var $fileIn = $('<input type="file" accept="image/*" class="ref-intent-file">');
            $fileIn.on('change', function (e) {
                var f = e.target.files && e.target.files[0];
                if (f) readFileIntoRefSlot(slotKey, f);
                e.target.value = '';
            });
            var $add = $('<label class="ref-intent-thumb ref-intent-thumb-add"></label>');
            $add.append($fileIn).append($('<span class="ref-intent-empty"><i class="fas fa-plus"></i></span>'));
            $thumbs.append($add);
        }
        $panel.append($thumbs);
        var $actions = $('<div class="ref-intent-actions"></div>');
        $actions.append($('<button type="button" class="btn btn-sm ref-intent-btn ref-intent-btn--lib"></button>')
            .attr('data-i18n', 'customProduct.refSlotPickVendor')
            .text(tr('customProduct.refSlotPickVendor', '素材庫'))
            .on('click', function (e) { e.preventDefault(); openVendorPickerForRefSlot(slotKey); }));
        if (items.length) {
            $actions.append($('<button type="button" class="btn btn-sm ref-intent-btn ref-intent-btn--up"></button>')
                .text(tr('customProduct.refSlotClearAll', '清空'))
                .on('click', function (e) {
                    e.preventDefault();
                    if (window.confirm(tr('customProduct.refSlotClearAllConfirm', '清除此類別所有參考圖？'))) {
                        clearRefSlot(slotKey);
                        renderIntentSlots();
                    }
                }));
        }
        $panel.append($actions);
        var $addonWrap = $('<details class="ref-intent-addon-details"></details>');
        $addonWrap.append($('<summary class="ref-intent-addon-summary"></summary>')
            .attr('data-i18n', 'customProduct.refSlotAddonSummary')
            .text(tr('customProduct.refSlotAddonSummary', '此類補充說明（選填）')));
        $addonWrap.append($('<input type="text" class="form-control form-control-sm ref-slot-addon">')
            .attr('data-ref-slot', slotKey)
            .attr('data-i18n-placeholder', def.addonPhKey)
            .attr('placeholder', tr(def.addonPhKey, def.addonPhFb))
            .val((g && g.addon) || ''));
        if (((g && g.addon) || '').trim()) $addonWrap.prop('open', true);
        $panel.append($addonWrap);
        return $panel;
    }

    function renderIntentSlots() {
        var $root = $('#refIntentSlots');
        if (!$root.length) return;
        syncRefSlotsFromDom();
        ensureRefIntentActiveTab();
        $root.empty();
        var total = countTotalRefImages();
        var activeDef = getRefSlotDef(refIntentActiveTab);
        if (!activeDef) activeDef = REF_INTENT_SLOTS[0];

        var $wrap = $('<div class="ref-intent-tabs-wrap"></div>');
        var $navRow = $('<div class="ref-intent-tabs-nav"></div>');
        var $scroll = $('<div class="ref-intent-tabs-scroll" role="tablist"></div>');
        var vendorLock = hasVendorPrototypeLock();
        REF_INTENT_SLOTS.forEach(function (def) {
            var n = countSlotRefImages(def.key);
            var isActive = def.key === activeDef.key;
            var scopeOn = isRefTabScopeHighlighted(def.key);
            var tabSupported = isRefSlotSupportedByPrototypeLock(def.key);
            var $btn = $('<button type="button" class="ref-intent-tab-btn" role="tab"></button>')
                .attr('data-ref-tab', def.key)
                .attr('aria-selected', isActive ? 'true' : 'false')
                .toggleClass('active', isActive);
            if (def.key === 'prototype') {
                $btn.toggleClass('ref-intent-tab-btn--anchor', vendorLock);
                $btn.toggleClass('ref-intent-tab-btn--scope-off', !vendorLock && !isActive);
            } else {
                $btn.toggleClass('ref-intent-tab-btn--scope-on', vendorLock && scopeOn && !isActive);
                $btn.toggleClass('ref-intent-tab-btn--scope-off', vendorLock && !tabSupported && !isActive);
            }
            var tabText = refIntentTabLabel(def);
            $btn.attr('title', tr(def.titleKey, def.titleFb));
            $btn.append($('<span class="ref-intent-tab-label"></span>').attr('data-i18n', def.tabKey).text(tabText));
            var $badge = $('<span class="ref-intent-tab-badge"></span>').text(n ? String(n) : '');
            if (!n) $badge.addClass('d-none');
            $btn.append($badge);
            if (shouldShowRefTabScopeWarn(def.key)) {
                var tabWarnMsg = getUnsupportedRefSlotWarningText(def.key,
                    refSlotHasCustomizationContent(def.key) ? 'active' : 'muted');
                if (tabWarnMsg) $btn.append(createRefScopeWarnBtn(tabWarnMsg));
            }
            $btn.on('click', function (e) {
                e.preventDefault();
                if ($(e.target).closest('.ref-scope-warn-btn').length) return;
                setRefIntentActiveTab(def.key);
            });
            $scroll.append($btn);
        });
        $navRow.append($scroll);
        $navRow.append($('<span class="ref-intent-total-pill" id="refIntentTabTotal"></span>')
            .text(total ? (total + ' / ' + MAX_REF_IMAGES_TOTAL) : ('0 / ' + MAX_REF_IMAGES_TOTAL)));
        $wrap.append($navRow);
        $wrap.append(renderRefIntentPanel(activeDef));
        $root.append($wrap);

        if (window.i18n && typeof window.i18n.applyPage === 'function') window.i18n.applyPage();
        updateMultiVendorRefWarning();
        if (hasVendorPrototypeLock() && !prototypeLinkSummary.loaded && !prototypeLinkSummaryLoading) {
            refreshPrototypeLinkSummary(function () { renderIntentSlots(); });
        }
    }
    window.__renderIntentSlots = renderIntentSlots;

    function customizationLevelLabel(key) {
        for (var i = 0; i < CUSTOMIZATION_LEVEL_DEFS.length; i++) {
            if (CUSTOMIZATION_LEVEL_DEFS[i].key === key) {
                return tr(CUSTOMIZATION_LEVEL_DEFS[i].labelKey, CUSTOMIZATION_LEVEL_DEFS[i].fb);
            }
        }
        return key;
    }

    function buildPrototypeCustomizationBadgesHtml(item) {
        var levels = parseCustomizationLevelsClient(item.customization_levels);
        if (!levels.length) return '';
        var levelSet = {};
        levels.forEach(function (k) { levelSet[k] = true; });
        var html = '<div class="vendor-custom-badges d-flex flex-wrap gap-1 mb-0">';
        var n = 0;
        CUSTOMIZATION_LEVEL_DEFS.forEach(function (def) {
            if (!levelSet[def.key]) return;
            n++;
            var lbl = customizationLevelLabel(def.key).replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var title = tr('customProduct.vendorCustomBadgeSupportedTitle', '廠商在此數位原型已開放此訂製');
            html += '<span class="badge vendor-custom-badge vendor-custom-badge--supported" title="' +
                title.replace(/"/g, '&quot;') + '">' + lbl + '</span>';
        });
        html += '</div>';
        return n ? html : '';
    }

    function buildPrototypeScopeInlineHtml(item) {
        var badges = buildPrototypeCustomizationBadgesHtml(item);
        if (!badges) return '';
        var label = tr('customProduct.vendorScopeInlineLabel', '此廠商／產品訂製範圍：');
        var safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<div class="prototype-scope-inline">' +
            '<span class="prototype-scope-inline-label" data-i18n="customProduct.vendorScopeInlineLabel">' + safeLabel + '</span>' +
            badges.replace('class="vendor-custom-badges', 'class="vendor-custom-badges prototype-scope-inline-badges') +
            '</div>';
    }

    function appendPrototypeScopeInline($parent, item) {
        var html = buildPrototypeScopeInlineHtml(item);
        if (!html || !$parent || !$parent.length) return false;
        $parent.append($(html));
        return true;
    }

    function updateVendorPickerPrototypeLockHint() {
        var $hint = $('#vendorAssetsPickerPrototypeLockHint');
        if (!$hint.length) return;
        var slot = null;
        try { slot = window.__refImportTargetSlot; } catch (e) { slot = null; }
        if (slot !== 'prototype') {
            $hint.addClass('d-none').empty();
            return;
        }
        var lock = getPrototypeLockVendorAssetId();
        if (!lock) {
            $hint.addClass('d-none').empty();
            return;
        }
        var anchor = getPrototypeAnchorSource();
        var title = anchor && anchor.title ? String(anchor.title).trim() : '';
        var tpl = tr('customProduct.vendorPickerPrototypeLockHint',
            '已鎖定原型「{title}」，僅可再加入同一數位原型的其他角度。若要換原型，請先清空設計頁的「原型」類別。');
        $hint.removeClass('d-none').text(tpl.replace('{title}', title || '—'));
    }

    function updateVendorPickerLinkedLegend() {
        var $legend = $('#vendorAssetsPickerLinkedLegend');
        if (!$legend.length) return;
        var pickerKind = ($('#vendorAssetsAssetKind').val() || '').trim();
        if (!hasVendorPrototypeLock() || (pickerKind !== 'material' && pickerKind !== 'part')) {
            $legend.addClass('d-none').empty();
            return;
        }
        var anchor = getPrototypeAnchorSource();
        var title = anchor && anchor.title ? String(anchor.title).trim() : '';
        var tpl = tr('customProduct.vendorPickerLinkedLegend',
            '與主產品「{title}」有關聯的素材會以品牌色標示並排前；其餘仍可選用。');
        $legend.removeClass('d-none').text(tpl.replace('{title}', title || '—'));
    }

    function applyPrototypeLockToVendorPickerCards($list) {
        var slot = null;
        try { slot = window.__refImportTargetSlot; } catch (e) { slot = null; }
        if (slot !== 'prototype') {
            $list.find('.vendor-asset-card').removeClass('vendor-asset-card--prototype-locked-out');
            return;
        }
        var lock = getPrototypeLockVendorAssetId();
        if (!lock) {
            $list.find('.vendor-asset-card').removeClass('vendor-asset-card--prototype-locked-out');
            return;
        }
        $list.find('.vendor-asset-card').each(function () {
            var $c = $(this);
            var id = ($c.attr('data-vendor-asset-id') || '').trim();
            var kind = ($c.attr('data-asset-kind') || '').trim();
            $c.toggleClass('vendor-asset-card--prototype-locked-out', kind !== 'prototype' || id !== lock);
        });
    }

    function openCategoryVendorPicker(slotKey) {
        var mainKey = ($('#imageCategoryMainSelect').val() || '').trim();
        if (!mainKey) {
            alert(t('customProduct.selectCategoryFirstForVendorAssets') || '請先選擇主分類，素材庫會依此分類載入。');
            return;
        }
        var subKey = ($('#imageCategorySubSelect').val() || '').trim();
        try { window.__refImportTargetSlot = slotKey || null; } catch (e) {}
        if (slotKey && getRefSlotDef(slotKey)) refIntentActiveTab = slotKey;
        resetVendorAssetFilters();
        var def = slotKey ? getRefSlotDef(slotKey) : null;
        if (def && def.assetKind !== 'other') $('#vendorAssetsAssetKind').val(def.assetKind);
        setVendorPickerMfrScopedMode(false);
        updateVendorPickerPrototypeFiltersVisibility();
        syncVendorPickerSubcategoryForAssetKind();
        var pickerLabel = def ? tr(def.titleKey, def.titleFb) : tr('customProduct.selectFromVendorAssets', '從廠商素材庫選擇');
        $('#vendorAssetsPickerLabel').text(pickerLabel);
        updateVendorPickerDesignCategoryDisplay();
        var modalEl = document.getElementById('vendorAssetsPickerModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            (new bootstrap.Modal(modalEl)).show();
        }
        vendorPickerOffset = 0;
        setVendorPickerPageSize(readVendorPickerPageSize());
        try {
            window.__vendorAssetsFetchParams = {
                mode: 'category',
                mainKey: mainKey,
                subKey: pickerSubcategoryAppliesToAssetKind() ? subKey : ''
            };
        } catch (e) {}
        fillVendorServiceAreaSelect().then(function () {
            updateVendorPickerMultiVendorHint();
            updateVendorPickerPrototypeLockHint();
            updateVendorPickerLinkedLegend();
            updateVendorPickerUnsupportedScopeHint();
            loadVendorAssetsPickerList();
        });
    }
    function openVendorPickerForRefSlot(slotKey) {
        openCategoryVendorPicker(slotKey);
    }
    window.openVendorPickerForRefSlot = openVendorPickerForRefSlot;

    function showGeneratedResult() {
        $('#generatedImagePlaceholder').hide();
        $('#generatedImagePreviewWrap').addClass('has-result');
    }

    function applyGuideLinkedAssetsFromSession(treeData) {
        var raw = null;
        try {
            raw = sessionStorage.getItem('matchdo.guideLinkedAssetRefs') ||
                sessionStorage.getItem('matchdo.guideLinkedAssetIds');
        } catch (e) {}
        if (!raw) return Promise.resolve();
        try {
            sessionStorage.removeItem('matchdo.guideLinkedAssetIds');
            sessionStorage.removeItem('matchdo.guideLinkedAssetRefs');
        } catch (e) {}
        var parsed;
        try { parsed = JSON.parse(raw); } catch (e) { return Promise.resolve(); }
        if (!Array.isArray(parsed) || !parsed.length || !treeData) return Promise.resolve();
        var refs = parsed.map(function (entry) {
            if (entry && typeof entry === 'object' && entry.id) return entry;
            return { id: String(entry || '') };
        }).filter(function (r) { return r.id; });
        var linked = treeData.linked_assets || [];
        var byId = {};
        linked.forEach(function (a) { if (a && a.id) byId[a.id] = a; });
        var proto = treeData.prototype || {};
        var chain = Promise.resolve();
        refs.forEach(function (ref) {
            var a = byId[ref.id];
            if (!a) return;
            var slotKey = a.asset_kind === 'material' ? 'material' : (a.asset_kind === 'part' ? 'part' : null);
            if (!slotKey) return;
            var imgUrl = (ref.image_url || a.image_url || '').trim();
            if (!imgUrl || !canAddMoreRefImages(slotKey, 1)) return;
            var refTitle = (a.title || '').trim();
            var variantLabel = (ref.label || '').trim();
            if (variantLabel) refTitle = refTitle ? (refTitle + ' · ' + variantLabel) : variantLabel;
            chain = chain.then(function () {
                return fetchUrlAsDataUrl(imgUrl).then(function (dataUrl) {
                    addRefImageToSlot(slotKey, dataUrl, {
                        vendor_asset_id: a.id,
                        manufacturer_id: proto.manufacturer_id,
                        manufacturer_name: proto.manufacturer_name,
                        title: refTitle || a.title,
                        image_url: imgUrl,
                        asset_kind: a.asset_kind,
                        gallery_label: variantLabel || undefined
                    });
                });
            });
        });
        return chain;
    }

    function applyPrototypeAssetIdFromUrl() {
        if (!urlParams) return;
        var pid = (urlParams.get('prototype_asset_id') || '').trim();
        if (!pid || getPrototypeLockVendorAssetId() === pid) return;
        fetch('/api/vendor-assets/' + encodeURIComponent(pid) + '/link-tree')
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
            .then(function (res) {
                if (!res.ok || !res.data || !res.data.prototype) return;
                var treeData = res.data;
                var p = treeData.prototype;
                var imgUrl = (p.image_url || '').trim();
                if (!imgUrl) return;
                return fetchUrlAsDataUrl(imgUrl).then(function (dataUrl) {
                    clearRefSlot('prototype');
                    addRefImageToSlot('prototype', dataUrl, {
                        vendor_asset_id: p.id,
                        manufacturer_id: p.manufacturer_id,
                        manufacturer_name: p.manufacturer_name,
                        title: p.title,
                        image_url: imgUrl,
                        asset_kind: 'prototype'
                    });
                    if (p.manufacturer_id && !refVendorMfrId) {
                        refVendorMfrId = p.manufacturer_id;
                        if (p.manufacturer_name) refVendorName = p.manufacturer_name;
                    }
                    return applyGuideLinkedAssetsFromSession(treeData);
                }).then(function () {
                    renderIntentSlots();
                    refreshPrototypeLinkSummary(function () { renderIntentSlots(); });
                });
            })
            .catch(function () {});
    }

    function initRefIntentUi() {
        renderIntentSlots();
        var redesignUrl = null;
        try { redesignUrl = sessionStorage.getItem('redesignImageUrl'); } catch (e) {}
        if (!redesignUrl && typeof URLSearchParams !== 'undefined') {
            var params = new URLSearchParams(window.location.search);
            redesignUrl = params.get('image_url') || params.get('imageUrl') || '';
            if (redesignUrl) redesignUrl = redesignUrl.trim();
            if (!redesignUrl) redesignUrl = null;
        }
        if (redesignUrl) {
            try { sessionStorage.removeItem('redesignImageUrl'); } catch (e) {}
            clearRefSlot('prototype');
            addRefImageToSlot('prototype', redesignUrl, { asset_kind: 'prototype' });
            renderIntentSlots();
        } else {
            applyPrototypeAssetIdFromUrl();
        }
    }

    $(function () {
        $('#vendorAssetImagesPickConfirm').on('click', function () {
            var st = vendorAssetPickModalState;
            if (!st) return;
            var selected = [];
            $('#vendorAssetImagesPickGrid input.vendor-asset-pick-check:checked').each(function () {
                var i = parseInt($(this).val(), 10);
                if (!isNaN(i) && st.imageItems[i]) selected.push(st.imageItems[i]);
            });
            if (!selected.length) {
                alert(tr('customProduct.vendorAssetPickSelectOne', '請至少勾選一張圖片。'));
                return;
            }
            if (selected.length > st.maxSelect) {
                alert(tr('customProduct.vendorAssetPickMaxAlert', '此類參考圖最多還能加 {max} 張。').replace('{max}', String(st.maxSelect)));
                return;
            }
            importVendorAssetImageItems(st.targetKey, selected, st.baseMeta, st.pickerModalEl);
        });
        $('#vendorAssetImagesPickSelectMax').on('click', function () {
            var st = vendorAssetPickModalState;
            if (!st) return;
            var $boxes = $('#vendorAssetImagesPickGrid input.vendor-asset-pick-check');
            $boxes.prop('checked', false);
            var n = Math.min(st.maxSelect, $boxes.length);
            for (var i = 0; i < n; i++) $boxes.eq(i).prop('checked', true);
            updateVendorAssetPickModalCount();
        });
        $(document).on('input', '#refIntentSlots .ref-thumb-note', function () {
            syncRefSlotItemNotesFromDom();
        });
        $(document).on('blur', '#refIntentSlots .ref-slot-addon', function () {
            var slotKey = ($(this).attr('data-ref-slot') || '').trim();
            if (!slotKey || !getRefSlotDef(slotKey)) return;
            syncRefSlotsFromDom();
            renderIntentSlots();
        });
        if (window.i18n && window.i18n.ready) {
            window.i18n.ready.then(initRefIntentUi);
        } else {
            initRefIntentUi();
        }
    });

    function resetVendorAssetFilters() {
        $('#vendorAssetsStyleKey').val('');
        $('#vendorAssetsColor').val('');
        $('#vendorAssetsSearch').val('');
        $('#vendorAssetsManufacturerName').val('');
        $('#vendorAssetsManufacturerId').val('');
        hideVendorManufacturerSuggest();
        $('#vendorAssetsServiceArea').val('');
        $('#vendorAssetsAssetKind').val('');
        $('#vendorAssetsCatalogGroup').val('');
        $('#vendorAssetsMoq').val('');
        $('.vendor-customization-filter').removeClass('active').attr('aria-pressed', 'false');
    }

    function parseCustomizationLevelsClient(raw) {
        if (raw == null || raw === '') return [];
        if (Array.isArray(raw)) return raw.slice();
        var t = String(raw).trim();
        if (!t) return [];
        if (t.charAt(0) === '{' && t.charAt(t.length - 1) === '}') {
            var inner = t.slice(1, -1).trim();
            if (!inner) return [];
            return inner.split(',').map(function (s) { return s.trim().replace(/^"|"$/g, ''); }).filter(Boolean);
        }
        try {
            var parsed = JSON.parse(t);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) { /* ignore */ }
        return t.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    }

    function getVendorCustomizationFilterKeys() {
        var keys = [];
        $('.vendor-customization-filter.active').each(function () {
            var v = ($(this).attr('data-level') || '').trim();
            if (v && keys.indexOf(v) < 0) keys.push(v);
        });
        return keys;
    }

    function applyClientVendorAssetFilters(items) {
        var list = (items || []).slice();
        var moqRaw = ($('#vendorAssetsMoq').val() || '').trim();
        var moqN = moqRaw ? parseInt(moqRaw, 10) : null;
        if (moqRaw && Number.isFinite(moqN) && moqN >= 1) {
            list = list.filter(function (item) {
                if ((item.asset_kind || 'prototype') !== 'prototype') return false;
                var moq = item.min_order_quantity;
                return moq != null && Number(moq) === moqN;
            });
        }
        var customKeys = getVendorCustomizationFilterKeys();
        if (customKeys.length) {
            list = list.filter(function (item) {
                if ((item.asset_kind || 'prototype') !== 'prototype') return false;
                var levels = parseCustomizationLevelsClient(item.customization_levels);
                if (!levels.length) return false;
                return customKeys.some(function (k) { return levels.indexOf(k) >= 0; });
            });
        }
        return list;
    }

    var vendorAssetsMoqReloadTimer = null;
    function scheduleVendorAssetsPickerReload() {
        if (typeof window.__vendorAssetsFetchParams === 'undefined' || !window.__vendorAssetsFetchParams) return;
        if (vendorAssetsMoqReloadTimer) clearTimeout(vendorAssetsMoqReloadTimer);
        vendorAssetsMoqReloadTimer = setTimeout(function () {
            vendorAssetsMoqReloadTimer = null;
            vendorPickerOffset = 0;
            loadVendorAssetsPickerList();
        }, 350);
    }

    $(document).on('click', '.vendor-customization-filter', function () {
        var $btn = $(this);
        $btn.toggleClass('active');
        $btn.attr('aria-pressed', $btn.hasClass('active') ? 'true' : 'false');
        scheduleVendorAssetsPickerReload();
    });

    $('#vendorAssetsMoq').on('input change', function () {
        scheduleVendorAssetsPickerReload();
    });

    $('#vendorAssetsAssetKind').on('change', function () {
        syncVendorPickerSubcategoryForAssetKind();
        updateVendorPickerPrototypeFiltersVisibility();
        updateVendorPickerLinkedLegend();
        scheduleVendorAssetsPickerReload();
    });

    $('#vendorAssetsSearch').on('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadVendorAssetsPickerList();
        }
    });

    function fillVendorCatalogGroupSelect(manufacturerId) {
        var $sel = $('#vendorAssetsCatalogGroup');
        if (!$sel.length) return Promise.resolve();
        var prev = $sel.val();
        $sel.empty();
        $sel.append($('<option value=""></option>').text(vendorPickerTr('customProduct.vendorCatalogAll', '廠商分類 — 全部')));
        if (!manufacturerId) return Promise.resolve();
        return fetch('/api/manufacturers/' + encodeURIComponent(manufacturerId) + '/catalog-groups')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                (data.flat || []).forEach(function (g) {
                    if (!g || !g.id) return;
                    $sel.append($('<option></option>').val(g.id).text(g.label || g.name));
                });
                if (prev) $sel.val(prev);
            })
            .catch(function () {});
    }

    function vendorPickerTr(key, fb) {
        var v = t(key);
        return (v && v !== key) ? v : fb;
    }

    function vendorPickerIsEn() {
        var lang = (window.i18n && typeof window.i18n.getLang === 'function') ? window.i18n.getLang() : '';
        return String(lang || '').toLowerCase().indexOf('zh') !== 0;
    }

    function vendorPickerAreaLabel(zh, en) {
        var isEn = vendorPickerIsEn();
        return isEn ? (en || zh || '') : (zh || en || '');
    }

    function appendVendorAreaTreeOptions($og, nodes, depth) {
        (nodes || []).forEach(function (node) {
            if (!node || !node.code) return;
            if (node.children && node.children.length) {
                appendVendorAreaTreeOptions($og, node.children, depth + 1);
            } else {
                var pad = depth > 0 ? Array(Math.min(depth, 2) + 1).join('\u3000') : '';
                $og.append($('<option></option>').val(node.code).text(pad + vendorPickerAreaLabel(node.zh, node.en) || node.code));
            }
        });
    }

    function fillVendorServiceAreaSelect() {
        var $sel = $('#vendorAssetsServiceArea');
        if (!$sel.length) return Promise.resolve();
        var prev = $sel.val();
        return fetch('/api/service-areas').then(function (r) { return r.json(); }).then(function (data) {
            $sel.empty();
            $sel.append($('<option value=""></option>').text(vendorPickerTr('customProduct.serviceAreaAll', '服務區域 — 全部')));
            (data.taiwan_groups || []).forEach(function (g) {
                var $og = $('<optgroup></optgroup>').attr('label', vendorPickerAreaLabel(g.zh, g.en) || vendorPickerTr('customProduct.serviceAreaTaiwan', '台灣'));
                (g.cities || []).forEach(function (c) {
                    $og.append($('<option></option>').val(c.code).text(vendorPickerAreaLabel(c.zh, c.en) || c.code));
                });
                if ($og.children().length) $sel.append($og);
            });
            (data.countries || []).filter(function (c) { return c && c.code && c.code !== 'TW'; }).forEach(function (country) {
                var $og = $('<optgroup></optgroup>').attr('label', vendorPickerAreaLabel(country.zh, country.en) || country.code);
                if (country.children && country.children.length) {
                    $og.append($('<option></option>').val(country.code).text(
                        vendorPickerAreaLabel(country.zh, country.en) + (vendorPickerIsEn() ? ' (nationwide)' : '（全國）')
                    ));
                    appendVendorAreaTreeOptions($og, country.children, 1);
                } else {
                    $og.append($('<option></option>').val(country.code).text(vendorPickerAreaLabel(country.zh, country.en) || country.code));
                }
                $sel.append($og);
            });
            if (prev) $sel.val(prev);
        }).catch(function () {
            $sel.empty();
            $sel.append($('<option value=""></option>').text(vendorPickerTr('customProduct.serviceAreaAll', '服務區域 — 全部')));
        });
    }

    function setVendorPickerMfrScopedMode(locked) {
        $('.vendor-picker-mfr-name-cell, .vendor-picker-area-cell').toggleClass('d-none', !!locked);
        $('.vendor-picker-catalog-cell').toggleClass('d-none', !locked);
    }

    function categoryLabelForKey(key, fallback) {
        if (!key) return fallback || '';
        var tk = 'category.' + String(key);
        var translated = t(tk);
        return (translated && translated !== tk) ? translated : (fallback || key);
    }

    function getSelectedDesignCategorySummary() {
        syncCategoriesDataFromPicker();
        var mainKey = ($('#imageCategoryMainSelect').val() || '').trim();
        var subKey = ($('#imageCategorySubSelect').val() || '').trim();
        if (!mainKey) return '';
        var cat = categoriesData.find(function (c) { return String(c.key) === mainKey; });
        var mainName = cat ? categoryLabelForKey(mainKey, cat.name || mainKey) : mainKey;
        var parts = [mainName];
        if (subKey && cat && cat.subcategories && cat.subcategories.length) {
            var sub = cat.subcategories.find(function (s) { return String(s.key) === subKey; });
            var subName = sub ? categoryLabelForKey(subKey, sub.name || subKey) : subKey;
            var subTpl = vendorPickerTr('customProduct.vendorPickerSubLabel', '子：{name}');
            parts.push(subTpl.replace('{name}', subName));
        }
        return parts.join(' · ');
    }

    function fillVendorPickerSubSelectOptions(mainKey, preferredSubKey) {
        var $sub = $('#vendorAssetsPickerSubSelect');
        if (!$sub.length) return '';
        $sub.empty();
        var cat = categoriesData.find(function (c) { return String(c.key) === String(mainKey); });
        if (!cat || !cat.subcategories || !cat.subcategories.length) {
            $sub.prop('disabled', true);
            return '';
        }
        (cat.subcategories || []).forEach(function (sub) {
            var subKey = (sub.key != null && sub.key !== '') ? String(sub.key) : '';
            var subName = categoryLabelForKey(subKey, sub.name || sub.key);
            $sub.append($('<option>').attr('value', subKey).text(subName));
        });
        $sub.prop('disabled', false);
        var subKey = (preferredSubKey || '').trim();
        if (!subKey || !$sub.find('option').filter(function () { return this.value === subKey; }).length) {
            subKey = String(cat.subcategories[0].key != null ? cat.subcategories[0].key : '');
        }
        $sub.val(subKey);
        return subKey;
    }

    function populateVendorPickerCategorySelects() {
        var $main = $('#vendorAssetsPickerMainSelect');
        var $sub = $('#vendorAssetsPickerSubSelect');
        if (!$main.length) return;
        var pageMain = ($('#imageCategoryMainSelect').val() || '').trim();
        var pageSub = ($('#imageCategorySubSelect').val() || '').trim();
        $main.empty();
        categoriesData.forEach(function (c) {
            var key = (c.key != null && c.key !== '') ? String(c.key) : '';
            if (!key) return;
            var name = categoryLabelForKey(key, c.name || key);
            $main.append($('<option>').attr('value', key).text(name));
        });
        if (pageMain && $main.find('option').filter(function () { return this.value === pageMain; }).length) {
            $main.val(pageMain);
        } else if (categoriesData.length) {
            pageMain = String(categoriesData[0].key != null ? categoriesData[0].key : '');
            $main.val(pageMain);
        }
        var subKey = fillVendorPickerSubSelectOptions(pageMain, pageSub);
        if ($sub.length && !$sub.prop('disabled')) $sub.val(subKey || $sub.val());
    }

    /** 同步設計頁主／子分類（與素材庫 modal 下拉連動） */
    function applyDesignCategorySelection(mainKey, subKey) {
        mainKey = (mainKey || '').trim();
        subKey = (subKey || '').trim();
        if (!mainKey) return false;
        var mainOpt = $('#imageCategoryMainList .cat-option[data-key="' + mainKey.replace(/"/g, '&quot;') + '"]');
        if (!mainOpt.length) return false;
        mainOpt.trigger('click');
        if (subKey) {
            var subOpt = $('#imageCategorySubList .cat-option[data-key="' + subKey.replace(/"/g, '&quot;') + '"]');
            if (subOpt.length) {
                $('#imageCategorySubList .cat-option').removeClass('selected');
                subOpt.addClass('selected');
                $('#imageCategorySubSelect').val(subKey);
            }
        }
        return true;
    }

    function pickerSubcategoryAppliesToAssetKind(assetKind) {
        var kind = (assetKind != null ? assetKind : ($('#vendorAssetsAssetKind').val() || '')).trim();
        return !kind || kind === 'prototype';
    }

    function effectivePickerSubKey() {
        if (!pickerSubcategoryAppliesToAssetKind()) return '';
        return ($('#vendorAssetsPickerSubSelect').val() || '').trim();
    }

    function syncVendorPickerSubcategoryForAssetKind() {
        var kind = ($('#vendorAssetsAssetKind').val() || '').trim();
        var $sub = $('#vendorAssetsPickerSubSelect');
        var $label = $('#vendorAssetsPickerSubLabel');
        var applies = pickerSubcategoryAppliesToAssetKind(kind);
        var $syncHint = $('#vendorAssetsPickerKindSyncHint');
        if ($syncHint.length) $syncHint.toggleClass('d-none', applies);
        if ($label.length) {
            $label.text(applies
                ? (vendorPickerTr('customProduct.categorySubPrototypeOnly', '子分類（數位原型）'))
                : (vendorPickerTr('customProduct.categorySubN/aForKind', '子分類（此類型不套用）')));
        }
        if (!$sub.length) return;
        if (applies) {
            var mainKey = ($('#vendorAssetsPickerMainSelect').val() || '').trim();
            var keepSub = ($sub.val() || '').trim();
            fillVendorPickerSubSelectOptions(mainKey, keepSub);
        } else {
            $sub.empty().append($('<option value="">').text(vendorPickerTr('customProduct.categorySubDisabledOption', '— 不套用 —')));
            $sub.prop('disabled', true);
        }
        var params = (typeof window.__vendorAssetsFetchParams !== 'undefined') ? window.__vendorAssetsFetchParams : null;
        if (params && params.mode === 'category') {
            params.subKey = effectivePickerSubKey();
        }
    }

    function onVendorPickerCategoryChanged(mainKey, subKey) {
        if (!pickerSubcategoryAppliesToAssetKind()) subKey = '';
        applyDesignCategorySelection(mainKey, subKey);
        var params = (typeof window.__vendorAssetsFetchParams !== 'undefined') ? window.__vendorAssetsFetchParams : null;
        if (params && params.mode === 'category') {
            params.mainKey = mainKey;
            params.subKey = subKey || '';
            vendorPickerOffset = 0;
            loadVendorAssetsPickerList();
        }
    }

    function updateVendorPickerDesignCategoryDisplay() {
        populateVendorPickerCategorySelects();
        syncVendorPickerSubcategoryForAssetKind();
        var params = (typeof window.__vendorAssetsFetchParams !== 'undefined') ? window.__vendorAssetsFetchParams : null;
        var $hint = $('#vendorAssetsPickerCategoryMfrHint');
        if ($hint.length) {
            if (params && params.mode === 'manufacturer') {
                $hint.removeClass('d-none').text(vendorPickerTr('customProduct.vendorPickerCategoryMfrHint',
                    '變更分類會同步至設計頁生圖；下方列表仍為此廠商素材。'));
            } else {
                $hint.addClass('d-none');
            }
        }
    }

    $(document).on('change', '#vendorAssetsPickerMainSelect', function () {
        var mainKey = ($(this).val() || '').trim();
        if (!mainKey) return;
        var subKey = fillVendorPickerSubSelectOptions(mainKey, '');
        onVendorPickerCategoryChanged(mainKey, subKey);
    });

    $(document).on('change', '#vendorAssetsPickerSubSelect', function () {
        var mainKey = ($('#vendorAssetsPickerMainSelect').val() || '').trim();
        var subKey = ($(this).val() || '').trim();
        if (!mainKey) return;
        onVendorPickerCategoryChanged(mainKey, subKey);
    });

    function updateVendorPickerPrototypeFiltersVisibility() {
        var kind = ($('#vendorAssetsAssetKind').val() || '').trim();
        $('.vendor-picker-prototype-only').toggleClass('d-none', kind === 'material' || kind === 'part');
        syncVendorPickerSubcategoryForAssetKind();
    }

    function readVendorPickerPageSize() {
        try {
            var v = parseInt(localStorage.getItem(VENDOR_PICKER_PAGE_SIZE_KEY), 10);
            if (v === 12 || v === 24 || v === 48) return v;
        } catch (_) {}
        return 12;
    }

    function setVendorPickerPageSize(n) {
        vendorPickerPageSize = n;
        try { localStorage.setItem(VENDOR_PICKER_PAGE_SIZE_KEY, String(n)); } catch (_) {}
        $('#vendorAssetsPickerModal .vendor-picker-page-size-btn').removeClass('active');
        $('#vendorAssetsPickerModal .vendor-picker-page-size-btn[data-size="' + n + '"]').addClass('active');
    }

    function updateVendorPickerListPager(total, offset, limit) {
        var $range = $('#vendorAssetsListRange');
        if (typeof window.MatchdoOffsetPager !== 'undefined' && window.MatchdoOffsetPager.render) {
            window.MatchdoOffsetPager.render({
                pagerEl: document.getElementById('vendorAssetsListPager'),
                prevEl: document.getElementById('vendorAssetsListPrev'),
                nextEl: document.getElementById('vendorAssetsListNext'),
                pageNumsEl: document.getElementById('vendorAssetsListPageNums'),
                infoEl: document.getElementById('vendorAssetsListPageInfo'),
                total: total,
                offset: offset,
                limit: limit,
                pageInfoTemplate: t('customProduct.listPageInfo') || '第 {page} / {total} 頁',
                onGoToPage: function (newOffset) {
                    vendorPickerOffset = newOffset;
                    loadVendorAssetsPickerList();
                }
            });
        }
        if ($range.length) {
            if (total) {
                var from = offset + 1;
                var to = Math.min(offset + limit, total);
                $range.text(
                    (t('customProduct.listRange') || '顯示 {from}–{to}，共 {total} 項')
                        .replace('{from}', String(from))
                        .replace('{to}', String(to))
                        .replace('{total}', String(total))
                ).removeClass('d-none');
            } else {
                $range.addClass('d-none');
            }
        }
    }

    function vendorMfrLogoHtml(logoUrl, sizeClass) {
        var cls = sizeClass || 'vendor-asset-mfr-logo';
        var url = (logoUrl || '').trim();
        if (url) {
            return '<img src="' + url.replace(/"/g, '&quot;') + '" alt="" class="' + cls + ' rounded flex-shrink-0" loading="lazy">';
        }
        return '<span class="' + cls + ' ' + cls + '--ph rounded flex-shrink-0 d-inline-flex align-items-center justify-content-center bg-light text-secondary"><i class="bi bi-building"></i></span>';
    }

    function hideVendorManufacturerSuggest() {
        $('#vendorAssetsManufacturerSuggest').addClass('d-none').empty();
    }

    function renderVendorManufacturerSuggest(list) {
        var $box = $('#vendorAssetsManufacturerSuggest');
        if (!$box.length) return;
        if (!list || !list.length) {
            hideVendorManufacturerSuggest();
            return;
        }
        var html = list.map(function (m) {
            var name = (m.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            var id = (m.id || '').toString().replace(/"/g, '&quot;');
            var logo = vendorMfrLogoHtml(m.logo_url, 'vendor-mfr-suggest-logo');
            return '<button type="button" class="list-group-item list-group-item-action vendor-mfr-suggest-item" role="option"' +
                ' data-mfr-id="' + id + '" data-mfr-name="' + name + '">' + logo +
                '<span class="text-truncate">' + name + '</span></button>';
        }).join('');
        $box.html(html).removeClass('d-none');
    }

    function fetchVendorManufacturerSuggest(q) {
        var params = (typeof window.__vendorAssetsFetchParams !== 'undefined') ? window.__vendorAssetsFetchParams : null;
        if (!params || params.mode !== 'category' || !params.mainKey) return;
        var seq = ++vendorMfrSuggestSeq;
        var url = '/api/manufacturers?category_key=' + encodeURIComponent(params.mainKey) +
            '&q=' + encodeURIComponent(q) + '&per_page=15';
        if (params.subKey) url += '&subcategory_key=' + encodeURIComponent(params.subKey);
        fetch(url).then(function (r) { return r.json(); }).then(function (data) {
            if (seq !== vendorMfrSuggestSeq) return;
            var list = (data && data.manufacturers) ? data.manufacturers : [];
            renderVendorManufacturerSuggest(list);
        }).catch(function () {
            if (seq === vendorMfrSuggestSeq) hideVendorManufacturerSuggest();
        });
    }

    function applyVendorManufacturerFilterFromInput() {
        var params = (typeof window.__vendorAssetsFetchParams !== 'undefined') ? window.__vendorAssetsFetchParams : null;
        if (!params || params.mode !== 'category') return;
        vendorPickerOffset = 0;
        loadVendorAssetsPickerList();
    }

    function updateVendorPickerMultiVendorHint() {
        var $hint = $('#vendorAssetsPickerMultiVendorHint');
        if (!$hint.length) return;
        var byId = {};
        getActiveRefSourcesList().forEach(function (s) {
            if (s && s.manufacturer_id) {
                byId[s.manufacturer_id] = (s.manufacturer_name || '').trim() || (t('customProduct.vendorFallback') || '廠商');
            }
        });
        var keys = Object.keys(byId);
        if (keys.length <= 1) {
            $hint.addClass('d-none').empty();
            return;
        }
        var names = keys.map(function (k) { return byId[k]; }).join('、');
        var tpl = t('customProduct.multiVendorPickerHint') ||
            '參考圖已含多家廠商（{names}）。混用可能無法由單一廠商生產，建議先與廠商溝通後再下單。';
        $hint.removeClass('d-none').text(tpl.replace('{names}', names));
    }

    function vendorDesignUrlFromSource(s) {
        if (!s || !s.manufacturer_id) return s && s.manufacturer_profile_url ? s.manufacturer_profile_url : '#';
        var u = '/custom-product.html?manufacturer_id=' + encodeURIComponent(s.manufacturer_id);
        if (s.manufacturer_name) u += '&vendor_name=' + encodeURIComponent(s.manufacturer_name);
        return u;
    }

    function buildPastItemModalRefSourcesHtml(refSourcesList) {
        if (!refSourcesList || !refSourcesList.length) return '';
        var byMfr = {};
        refSourcesList.forEach(function (s) {
            if (!s) return;
            var mid = s.manufacturer_id || ('name:' + (s.manufacturer_name || ''));
            if (!byMfr[mid]) byMfr[mid] = { info: s, assets: [] };
            var dup = byMfr[mid].assets.some(function (a) {
                return (a.vendor_asset_id && s.vendor_asset_id && a.vendor_asset_id === s.vendor_asset_id)
                    || (a.image_url && s.image_url && a.image_url === s.image_url);
            });
            if (!dup) byMfr[mid].assets.push(s);
        });
        var html = '';
        Object.keys(byMfr).forEach(function (mid) {
            var g = byMfr[mid];
            var profileUrl = (g.info.manufacturer_profile_url || '#').replace(/"/g, '&quot;');
            var mfrName = (g.info.manufacturer_name || vendorPickerTr('customProduct.vendorFallback', '廠商')).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            var designUrl = vendorDesignUrlFromSource(g.info).replace(/"/g, '&quot;');
            html += '<div class="past-ref-mfr-group text-start mb-2 pb-2 border-bottom border-white border-opacity-25">';
            html += '<div class="d-flex flex-wrap align-items-center gap-2 mb-1">';
            html += '<a href="' + profileUrl + '" target="_blank" rel="noopener" class="badge bg-primary text-decoration-none">' + mfrName + '</a>';
            html += '<a href="' + designUrl + '" target="_blank" rel="noopener" class="small text-white text-decoration-underline">' +
                vendorPickerTr('customProduct.vendorDesignLink', '用此廠商版型設計') + '</a>';
            html += '</div><div class="d-flex flex-wrap gap-2">';
            g.assets.forEach(function (s) {
                var imgUrl = (s.image_url || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                if (!imgUrl) return;
                var title = (s.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                var kind = s.asset_kind === 'material'
                    ? vendorPickerTr('customProduct.assetKindMaterial', '材料')
                    : (s.asset_kind === 'part'
                        ? vendorPickerTr('customProduct.assetKindPart', '配件／零件')
                        : vendorPickerTr('customProduct.assetKindPrototype', '數位原型'));
                var tip = (title ? title + ' · ' : '') + mfrName + ' · ' + kind;
                html += '<a href="' + profileUrl + '" target="_blank" rel="noopener" class="text-decoration-none text-center past-ref-asset-link" title="' + tip.replace(/"/g, '&quot;') + '">';
                html += '<img src="' + imgUrl + '" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,.35);">';
                if (title) html += '<span class="d-block small text-white mt-0 text-truncate" style="max-width:72px;">' + title + '</span>';
                else html += '<span class="d-block small text-white-50 mt-0" style="font-size:.65rem;">' + kind + '</span>';
                html += '</a>';
            });
            html += '</div></div>';
        });
        return html;
    }

    function applyPastItemModalRefSources(refSourcesList) {
        var $sec = $('#pastItemModalRefSources');
        var $inner = $('#pastItemModalRefSourcesInner');
        if (!$sec.length || !$inner.length) return;
        var html = buildPastItemModalRefSourcesHtml(refSourcesList);
        if (html) {
            $inner.html(html);
            $sec.removeClass('d-none');
        } else {
            $inner.empty();
            $sec.addClass('d-none');
        }
    }

    function openImageLightbox(src, caption, imageItems, index) {
        if (!src && (!imageItems || !imageItems.length)) return false;
        if (window.MatchdoImageLightbox && typeof window.MatchdoImageLightbox.open === 'function') {
            var opts = { caption: caption || '', alt: caption || '' };
            if (imageItems && imageItems.length) {
                opts.imageItems = imageItems;
                opts.index = index || 0;
            } else {
                opts.src = src;
            }
            window.MatchdoImageLightbox.open(opts);
            return true;
        }
        return false;
    }

    function openVendorAssetCardLightbox($c) {
        if (!$c || !$c.length) return false;
        var items = vendorAssetCardImageItems($c);
        if (!items.length) return false;
        var idx = 0;
        var cover = vendorAssetCardImageUrl($c);
        for (var i = 0; i < items.length; i++) {
            if (items[i].url === cover) { idx = i; break; }
        }
        var title = vendorAssetCardCaption($c);
        return openImageLightbox(items[idx].url, title, items, idx);
    }

    function vendorAssetCardImageUrl($c) {
        if (!$c || !$c.length) return '';
        var u = ($c.attr('data-image-url') || '').trim();
        if (u) return u;
        var img = $c.find('.vendor-asset-pick-img')[0];
        return (img && img.src) ? img.src : '';
    }

    function vendorAssetCardImageUrls($c) {
        return vendorAssetCardImageItems($c).map(function (it) { return it.url; }).filter(Boolean);
    }

    function vendorAssetCardImageItems($c) {
        if (!$c || !$c.length) return [];
        var rawItems = $c.attr('data-image-items');
        if (rawItems) {
            try {
                var items = JSON.parse(rawItems.replace(/&quot;/g, '"'));
                if (Array.isArray(items) && items.length) {
                    return items.filter(function (it) { return it && it.url; });
                }
            } catch (e) { /* ignore */ }
        }
        var urls = [];
        var raw = $c.attr('data-image-urls');
        if (raw) {
            try {
                var parsed = JSON.parse(raw.replace(/&quot;/g, '"'));
                if (Array.isArray(parsed) && parsed.length) urls = parsed.filter(Boolean);
            } catch (e) { /* ignore */ }
        }
        if (!urls.length) {
        var u = vendorAssetCardImageUrl($c);
            if (u) urls = [u];
        }
        return urls.map(function (u, idx) {
            return { url: u, label: '', sort_order: idx, is_cover: idx === 0 };
        });
    }

    function fetchUrlAsDataUrl(url) {
        return fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        });
    }

    function vendorAssetCardCaption($c) {
        if (!$c || !$c.length) return '';
        return ($c.attr('data-title') || $c.find('.vendor-asset-title').text() || '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    }

    function refIntentThumbCaption(item, index) {
        if (!item) return tr('customProduct.refThumbDefault', '圖') + ' ' + ((index || 0) + 1);
        var src = item.source || {};
        var label = (src.image_label || '').trim();
        if (label) return label;
        var title = (src.title || '').trim();
        if (title) return title;
        return tr('customProduct.refThumbDefault', '圖') + ' ' + ((index || 0) + 1);
    }

    function vendorImportCapacity(targetKey) {
        var roomSlot = MAX_REF_IMAGES_PER_SLOT - countSlotRefImages(targetKey);
        var roomTotal = MAX_REF_IMAGES_TOTAL - countTotalRefImages();
        return { roomSlot: roomSlot, roomTotal: roomTotal, maxAdd: Math.max(0, Math.min(roomSlot, roomTotal)) };
    }

    function buildVendorAssetBaseMeta($c, assetKind) {
        var clRaw = $c.attr('data-customization-levels');
        var clLevels = [];
        if (clRaw) {
            try { clLevels = JSON.parse(clRaw.replace(/&quot;/g, '"')); } catch (e) { /* ignore */ }
        }
        if (!Array.isArray(clLevels)) clLevels = [];
        var moqRaw = ($c.attr('data-min-order-quantity') || '').trim();
        var moqNum = moqRaw ? parseInt(moqRaw, 10) : null;
        var catalogNames = [];
        var cgnRaw = ($c.attr('data-catalog-group-names') || '').trim();
        if (cgnRaw) {
            try { catalogNames = JSON.parse(cgnRaw.replace(/&quot;/g, '"')); } catch (_) { catalogNames = []; }
        }
        if (!Array.isArray(catalogNames)) catalogNames = [];
        return {
            vendor_asset_id: $c.attr('data-vendor-asset-id') || null,
            manufacturer_id: $c.attr('data-manufacturer-id') || null,
            manufacturer_name: $c.attr('data-manufacturer-name') || '',
            manufacturer_profile_url: $c.attr('data-manufacturer-profile-url') || '',
            asset_kind: assetKind,
            title: vendorAssetCardCaption($c),
            catalog_group_names: catalogNames,
            customization_levels: clLevels,
            min_order_quantity: (moqNum != null && moqNum >= 1) ? moqNum : null
        };
    }

    function confirmMultiVendorImport($c, onConfirm) {
        var newMfrId = ($c.attr('data-manufacturer-id') || '').trim();
        var existingIds = {};
        getActiveRefSourcesList().forEach(function (s) {
            if (s && s.manufacturer_id) existingIds[s.manufacturer_id] = true;
        });
        var existingKeys = Object.keys(existingIds);
        if (newMfrId && existingKeys.length && existingKeys.indexOf(newMfrId) === -1) {
            var mfrLabel = ($c.attr('data-manufacturer-name') || '').trim() || (t('customProduct.vendorFallback') || '廠商');
            var cmsg = (t('customProduct.multiVendorConfirm') || '參考圖已含其他廠商素材，再加入「{name}」可能無法由單一廠商生產。仍要加入？').replace('{name}', mfrLabel);
            if (!window.confirm(cmsg)) return;
        }
        if (typeof onConfirm === 'function') onConfirm();
    }

    function importVendorAssetImageItems(targetKey, imageItems, baseMeta, pickerModalEl) {
        if (!imageItems.length) return;
        Promise.all(imageItems.map(function (it) { return fetchUrlAsDataUrl(it.url); }))
            .then(function (dataUrls) {
                var def = getRefSlotDef(targetKey);
                var added = 0;
                dataUrls.forEach(function (dataUrl, idx) {
                    var it = imageItems[idx];
                    if (addRefImageToSlot(targetKey, dataUrl, Object.assign({}, baseMeta, {
                        asset_kind: def ? def.assetKind : baseMeta.asset_kind,
                        image_url: it.url,
                        image_label: (it.label || '').trim()
                    }))) added++;
                });
                if (!added) {
                    alert(tr('customProduct.refSlotsFull', '參考圖已滿（每類最多 ' + MAX_REF_IMAGES_PER_SLOT + ' 張，共 ' + MAX_REF_IMAGES_TOTAL + ' 張）'));
                    return;
                }
                refIntentActiveTab = targetKey;
                if (targetKey === 'prototype') {
                    prototypeLinkSummary.loaded = false;
                    refreshPrototypeLinkSummary(function () { renderIntentSlots(); });
                } else {
                    renderIntentSlots();
                }
                var pickEl = document.getElementById('vendorAssetImagesPickModal');
                if (pickEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    var pickInst = bootstrap.Modal.getInstance(pickEl);
                    if (pickInst) pickInst.hide();
                }
                if (pickerModalEl && bootstrap.Modal.getInstance(pickerModalEl)) {
                    bootstrap.Modal.getInstance(pickerModalEl).hide();
                }
            })
            .catch(function () { alert(t('customProduct.loadFailed') || '載入圖片失敗'); });
    }

    var vendorAssetPickModalState = null;

    function updateVendorAssetPickModalCount() {
        var st = vendorAssetPickModalState;
        if (!st) return;
        var $grid = $('#vendorAssetImagesPickGrid');
        var n = $grid.find('input.vendor-asset-pick-check:checked').length;
        var tpl = tr('customProduct.vendorAssetPickCount', '已選 {n} / 最多 {max} 張');
        $('#vendorAssetImagesPickCount').text(tpl.replace('{n}', String(n)).replace('{max}', String(st.maxSelect)));
        var over = n > st.maxSelect;
        $('#vendorAssetImagesPickConfirm').prop('disabled', n < 1 || over);
    }

    function openVendorAssetImagePickModal(opts) {
        opts = opts || {};
        var imageItems = opts.imageItems || [];
        var maxSelect = opts.maxSelect || 1;
        var targetKey = opts.targetKey;
        var baseMeta = opts.baseMeta;
        var pickerModalEl = opts.pickerModalEl;
        var assetTitle = opts.assetTitle || '';
        if (!imageItems.length || maxSelect < 1) return;

        vendorAssetPickModalState = {
            imageItems: imageItems,
            maxSelect: maxSelect,
            targetKey: targetKey,
            baseMeta: baseMeta,
            pickerModalEl: pickerModalEl
        };

        var subTpl = tr('customProduct.vendorAssetPickImagesSubtitle', '「{title}」共 {total} 張，最多可選 {max} 張加入「{slot}」。');
        var slotDef = getRefSlotDef(targetKey);
        $('#vendorAssetImagesPickSubtitle').text(subTpl
            .replace('{title}', assetTitle || '—')
            .replace('{total}', String(imageItems.length))
            .replace('{max}', String(maxSelect))
            .replace('{slot}', slotDef ? refIntentTabLabel(slotDef) : ''));

        var $scopeBlock = $('#vendorAssetImagesPickScope');
        $scopeBlock.empty().addClass('d-none');
        if (targetKey === 'prototype' && baseMeta && appendPrototypeScopeInline($scopeBlock, baseMeta)) {
            $scopeBlock.removeClass('d-none');
        }

        var $grid = $('#vendorAssetImagesPickGrid').empty();
        imageItems.forEach(function (it, idx) {
            var label = (it.label || '').trim() || (tr('customProduct.refThumbDefault', '圖') + ' ' + (idx + 1));
            var safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var $col = $('<div class="col-6 col-sm-4 col-md-3"></div>');
            var $label = $('<label class="vendor-asset-pick-item position-relative"></label>');
            var $cb = $('<input type="checkbox" class="vendor-asset-pick-check">').attr('value', String(idx));
            var $wrap = $('<div class="vendor-asset-pick-item-img-wrap"></div>');
            $wrap.append($('<img alt="">').attr('src', it.url).attr('loading', 'lazy'));
            $wrap.append($('<span class="vendor-asset-pick-item-check" aria-hidden="true"></span>'));
            $wrap.append($('<button type="button" class="vendor-asset-pick-preview-btn" title="' +
                (tr('customProduct.zoomImage', '放大預覽').replace(/"/g, '&quot;')) + '"><i class="bi bi-zoom-in"></i></button>')
                .on('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    openImageLightbox(it.url, assetTitle + ' · ' + label, imageItems, idx);
                }));
            $label.append($cb).append($wrap).append($('<div class="vendor-asset-pick-item-label"></div>').html(safeLabel));
            $cb.on('change', function () {
                var checked = $grid.find('input.vendor-asset-pick-check:checked');
                if (checked.length > maxSelect) {
                    $(this).prop('checked', false);
                    alert(tr('customProduct.vendorAssetPickMaxAlert', '此類參考圖最多還能加 {max} 張。').replace('{max}', String(maxSelect)));
                }
                updateVendorAssetPickModalCount();
            });
            $col.append($label);
            $grid.append($col);
        });

        updateVendorAssetPickModalCount();
        if (window.i18n && typeof window.i18n.applyPage === 'function') window.i18n.applyPage();

        var el = document.getElementById('vendorAssetImagesPickModal');
        if (!el || typeof bootstrap === 'undefined' || !bootstrap.Modal) return;
        var inst = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
        inst.show();
    }

    function startVendorAssetImport($c, pickerModalEl) {
        var imageItems = vendorAssetCardImageItems($c);
        if (!imageItems.length) return;
        var assetKind = ($c.attr('data-asset-kind') || 'prototype').trim();
        var targetKey = null;
        try { targetKey = window.__refImportTargetSlot; } catch (e) { targetKey = null; }
        try { window.__refImportTargetSlot = null; } catch (e2) {}
        if (!targetKey || !getRefSlotDef(targetKey)) targetKey = intentKeyFromAssetKind(assetKind);

        if (targetKey === 'prototype') {
            var pickAssetId = ($c.attr('data-vendor-asset-id') || '').trim();
            var lock = getPrototypeLockVendorAssetId();
            if (lock && pickAssetId && pickAssetId !== lock) {
                alert(tr('customProduct.prototypeLockDifferentAssetPicker',
                    '原型已鎖定，無法選擇其他數位原型。請先清空設計頁「原型」類別，或點選已鎖定的同一素材以加入其他角度。'));
                return;
            }
            if (!lock && countSlotRefImages('prototype') > 0) {
                alert(tr('customProduct.prototypeNeedVendorFirst',
                    '原型已使用本機上傳的圖片。若要使用廠商數位原型，請先清空「原型」類別，再從素材庫選擇。'));
                return;
            }
            if (assetKind !== 'prototype') {
                alert(tr('customProduct.prototypeVendorKindOnly',
                    '「原型」類別僅能加入數位原型素材。'));
                return;
            }
            imageItems = filterPrototypeVendorImageItems(imageItems);
            if (!imageItems.length) {
                alert(tr('customProduct.prototypeAnglesAlreadyAdded', '此原型的角度圖已全部加入。'));
                return;
            }
        }

        var cap = vendorImportCapacity(targetKey);
        if (cap.maxAdd <= 0) {
            alert(tr('customProduct.refSlotsFull', '參考圖已滿（每類最多 ' + MAX_REF_IMAGES_PER_SLOT + ' 張，共 ' + MAX_REF_IMAGES_TOTAL + ' 張）'));
            return;
        }

        var baseMeta = buildVendorAssetBaseMeta($c, assetKind);
        var assetTitle = vendorAssetCardCaption($c);

        if (imageItems.length === 1) {
            confirmMultiVendorImport($c, function () {
                importVendorAssetImageItems(targetKey, imageItems, baseMeta, pickerModalEl);
            });
            return;
        }

        confirmMultiVendorImport($c, function () {
            openVendorAssetImagePickModal({
                imageItems: imageItems,
                maxSelect: cap.maxAdd,
                targetKey: targetKey,
                baseMeta: baseMeta,
                pickerModalEl: pickerModalEl,
                assetTitle: assetTitle
            });
        });
    }

    function openRefImagePreviewModal(slotKey, itemIndex) {
        var g = refSlots[slotKey];
        if (!g || !g.items || !g.items.length) return;
        var idx = (itemIndex != null && !isNaN(itemIndex)) ? itemIndex : 0;
        if (idx < 0 || idx >= g.items.length) idx = 0;
        var item = g.items[idx];
        if (!item || !item.url) return;
        var def = getRefSlotDef(slotKey);
        var label = def ? t(def.titleKey) : (vendorPickerTr('customProduct.refPreviewTitle', '參考圖'));
        var src = item.source;
        if (src && src.image_label) label += ' · ' + src.image_label;
        else if (src && src.title) label += ' · ' + src.title;
        var refItems = g.items.map(function (it, i) {
            return { url: it.url, label: refIntentThumbCaption(it, i) };
        });
        if (openImageLightbox(item.url, label, refItems, idx)) return;
        $('#pastItemModal').data('redesignCategoryKey', ($('#imageCategoryMainSelect').val() || '').trim())
            .data('redesignSubcategoryKey', ($('#imageCategorySubSelect').val() || '').trim());
        if (window.i18n && typeof window.i18n.applyPage === 'function') window.i18n.applyPage();
        $('#pastItemModalLabel').text(label);
        var inner = document.getElementById('pastItemModalBodyInner');
        if (inner) inner.innerHTML = '<img src="' + String(item.url).replace(/"/g, '&quot;') + '" alt="">';
        $('#pastItemModalPrompt').text((g.addon || '').trim() || '（無）');
        $('#pastItemModalSeed').text('—');
        $('#pastItemModalOwner').text('—');
        applyPastItemModalRefSources(src ? [src] : []);
        $('#pastItemModalShowSection').addClass('d-none');
        var linkEl = document.getElementById('pastItemModalLink');
        if (linkEl) linkEl.classList.add('d-none');
        var modalEl = document.getElementById('pastItemModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            (new bootstrap.Modal(modalEl)).show();
        }
    }

    function buildVendorAssetCardHtml(item) {
        var imgUrl = (item.image_url || '').replace(/"/g, '&quot;');
        var title = (item.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        var mfrName = vendorItemManufacturerName(item).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        var mfrLogo = vendorMfrLogoHtml(item.manufacturer_logo_url, 'vendor-asset-mfr-logo');
        var profileUrl = (item.manufacturer_profile_url || '#').replace(/"/g, '&quot;');
        var assetId = (item.id || '').toString().replace(/"/g, '&quot;');
        var mfrId = (item.manufacturer_id || '').toString().replace(/"/g, '&quot;');
        var assetKind = (item.asset_kind || 'prototype').replace(/"/g, '&quot;');
        var meta = '';
        if (item.style_label) {
            meta += '<span class="badge bg-light text-secondary border mb-1">' + item.style_label + '</span> ';
        }
        if (item.catalog_groups && item.catalog_groups.length) {
            item.catalog_groups.forEach(function (g) {
                if (!g || !g.name) return;
                var gn = String(g.name).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                meta += '<span class="badge bg-light text-secondary border mb-1">' + gn + '</span> ';
            });
        }
        if (item.color_label) {
            meta += '<span class="badge bg-light text-secondary border mb-1">' + item.color_label + '</span> ';
        }
        if (item.asset_kind === 'material') {
            meta += '<span class="badge bg-success-subtle text-success border mb-1">' + (t('customProduct.assetKindMaterial') || '材料') + '</span> ';
        } else if (item.asset_kind === 'part') {
            meta += '<span class="badge bg-warning-subtle text-warning border mb-1">' + (t('customProduct.assetKindPart') || '配件／零件') + '</span> ';
        } else if (item.asset_kind === 'prototype') {
            meta += '<span class="badge bg-primary-subtle text-primary border mb-1">' + (t('customProduct.assetKindPrototype') || '數位原型') + '</span> ';
            if (item.min_order_quantity != null && Number(item.min_order_quantity) >= 1) {
                var moqBadge = (t('customProduct.moqBadge') || 'MOQ {n}').replace(/\{n\}/g, String(item.min_order_quantity));
                meta += '<span class="badge bg-light text-dark border mb-1">' + moqBadge.replace(/</g, '&lt;') + '</span> ';
            }
            meta += buildPrototypeCustomizationBadgesHtml(item);
        }
        var pickHint = (t('customProduct.vendorAssetPickHint') || '單擊加入參考圖；雙擊或按 🔍 放大').replace(/"/g, '&quot;');
        var zoomTitle = (t('customProduct.zoomImage') || '放大預覽').replace(/"/g, '&quot;');
        var imageUrls = (item.image_urls && item.image_urls.length) ? item.image_urls : (item.image_url ? [item.image_url] : []);
        var imageItems = (item.image_items && item.image_items.length) ? item.image_items : imageUrls.map(function (u, ii) {
            return { url: u, label: '', sort_order: ii, is_cover: ii === 0 };
        });
        var imageUrlsJson = JSON.stringify(imageUrls).replace(/"/g, '&quot;');
        var imageItemsJson = JSON.stringify(imageItems).replace(/"/g, '&quot;');
        var clLevelsJson = (item.customization_levels && item.customization_levels.length)
            ? JSON.stringify(item.customization_levels).replace(/"/g, '&quot;') : '';
        var moqAttr = (item.min_order_quantity != null && Number(item.min_order_quantity) >= 1)
            ? String(item.min_order_quantity) : '';
        var catalogNamesAttr = '';
        if (item.catalog_groups && item.catalog_groups.length) {
            var cgn = item.catalog_groups.map(function (g) { return g && g.name ? String(g.name).trim() : ''; }).filter(Boolean);
            if (cgn.length) catalogNamesAttr = JSON.stringify(cgn).replace(/"/g, '&quot;');
        }
        var coverImgLabel = (imageItems[0] && imageItems[0].label) ? String(imageItems[0].label).trim() : '';
        var coverLabelHtml = coverImgLabel
            ? '<div class="small text-muted text-truncate vendor-asset-image-label" title="' + coverImgLabel.replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' +
            coverImgLabel.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' : '';
        if (item.is_linked_to_prototype) {
            var linkedBadge = (t('customProduct.vendorAssetLinkedBadge') || '廠商推薦').replace(/</g, '&lt;');
            meta += '<span class="badge vendor-asset-linked-badge mb-1">' + linkedBadge + '</span> ';
        }
        if (item.production_type_label) {
            meta += '<span class="badge bg-info-subtle text-info border mb-1">' + String(item.production_type_label).replace(/</g, '&lt;') + '</span> ';
        }
        if (item.capabilities && item.capabilities.length) {
            item.capabilities.forEach(function (cap) {
                var lbl = (cap && (cap.label || cap.name_zh)) ? (cap.label || cap.name_zh) : '';
                if (lbl) meta += '<span class="badge bg-light text-primary border mb-1">' + String(lbl).replace(/</g, '&lt;') + '</span> ';
            });
        } else if (item.capability_labels && item.capability_labels.length) {
            item.capability_labels.forEach(function (lbl) {
                if (lbl) meta += '<span class="badge bg-light text-primary border mb-1">' + String(lbl).replace(/</g, '&lt;') + '</span> ';
            });
        }
        var multiBadge = imageUrls.length > 1
            ? '<span class="badge bg-dark position-absolute top-0 start-0 m-1" style="z-index:2;font-size:.65rem">' + imageUrls.length + ' ' + (t('customProduct.imageCountUnit') || '張') + '</span>' : '';
        var linkedCardClass = item.is_linked_to_prototype ? ' vendor-asset-card--vendor-linked' : '';
        return '<div class="col-6 col-md-4 col-lg-3"><div class="card h-100 vendor-asset-card' + linkedCardClass + '"' +
            ' data-image-url="' + imgUrl + '" data-image-urls="' + imageUrlsJson + '" data-image-items="' + imageItemsJson + '" data-vendor-asset-id="' + assetId + '" data-manufacturer-id="' + mfrId + '"' +
            ' data-manufacturer-name="' + mfrName + '" data-manufacturer-profile-url="' + profileUrl + '"' +
            ' data-asset-kind="' + assetKind + '" data-title="' + title + '"' +
            (catalogNamesAttr ? ' data-catalog-group-names="' + catalogNamesAttr + '"' : '') +
            (clLevelsJson ? ' data-customization-levels="' + clLevelsJson + '"' : '') +
            (moqAttr ? ' data-min-order-quantity="' + moqAttr + '"' : '') + '>' +
            '<div class="vendor-asset-pick-zone position-relative" role="button" tabindex="0" title="' + pickHint + '">' +
            multiBadge +
            '<button type="button" class="vendor-asset-zoom-btn" title="' + zoomTitle + '" aria-label="' + zoomTitle + '"><i class="bi bi-zoom-in"></i></button>' +
            '<img class="card-img-top vendor-asset-pick-img" src="' + imgUrl + '" alt="" loading="lazy" style="height:120px;object-fit:cover;" title="' + zoomTitle + '">' +
            '</div>' +
            '<div class="card-body p-2 vendor-asset-card-meta">' + meta +
            '<div class="fw-semibold small text-truncate vendor-asset-title" title="' + title + '">' + title + '</div>' +
            coverLabelHtml +
            '<div class="d-flex align-items-center gap-1 mt-1 vendor-asset-mfr-row">' +
            mfrLogo +
            '<a href="' + profileUrl + '" class="small text-primary text-decoration-none vendor-asset-mfr-link text-truncate flex-grow-1" target="_blank" rel="noopener" title="' + mfrName + '">' + mfrName + '</a>' +
            '<button type="button" class="btn btn-link btn-sm p-0 vendor-asset-mfr-search-btn flex-shrink-0" data-mfr-name="' + mfrName + '" title="' +
            (t('customProduct.vendorFillSearch') || '填入廠商名稱篩選').replace(/"/g, '&quot;') + '"><i class="bi bi-search"></i></button>' +
            '</div></div></div></div>';
    }

    function bindVendorAssetCardClicks($list, modalEl) {
        $list.find('.vendor-asset-zoom-btn').off('click').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            var $c = $(this).closest('.vendor-asset-card');
            openVendorAssetCardLightbox($c);
        });
        $list.find('.vendor-asset-pick-img').off('dblclick').on('dblclick', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            var $c = $(this).closest('.vendor-asset-card');
            openVendorAssetCardLightbox($c);
        });
        $list.find('.vendor-asset-card-meta, .vendor-asset-mfr-link, .vendor-asset-mfr-search-btn, .vendor-asset-title').off('mousedown click pointerdown')
            .on('mousedown click pointerdown', function (e) { e.stopPropagation(); });
        $list.find('.vendor-asset-mfr-search-btn').off('click').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var name = ($(this).attr('data-mfr-name') || '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
            if (!name) return;
            var $cell = $('.vendor-picker-mfr-name-cell');
            var $input = $('#vendorAssetsManufacturerName');
            if ($cell.hasClass('d-none') || !$input.length) {
                alert(t('customProduct.vendorSearchLocked') || '此模式已鎖定單一廠商，無法使用廠商名稱篩選。');
                return;
            }
            var mfrId = ($c.attr('data-manufacturer-id') || '').trim();
            $input.val(name);
            $('#vendorAssetsManufacturerId').val(mfrId);
            hideVendorManufacturerSuggest();
            var $more = $('.vendor-picker-more-filters');
            if ($more.length && !$more[0].open) $more[0].open = true;
            vendorPickerOffset = 0;
            loadVendorAssetsPickerList();
        });
        $list.find('.vendor-asset-pick-zone, .vendor-asset-pick-img').off('click keydown').on('click keydown', function (e) {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            if (e.type === 'keydown') e.preventDefault();
            if (e.type === 'click' && (e.detail > 1 || e.defaultPrevented)) return;
            if ($(e.target).closest('.vendor-asset-zoom-btn').length) return;
            var sel = window.getSelection && window.getSelection();
            if (sel && sel.toString && sel.toString().trim()) return;
            var $c = $(this).closest('.vendor-asset-card');
            if ($c.hasClass('vendor-asset-card--prototype-locked-out')) {
                alert(tr('customProduct.prototypeLockDifferentAssetPicker',
                    '原型已鎖定，無法選擇其他數位原型。請先清空設計頁「原型」類別，或點選已鎖定的同一素材以加入其他角度。'));
                return;
            }
            startVendorAssetImport($c, modalEl);
        });
    }

    function buildVendorAssetsFetchUrl(params) {
        var assetKind = ($('#vendorAssetsAssetKind').val() || '').trim();
        var subForApi = pickerSubcategoryAppliesToAssetKind(assetKind) ? (params.subKey || effectivePickerSubKey()) : '';
        var url = '';
        if (params.mode === 'category' && params.mainKey) {
            url = '/api/vendor-assets?category_key=' + encodeURIComponent(params.mainKey);
            if (subForApi) {
                url += '&subcategory_key=' + encodeURIComponent(subForApi);
            }
        } else if (params.mode === 'manufacturer' && params.manufacturerId) {
            url = '/api/vendor-assets?manufacturer_id=' + encodeURIComponent(params.manufacturerId);
        }
        var styleKey = ($('#vendorAssetsStyleKey').val() || '').trim();
        if (styleKey) url += '&style_key=' + encodeURIComponent(styleKey);
        var colorQ = ($('#vendorAssetsColor').val() || '').trim();
        if (colorQ) url += '&color=' + encodeURIComponent(colorQ);
        var keyword = ($('#vendorAssetsSearch').val() || '').trim();
        if (keyword) url += '&q=' + encodeURIComponent(keyword);
        if (params.mode === 'category') {
            var mfrIdFilter = ($('#vendorAssetsManufacturerId').val() || '').trim();
            if (mfrIdFilter) {
                url += '&manufacturer_id=' + encodeURIComponent(mfrIdFilter);
            } else {
                var mfrName = ($('#vendorAssetsManufacturerName').val() || '').trim();
                if (mfrName) url += '&manufacturer_name=' + encodeURIComponent(mfrName);
            }
            var areaCode = ($('#vendorAssetsServiceArea').val() || '').trim();
            if (areaCode) url += '&service_area=' + encodeURIComponent(areaCode);
        }
        if (assetKind) url += '&asset_kind=' + encodeURIComponent(assetKind);
        if (params.mode === 'manufacturer') {
            var catalogGroupId = ($('#vendorAssetsCatalogGroup').val() || '').trim();
            if (catalogGroupId) url += '&catalog_group_id=' + encodeURIComponent(catalogGroupId);
        }
        var moqExact = ($('#vendorAssetsMoq').val() || '').trim();
        if (moqExact && parseInt(moqExact, 10) >= 1) {
            url += '&min_order_quantity=' + encodeURIComponent(moqExact);
        }
        var customKeys = getVendorCustomizationFilterKeys();
        if (customKeys.length) {
            url += '&customization_levels=' + encodeURIComponent(customKeys.join(','));
        }
        var pickerKind = ($('#vendorAssetsAssetKind').val() || '').trim();
        var protoLockId = getPrototypeLockVendorAssetId();
        if (protoLockId && (pickerKind === 'material' || pickerKind === 'part')) {
            url += '&for_prototype_asset_id=' + encodeURIComponent(protoLockId);
        }
        if (params.hasPrototypeLinks) {
            url += '&has_prototype_links=1';
        }
        url += '&limit=' + encodeURIComponent(String(vendorPickerPageSize));
        url += '&offset=' + encodeURIComponent(String(vendorPickerOffset));
        return url;
    }

    function loadVendorAssetsPickerList() {
        var params = (typeof window.__vendorAssetsFetchParams !== 'undefined') ? window.__vendorAssetsFetchParams : null;
        if (!params) return;
        var url = buildVendorAssetsFetchUrl(params);
        if (!url) return;
        var $list = $('#vendorAssetsList');
        var $empty = $('#vendorAssetsEmpty');
        var $loading = $('#vendorAssetsLoading');
        var modalEl = document.getElementById('vendorAssetsPickerModal');
        $list.empty().addClass('d-none');
        $empty.addClass('d-none');
        $loading.removeClass('d-none').text(t('home.loading') || '載入中…');
        var fetchOpts = {};
        var fetchPromise = (typeof window.AuthService !== 'undefined' && typeof window.AuthService.getSession === 'function')
            ? window.AuthService.getSession().then(function (session) {
                if (session && session.access_token) {
                    fetchOpts.headers = { Authorization: 'Bearer ' + session.access_token };
                }
                return fetch(url, fetchOpts);
            })
            : fetch(url, fetchOpts);
        fetchPromise.then(function (r) {
            return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data || {} }; });
        }).then(function (res) {
            $loading.addClass('d-none');
            var data = res.data;
            if (!res.ok) {
                var errMsg = data.error || data.message || ('HTTP ' + res.status);
                if (data.message && String(data.message).indexOf('vendor-assets') >= 0) {
                    errMsg += ' — ' + data.message;
                }
                $empty.removeClass('d-none').text(errMsg);
                return;
            }
            var items = (data && data.items) ? data.items : [];
            return enrichVendorAssetItemsManufacturerNames(items).then(function (enriched) {
            items = applyClientVendorAssetFilters(enriched);
            var total = (data && data.total != null) ? Number(data.total) : items.length;
            if (!Number.isFinite(total) || total < items.length) total = items.length;
            vendorPickerLastTotal = total;
            if (items.length && vendorPickerOffset >= total) {
                vendorPickerOffset = Math.max(0, total - vendorPickerPageSize);
                if (vendorPickerOffset > 0) {
                    loadVendorAssetsPickerList();
                    return;
                }
            }
            updateVendorPickerListPager(total, vendorPickerOffset, vendorPickerPageSize);
            updateVendorPickerMultiVendorHint();
            if (!items.length) {
                $empty.removeClass('d-none').text(t('customProduct.vendorAssetsEmptyFiltered') || '此條件下尚無符合的素材，請調整篩選或清除後重試。');
                return;
            }
            $list.removeClass('d-none');
            items.forEach(function (item) { $list.append(buildVendorAssetCardHtml(item)); });
            bindVendorAssetCardClicks($list, modalEl);
            applyPrototypeLockToVendorPickerCards($list);
            updateVendorPickerPrototypeLockHint();
            updateVendorPickerLinkedLegend();
            updateVendorPickerUnsupportedScopeHint();
            });
        }).catch(function () {
            $loading.addClass('d-none');
            $empty.removeClass('d-none').text(t('customProduct.loadFailed') || '載入失敗');
        });
    }

    var vendorMfrNameByIdCache = window.__vendorMfrNameByIdCache || (window.__vendorMfrNameByIdCache = {});

    function isGenericVendorDisplayName(name) {
        var raw = (name != null ? String(name) : '').trim();
        var low = raw.toLowerCase();
        return !raw || raw === '廠商' || low === 'vendor' || low === 'manufacturer' || low === '厂商';
    }

    /** 與 buildVendorAssetCardHtml 相同：廠商顯示名稱（略過 API 占位「廠商」） */
    function vendorItemManufacturerName(item) {
        var mfrId = (item && item.manufacturer_id) ? String(item.manufacturer_id).trim() : '';
        if (mfrId && vendorMfrNameByIdCache[mfrId] && !isGenericVendorDisplayName(vendorMfrNameByIdCache[mfrId])) {
            return vendorMfrNameByIdCache[mfrId];
        }
        var raw = (item && item.manufacturer_name ? String(item.manufacturer_name) : '').trim();
        if (raw && !isGenericVendorDisplayName(raw)) return raw;
        return (t('customProduct.vendorFallback') || '廠商');
    }

    /** 列表 API 若仍回占位「廠商」，改以 GET /api/manufacturers/:id 補真實名稱（與控制台同源） */
    function enrichVendorAssetItemsManufacturerNames(items) {
        var list = (items || []).slice();
        var need = [];
        list.forEach(function (it) {
            var id = (it.manufacturer_id || '').trim();
            if (!id) return;
            if (!isGenericVendorDisplayName(vendorItemManufacturerName(it))) return;
            if (vendorMfrNameByIdCache[id] && !isGenericVendorDisplayName(vendorMfrNameByIdCache[id])) return;
            need.push(id);
        });
        need = need.filter(function (id, i, arr) { return arr.indexOf(id) === i; });
        if (!need.length) return Promise.resolve(list);
        return Promise.all(need.map(function (id) {
            if (vendorMfrNameByIdCache[id] && !isGenericVendorDisplayName(vendorMfrNameByIdCache[id])) {
                return Promise.resolve();
            }
            return fetch('/api/manufacturers/' + encodeURIComponent(id), { cache: 'no-store' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (m) {
                    var n = (m && m.name) ? String(m.name).trim() : '';
                    if (n && !isGenericVendorDisplayName(n)) vendorMfrNameByIdCache[id] = n;
                })
                .catch(function () {});
        })).then(function () {
            return list.map(function (it) {
                var id = (it.manufacturer_id || '').trim();
                if (id && vendorMfrNameByIdCache[id] && !isGenericVendorDisplayName(vendorMfrNameByIdCache[id])) {
                    return Object.assign({}, it, { manufacturer_name: vendorMfrNameByIdCache[id] });
                }
                return it;
            });
        });
    }

    function syncVendorStylesTabFiltersToPicker() {
        var bsId = ($('#bs-manufacturer-id').val() || '').trim();
        var bsName = ($('#bs-manufacturer-name').val() || '').trim();
        var bsQ = ($('#bs-filter-q').val() || '').trim();
        $('#vendorAssetsManufacturerId').val(bsId);
        $('#vendorAssetsManufacturerName').val(bsName);
        $('#vendorAssetsSearch').val(bsQ);
        $('#vendorAssetsAssetKind').val('prototype');
    }

    function isVendorStylesTabActive() {
        var $panel = $('#panel-vendor-styles');
        if ($panel.length && ($panel.hasClass('active') || $panel.hasClass('show'))) return true;
        try {
            return new URLSearchParams(window.location.search).get('tab') === 'vendor-styles';
        } catch (e) {
            return false;
        }
    }

    /** 廠商版型 Tab 專用查詢（不依素材庫 modal 子分類／asset_kind 狀態） */
    function buildVendorStylesTabFetchUrl(mainKey, subKey) {
        if (!mainKey) return '';
        var url = '/api/vendor-assets?category_key=' + encodeURIComponent(mainKey) +
            '&asset_kind=prototype';
        if (subKey) url += '&subcategory_key=' + encodeURIComponent(subKey);
        var mfrId = ($('#bs-manufacturer-id').val() || '').trim();
        if (mfrId) {
            url += '&manufacturer_id=' + encodeURIComponent(mfrId);
        } else {
            var mfrName = ($('#bs-manufacturer-name').val() || '').trim();
            if (mfrName) url += '&manufacturer_name=' + encodeURIComponent(mfrName);
        }
        var keyword = ($('#bs-filter-q').val() || '').trim();
        if (keyword) url += '&q=' + encodeURIComponent(keyword);
        url += '&limit=' + encodeURIComponent(String(vendorStylesTabPageSize));
        url += '&offset=' + encodeURIComponent(String(vendorStylesTabOffset));
        return url;
    }

    function buildVendorStyleDesignUrl(item) {
        if (!item || !item.id) return '/custom-product.html?tab=product-design';
        var url = '/custom-product.html?tab=product-design&prototype_asset_id=' + encodeURIComponent(item.id);
        if (item.manufacturer_id) url += '&manufacturer_id=' + encodeURIComponent(item.manufacturer_id);
        return url;
    }

    function buildVendorStyleBrowseCardHtml(item) {
        var imgUrl = (item.image_url || '').replace(/"/g, '&quot;');
        var title = (item.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        var mfrName = vendorItemManufacturerName(item).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        var mfrLogo = vendorMfrLogoHtml(item.manufacturer_logo_url, 'vendor-asset-mfr-logo');
        var profileUrl = (item.manufacturer_profile_url || '#').replace(/"/g, '&quot;');
        var designUrl = buildVendorStyleDesignUrl(item).replace(/"/g, '&quot;');
        var returnTo = encodeURIComponent('/custom-product.html?tab=product-design');
        var guideUrl = (item.match_guide_url || ('/product-tree.html?prototype_asset_id=' + encodeURIComponent(item.id || '') + '&return_to=' + returnTo)).replace(/"/g, '&quot;');
        var selectLbl = (t('browseStyles.selectForDesign') || '選此款帶回設計').replace(/</g, '&lt;');
        var guideLbl = (t('browseStyles.viewMatchGuide') || '看可搭配').replace(/</g, '&lt;');
        var linkCount = item.link_count != null ? Number(item.link_count) : (Number(item.material_count || 0) + Number(item.part_count || 0));
        var hasLinks = linkCount > 0;
        var linkHint = hasLinks
            ? '<span class="badge bg-light text-secondary border mb-1">' +
            (t('browseStyles.linkCountBadge') || '可搭配 {n} 項').replace('{n}', String(linkCount)).replace(/</g, '&lt;') + '</span> '
            : '';
        var thumb = imgUrl
            ? '<img src="' + imgUrl + '" alt="" loading="lazy" style="height:140px;width:100%;object-fit:cover;">'
            : '<div class="d-flex align-items-center justify-content-center bg-light text-muted" style="height:140px;"><i class="bi bi-image fs-2"></i></div>';
        var thumbInner = '<a href="' + designUrl + '" class="text-decoration-none text-dark bs-card-thumb-link" data-prototype-id="' +
            escAttr(item.id || '') + '">' + thumb + '</a>';
        var selectBtn = '<a href="' + designUrl + '" class="btn btn-sm btn-primary w-100 bs-btn-select-design" data-prototype-id="' +
            escAttr(item.id || '') + '">' + selectLbl + '</a>';
        var guideBtn = hasLinks
            ? '<a href="' + guideUrl + '" class="btn btn-sm btn-outline-secondary w-100">' + guideLbl + '</a>'
            : '';
        return '<article class="bs-card h-100 d-flex flex-column">' +
            thumbInner +
            '<div class="bs-card-body p-2 flex-grow-1">' +
            linkHint +
            '<div class="fw-semibold small text-truncate mb-1" title="' + title + '">' + title + '</div>' +
            '<div class="d-flex align-items-center gap-1">' + mfrLogo +
            '<a href="' + profileUrl + '" class="small text-primary text-decoration-none text-truncate" target="_blank" rel="noopener" title="' + mfrName + '">' + mfrName + '</a></div></div>' +
            '<div class="p-2 pt-0 bs-card-actions d-grid gap-1">' + selectBtn + guideBtn + '</div></article>';
    }

    function escAttr(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    var vendorStylesTabOffset = 0;
    var vendorStylesTabPageSize = 24;
    var vendorStylesTabLoadSeq = 0;
    var vendorStylesMfrSuggestTimer = null;

    function hideBsManufacturerSuggest() {
        $('#bs-manufacturer-suggest').addClass('d-none').empty();
    }

    function fetchBsManufacturerSuggest(q) {
        var mainKey = ($('#imageCategoryMainSelect').val() || '').trim();
        if (!mainKey) return;
        var subKey = ($('#imageCategorySubSelect').val() || '').trim();
        var url = '/api/manufacturers?category_key=' + encodeURIComponent(mainKey) +
            '&q=' + encodeURIComponent(q) + '&per_page=15';
        if (subKey) url += '&subcategory_key=' + encodeURIComponent(subKey);
        fetch(url).then(function (r) { return r.json(); }).then(function (data) {
            var list = (data && data.manufacturers) ? data.manufacturers : [];
            var $box = $('#bs-manufacturer-suggest');
            if (!$box.length) return;
            if (!list.length) {
                hideBsManufacturerSuggest();
                return;
            }
            var html = list.map(function (m) {
                var name = (m.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                var id = (m.id || '').toString().replace(/"/g, '&quot;');
                var logo = vendorMfrLogoHtml(m.logo_url, 'vendor-mfr-suggest-logo');
                return '<button type="button" class="list-group-item list-group-item-action vendor-mfr-suggest-item" role="option"' +
                    ' data-mfr-id="' + id + '" data-mfr-name="' + name + '">' + logo +
                    '<span class="text-truncate">' + name + '</span></button>';
            }).join('');
            $box.html(html).removeClass('d-none');
        }).catch(function () { hideBsManufacturerSuggest(); });
    }

    function updateVendorStylesCategorySummary() {
        syncCategoriesDataFromPicker();
        var $box = $('#bs-category-summary');
        if (!$box.length) return;
        var mainKey = ($('#imageCategoryMainSelect').val() || '').trim();
        var subKey = ($('#imageCategorySubSelect').val() || '').trim();
        if (!mainKey) {
            $box.addClass('d-none');
            return;
        }
        var cat = categoriesData.find(function (c) { return String(c.key) === String(mainKey); });
        var sub = cat && cat.subcategories
            ? cat.subcategories.find(function (s) { return String(s.key) === String(subKey); })
            : null;
        var mainLbl = categoryLabelForKey(mainKey, cat ? cat.name : mainKey);
        var subLbl = subKey ? categoryLabelForKey(subKey, sub ? sub.name : subKey) : '—';
        $('#bs-cat-main-label').text(mainLbl);
        $('#bs-cat-sub-label').text(subLbl);
        $box.removeClass('d-none');
        if (typeof window.updateCategoryMobileBtnLabels === 'function') {
            window.updateCategoryMobileBtnLabels();
        }
    }

    function loadVendorStylesTabList() {
        if (!$('#panel-vendor-styles').length) return;
        updateVendorStylesCategorySummary();
        var mainKey = ($('#imageCategoryMainSelect').val() || '').trim();
        var $loading = $('#bs-loading');
        var $empty = $('#bs-empty');
        var $grid = $('#bs-grid');
        var $alert = $('#bs-alert');
        if (!mainKey) {
            if ($loading.length) $loading.addClass('d-none');
            if ($grid.length) $grid.addClass('d-none');
            if ($empty.length) {
                $empty.removeClass('d-none');
                var $p = $empty.find('p');
                if ($p.length) {
                    var pickMsg = (window.matchMedia('(max-width: 768px)').matches)
                        ? (t('customProduct.vendorStylesPickCategoryMobile') || '請點上方「分類」選擇主分類與子分類。')
                        : (t('customProduct.vendorStylesPickCategoryFirst') || '請先到「產品設計」Tab 選擇主分類與子分類。');
                    $p.text(pickMsg);
                }
            }
            return;
        }
        var subKey = ($('#imageCategorySubSelect').val() || '').trim();
        var subForApi = pickerSubcategoryAppliesToAssetKind('prototype') ? subKey : '';
        if (pickerSubcategoryAppliesToAssetKind('prototype') && !subForApi) {
            var cat = categoriesData.find(function (c) { return String(c.key) === String(mainKey); });
            if (cat && cat.subcategories && cat.subcategories.length) {
                if ($loading.length) $loading.addClass('d-none');
                if ($grid.length) $grid.addClass('d-none');
                if ($empty.length) {
                    $empty.removeClass('d-none');
                    $empty.find('p').text(t('customProduct.vendorStylesPickSubcategory') ||
                        '請選擇子分類（點上方「分類」）。');
                }
                return;
            }
        }
        syncVendorStylesTabFiltersToPicker();
        var url = buildVendorStylesTabFetchUrl(mainKey, subForApi);
        if (!url) return;
        var seq = ++vendorStylesTabLoadSeq;
        if ($loading.length) $loading.removeClass('d-none');
        if ($alert.length) $alert.addClass('d-none');
        if ($empty.length) $empty.addClass('d-none');
        var fetchOpts = {};
        var fetchPromise = (typeof window.AuthService !== 'undefined' && typeof window.AuthService.getSession === 'function')
            ? window.AuthService.getSession().then(function (session) {
                if (session && session.access_token) {
                    fetchOpts.headers = { Authorization: 'Bearer ' + session.access_token };
                }
                return fetch(url, fetchOpts);
            })
            : fetch(url, fetchOpts);
        fetchPromise.then(function (r) {
            return r.json().then(function (data) { return { ok: r.ok, data: data || {} }; });
        }).then(function (res) {
            if (seq !== vendorStylesTabLoadSeq) return;
            if ($loading.length) $loading.addClass('d-none');
            if (!res.ok) {
                if ($alert.length) {
                    $alert.removeClass('d-none').text(res.data.error || res.data.message || (t('customProduct.loadFailed') || '載入失敗'));
                }
                return;
            }
            var items = (res.data && res.data.items) ? res.data.items : [];
            return enrichVendorAssetItemsManufacturerNames(items).then(function (enriched) {
            /* 廠商版型 Tab 不用素材庫 modal 的 MOQ／客製化篩選，避免誤濾掉全部款式 */
            items = enriched;
            items = items.filter(function (it) {
                return (it.asset_kind || 'prototype').toLowerCase() === 'prototype';
            });
            if (!$grid.length) return;
            $grid.empty();
            if (!items.length) {
                $grid.addClass('d-none');
                if ($empty.length) {
                    $empty.removeClass('d-none');
                    var $p = $empty.find('p');
                    if ($p.length) {
                        $p.text(t('browseStyles.empty') ||
                            '此條件下尚無「已公開」的數位原型。請確認廠商素材庫已勾選公開，且主／子分類與上傳時一致。');
                    }
                }
                return;
            }
            $empty.addClass('d-none');
            $grid.removeClass('d-none');
            items.forEach(function (item) {
                $grid.append(buildVendorStyleBrowseCardHtml(item));
            });
            renderVendorStylesTabPager((res.data && res.data.total != null) ? Number(res.data.total) : items.length);
            });
        }).catch(function () {
            if (seq !== vendorStylesTabLoadSeq) return;
            if ($loading.length) $loading.addClass('d-none');
            if ($empty.length) {
                $empty.removeClass('d-none');
                $empty.find('p').text(t('customProduct.loadFailed') || '載入失敗');
            }
        });
    }
    window.loadVendorStylesTabList = loadVendorStylesTabList;

    function renderVendorStylesTabPager(total) {
        var $nav = $('#bs-pager');
        if (!$nav.length) return;
        if (!Number.isFinite(total) || total <= vendorStylesTabPageSize) {
            $nav.addClass('d-none').empty();
            return;
        }
        $nav.removeClass('d-none');
        var page = Math.floor(vendorStylesTabOffset / vendorStylesTabPageSize) + 1;
        var pages = Math.max(1, Math.ceil(total / vendorStylesTabPageSize));
        $nav.html(
            '<button type="button" class="btn btn-sm btn-outline-secondary" id="bs-pager-prev"' + (vendorStylesTabOffset <= 0 ? ' disabled' : '') + '>' +
            (t('browseStyles.prevPage') || '上一頁') + '</button>' +
            '<span class="align-self-center small text-muted px-2">' + page + ' / ' + pages + '</span>' +
            '<button type="button" class="btn btn-sm btn-outline-secondary" id="bs-pager-next"' +
            (vendorStylesTabOffset + vendorStylesTabPageSize >= total ? ' disabled' : '') + '>' +
            (t('browseStyles.nextPage') || '下一頁') + '</button>'
        );
    }

    $(document).on('input', '#bs-manufacturer-name', function () {
        $('#bs-manufacturer-id').val('');
        var q = ($(this).val() || '').trim();
        clearTimeout(vendorStylesMfrSuggestTimer);
        vendorStylesMfrSuggestTimer = setTimeout(function () {
            if (q.length >= 1) fetchBsManufacturerSuggest(q);
            else hideBsManufacturerSuggest();
            vendorStylesTabOffset = 0;
            loadVendorStylesTabList();
        }, 320);
    });

    $(document).on('mousedown', '#bs-manufacturer-suggest .vendor-mfr-suggest-item', function (e) {
        e.preventDefault();
        var id = ($(this).attr('data-mfr-id') || '').trim();
        var name = ($(this).attr('data-mfr-name') || '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        $('#bs-manufacturer-id').val(id);
        $('#bs-manufacturer-name').val(name);
        hideBsManufacturerSuggest();
        vendorStylesTabOffset = 0;
        loadVendorStylesTabList();
    });

    $(document).on('blur', '#bs-manufacturer-name', function () {
        setTimeout(hideBsManufacturerSuggest, 180);
    });

    $(document).on('input', '#bs-filter-q', function () {
        clearTimeout(vendorStylesMfrSuggestTimer);
        vendorStylesMfrSuggestTimer = setTimeout(function () {
            vendorStylesTabOffset = 0;
            loadVendorStylesTabList();
        }, 400);
    });

    $(document).on('click', '#bs-pager-prev', function () {
        vendorStylesTabOffset = Math.max(0, vendorStylesTabOffset - vendorStylesTabPageSize);
        loadVendorStylesTabList();
    });
    $(document).on('click', '#bs-pager-next', function () {
        vendorStylesTabOffset += vendorStylesTabPageSize;
        loadVendorStylesTabList();
    });

    $(document).on('click', '#bs-go-set-category', function () {
        if (window.matchMedia('(max-width: 768px)').matches && typeof window.matchdoOpenCategorySheet === 'function') {
            window.matchdoOpenCategorySheet();
            return;
        }
        var tabEl = document.getElementById('tab-product-design');
        if (tabEl && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
            bootstrap.Tab.getOrCreateInstance(tabEl).show();
        }
    });

    document.addEventListener('matchdo:categoryChanged', function () {
        syncCategoriesDataFromPicker();
        vendorStylesTabOffset = 0;
        updateVendorStylesCategorySummary();
        if (isVendorStylesTabActive()) {
            loadVendorStylesTabList();
        }
    });

    (function initVendorStylesTabFromUrl() {
        var params = new URLSearchParams(window.location.search);
        var mfrId = (params.get('manufacturer_id') || '').trim();
        var mfrName = (params.get('vendor_name') || '').trim();
        if (mfrId) {
            $('#bs-manufacturer-id').val(mfrId);
            if (mfrName) $('#bs-manufacturer-name').val(decodeURIComponent(mfrName));
        }
        if (params.get('tab') === 'vendor-styles') {
            setTimeout(loadVendorStylesTabList, 0);
            setTimeout(loadVendorStylesTabList, 400);
        }
    })();

    $('#vendorAssetsManufacturerName').on('input', function () {
        var $cell = $('.vendor-picker-mfr-name-cell');
        if ($cell.hasClass('d-none')) return;
        $('#vendorAssetsManufacturerId').val('');
        var q = ($(this).val() || '').trim();
        clearTimeout(vendorMfrSuggestTimer);
        vendorMfrSuggestTimer = setTimeout(function () {
            if (q.length >= 1) fetchVendorManufacturerSuggest(q);
            else hideVendorManufacturerSuggest();
            applyVendorManufacturerFilterFromInput();
        }, 320);
    });

    $(document).on('mousedown', '#vendorAssetsPickerModal .vendor-mfr-suggest-item', function (e) {
        e.preventDefault();
        var id = ($(this).attr('data-mfr-id') || '').trim();
        var name = ($(this).attr('data-mfr-name') || '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        $('#vendorAssetsManufacturerId').val(id);
        $('#vendorAssetsManufacturerName').val(name);
        hideVendorManufacturerSuggest();
        vendorPickerOffset = 0;
        loadVendorAssetsPickerList();
    });

    $(document).on('blur', '#vendorAssetsManufacturerName', function () {
        setTimeout(function () { hideVendorManufacturerSuggest(); }, 180);
    });

    $('#vendorAssetsClearFilter').on('click', function () {
        resetVendorAssetFilters();
        vendorPickerOffset = 0;
        loadVendorAssetsPickerList();
    });

    $('#vendorAssetsApplyFilter').on('click', function () {
        vendorPickerOffset = 0;
        loadVendorAssetsPickerList();
    });

    $(document).on('click', '#vendorAssetsPickerModal .vendor-picker-page-size-btn', function () {
        var n = parseInt($(this).attr('data-size'), 10);
        if (n !== 12 && n !== 24 && n !== 48) return;
        setVendorPickerPageSize(n);
        vendorPickerOffset = 0;
        loadVendorAssetsPickerList();
    });
    $('#vendorAssetsListPrev').on('click', function () {
        vendorPickerOffset = Math.max(0, vendorPickerOffset - vendorPickerPageSize);
        loadVendorAssetsPickerList();
    });
    $('#vendorAssetsListNext').on('click', function () {
        vendorPickerOffset += vendorPickerPageSize;
        loadVendorAssetsPickerList();
    });

    // 從廠商素材庫選擇：依設計當下主分類載入（可由各意圖插槽呼叫）
    $('#btnRefFromVendorAssets').on('click', function () {
        openCategoryVendorPicker(null);
    });

    // 從此廠商版型庫選擇：僅當 URL 帶 manufacturer_id 時顯示按鈕
    $('#btnRefFromThisVendorAssets').on('click', function () {
        if (!refVendorMfrId) return;
        try { window.__refImportTargetSlot = 'prototype'; } catch (e) {}
        resetVendorAssetFilters();
        $('#vendorAssetsAssetKind').val('prototype');
        setVendorPickerMfrScopedMode(true);
        updateVendorPickerPrototypeFiltersVisibility();
        var labelText = refVendorName
            ? ((t('customProduct.selectFromVendorBasePrefix') || '從 ') + refVendorName + (t('customProduct.selectFromVendorBaseSuffix') || ' 版型庫選擇'))
            : (t('customProduct.selectFromThisVendorBase') || '從此廠商版型庫選擇');
        $('#vendorAssetsPickerLabel').text(labelText);
        updateVendorPickerDesignCategoryDisplay();
        var modalEl = document.getElementById('vendorAssetsPickerModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            (new bootstrap.Modal(modalEl)).show();
        }
        vendorPickerOffset = 0;
        setVendorPickerPageSize(readVendorPickerPageSize());
        try { window.__vendorAssetsFetchParams = { mode: 'manufacturer', manufacturerId: refVendorMfrId }; } catch (e) {}
        var $moreMfr = document.querySelector('#vendorAssetsPickerModal .vendor-picker-more-filters');
        if ($moreMfr) $moreMfr.open = true;
        fillVendorCatalogGroupSelect(refVendorMfrId).then(function () {
            updateVendorPickerMultiVendorHint();
            loadVendorAssetsPickerList();
        });
    });

    // AI 生成圖片：必選圖內容分類，後端依選中的 key 組合提示詞 + 使用者描述
    // 防止手機雙擊／連點導致多個生成請求同時進行
    var isGenerateInProgress = false;
    $('#generateImageBtn').click(async function () {
        if (isGenerateInProgress) return;
        isGenerateInProgress = true;
        if (typeof window.gtag === 'function') { window.gtag('event', 'design_generate_click', {}); }
        const prompt = composeUserPromptForGenerate();
        if (!prompt) {
            alert(getRefKindCounts().total > 0
                ? t('customProduct.needPromptOrSuggestRefs')
                : t('customProduct.needPrompt'));
            isGenerateInProgress = false;
            return;
        }
        const mainKey = $('#imageCategoryMainSelect').val();
        const subKey = $('#imageCategorySubSelect').val();
        const categoryKeys = [];
        if (mainKey) categoryKeys.push(mainKey);
        if (subKey) categoryKeys.push(subKey);
        if (categoryKeys.length === 0) {
            alert('請先選擇主分類（必選），會影響生成的產品類型。');
            isGenerateInProgress = false;
            return;
        }
        alertUnsupportedRefScopeBeforeGenerate();

        const btn = $(this);
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>AI 生成中...');
        // 手機版畫布：顯示 loading 脈衝
        $('#generatedImagePreviewWrap').addClass('is-loading');

        var orderedRefs = collectReferencePayload();
        var referenceImages = orderedRefs.referenceImages;
        var seedVal = $('#generationSeed').val();
        var seedNum = (seedVal !== '' && seedVal != null && Number.isInteger(Number(seedVal))) ? Number(seedVal) : null;

        try {
            const payload = {
                prompt,
                categoryKeys,
                aspectRatio: '1:1',
                resolution: '2K',
                output_format: 'jpeg'
            };
            if (referenceImages.length > 0) {
                payload.referenceImages = referenceImages;
                if (orderedRefs.referenceSources.length) payload.referenceSources = orderedRefs.referenceSources;
            }
            if (seedNum != null) payload.seed = seedNum;
            try {
                if (window.i18n && typeof window.i18n.getLang === 'function') payload.ui_locale = window.i18n.getLang();
            } catch (e) { /* ignore */ }

            var headers = { 'Content-Type': 'application/json' };
            try {
                var session = (typeof window.AuthService !== 'undefined' && window.AuthService.getSession) ? await window.AuthService.getSession() : null;
                if (session && session.access_token) headers['Authorization'] = 'Bearer ' + session.access_token;
            } catch (e) {}
            const response = await fetch('/api/generate-product-image', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            var text = await response.text();
            var result = null;
            try {
                result = text ? JSON.parse(text) : {};
            } catch (e) {
                if (typeof text === 'string' && text.trim().startsWith('<')) {
                    $('#generatedImagePreview').html(`
                        <div class="alert alert-warning">
                            <h6><i class="fas fa-server me-2"></i>API 未正確回應</h6>
                            <p class="mb-2">伺服器回傳了網頁而非資料，請確認後端服務已啟動且網址正確（例如本機請用同一埠開啟頁面與 API）。</p>
                            <button type="button" class="btn btn-sm btn-warning" onclick="$('#generateImageBtn').click()">
                                <i class="fas fa-redo me-1"></i>重試
                            </button>
                        </div>
                    `);
                    showGeneratedResult();
                    document.getElementById('generatedImagePreviewWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                throw e;
            }

            if (result && result.success) {
                if (window.fromRedesign) {
                    trackDesignAction('redesign_generate_ok');
                    window.fromRedesign = false;
                }
                generatedImageData = result.imageData;
                lastGeneratedImageUrl = result.imageUrl || null;
                lastGeneratedPrompt = prompt || '';
                lastGeneratedSeed = (result.seedUsed != null && result.seedUsed !== '') ? result.seedUsed : null;
                if (lastGeneratedSeed != null) $('#generationSeed').val(lastGeneratedSeed);
                addGeneratedThumbnailToGallery(result.imageData, prompt, lastGeneratedSeed);
                var imgSrc = result.imageUrl || result.imageData || '';
                var previewHtml = '';
                if (imgSrc) {
                    previewHtml += '<div class="mb-2"><img src="' + String(imgSrc).replace(/"/g, '&quot;') + '" alt="Generated" class="rounded js-preview-enlarge" style="max-width:100%;height:auto;display:block;cursor:pointer;" title="點擊放大" /></div>';
                }
                var nextStepText = (typeof t === 'function' && t('customProduct.designNextStepHint')) ? t('customProduct.designNextStepHint') : '建議：可到「我的數位資產」查看，或到「圖庫找廠商」找廠商訂製';
                previewHtml += '<p class="text-success small mb-2"><i class="fas fa-check-circle me-1"></i>已生成並儲存，重整後仍會保留在右側歷史</p>' +
                    '<p class="small text-muted mb-2">' + nextStepText + '</p>' +
                    '<a href="/client/my-custom-products.html" class="btn btn-sm btn-outline-secondary me-1"><i class="bi bi-box-seam me-1"></i>我的數位資產</a> ' +
                    '<a href="/custom/gallery.html" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-search me-1"></i>圖庫找廠商</a> ' +
                    '<button type="button" class="btn btn-sm btn-outline-primary" onclick="$(\'#generateImageBtn\').click()"><i class="fas fa-redo me-1"></i>重新生成</button>';
                $('#generatedImagePreview').html(previewHtml);
                showGeneratedResult();
                try { refreshPastGeneratedGallery(); } catch (e) { console.warn(e); }
                document.getElementById('generatedImagePreviewWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (response.status === 402) {
                $('#generatedImagePreview').html(`
                    <div class="alert alert-warning">
                        <h6><i class="fas fa-coins me-2"></i>點數不足</h6>
                        <p class="mb-2">${result.error || '點數不足，無法生圖'}</p>
                        <a href="/credits.html" class="btn btn-sm btn-warning me-2"><i class="fas fa-plus me-1"></i>購買點數</a>
                        <a href="/subscription-plans.html" class="btn btn-sm btn-outline-secondary"><i class="fas fa-crown me-1"></i>升級方案</a>
                    </div>
                `);
                showGeneratedResult();
                document.getElementById('generatedImagePreviewWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                $('#generatedImagePreview').html(`
                    <div class="alert alert-danger">
                        <h6><i class="fas fa-exclamation-triangle me-2"></i>生成失敗</h6>
                        <p class="mb-2">${result.error || '未知錯誤'}</p>
                        ${result.details ? `<p class="small text-muted mb-2">${result.details}</p>` : ''}
                        <button type="button" class="btn btn-sm btn-danger" onclick="$('#generateImageBtn').click()">
                            <i class="fas fa-redo me-1"></i>重試
                        </button>
                    </div>
                `);
                showGeneratedResult();
                document.getElementById('generatedImagePreviewWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            console.error('Generate image error:', error);
            var isHtmlResponse = error instanceof SyntaxError && (error.message || '').indexOf('not valid JSON') !== -1;
            var msg = isHtmlResponse
                ? '伺服器回傳了網頁而非資料，請確認後端服務已啟動且網址正確。'
                : '請檢查網路連線或稍後再試';
            var title = isHtmlResponse ? 'API 未正確回應' : '網路連線失敗';
            $('#generatedImagePreview').html(`
                <div class="alert alert-warning">
                    <h6><i class="fas fa-${isHtmlResponse ? 'server' : 'wifi'} me-2"></i>${title}</h6>
                    <p class="mb-2">${msg}</p>
                    <button type="button" class="btn btn-sm btn-warning" onclick="$('#generateImageBtn').click()">
                        <i class="fas fa-redo me-1"></i>重試
                    </button>
                </div>
            `);
            showGeneratedResult();
            document.getElementById('generatedImagePreviewWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } finally {
            isGenerateInProgress = false;
            btn.prop('disabled', false).html(originalText);
            // 手機版畫布：移除 loading 脈衝
            $('#generatedImagePreviewWrap').removeClass('is-loading');
        }
    });

    // 2. Textarea 自動長高（僅手機）
    var $prompt = $('#productPrompt');
    if (window.innerWidth <= 768) {
        $prompt.attr('rows', 1);
        $prompt.css({ 'resize': 'none', 'overflow': 'hidden', 'transition': 'height 0.1s ease', 'min-height': 'unset' });
        function autoGrowPrompt() {
            $prompt[0].style.height = 'auto';
            $prompt[0].style.height = ($prompt[0].scrollHeight) + 'px';
        }
        $prompt.on('input', autoGrowPrompt);
        autoGrowPrompt();
    }

    // ── 手機版分類 Bottom Sheet（產品設計 Tab + 廠商版型 Tab 共用）──
    (function catBottomSheet() {
        var catSheetInited = false;
        var currentMainCat = null;

        function isMobileCategoryUi() {
            return window.matchMedia('(max-width: 768px)').matches;
        }

        function catSheetEls() {
            return {
                $sheet: $('#catBottomSheet'),
                $list: $('#catBsList'),
                $title: $('#catBsTitle'),
                $back: $('#catBsBack'),
                $close: $('#catBsClose')
            };
        }

        // 更新手機分類按鈕標籤（產品設計 #catMobileBtn、廠商版型 #bs-cat-mobile-btn）
        function updateBtnLabel() {
            var mainText = $('#imageCategoryMainList .cat-option.selected').text().trim();
            var subText  = $('#imageCategorySubList  .cat-option.selected').text().trim();
            var label = mainText
                ? mainText + (subText ? ' › ' + subText : '')
                : (t('customProduct.categoryRequired') || '分類（必選）');
            $('#catMobileBtnLabel, #bsCatMobileBtnLabel').text(label);
            var $mobileBtns = $('#catMobileBtn, #bs-cat-mobile-btn');
            if (mainText) $mobileBtns.addClass('has-value');
            else $mobileBtns.removeClass('has-value');
        }
        window.updateCategoryMobileBtnLabels = updateBtnLabel;

        // 用 MutationObserver 監聽 subList 內容/class 變動，同步更新按鈕
        function watchList(id) {
            var el = document.getElementById(id);
            if (el && window.MutationObserver) {
                new MutationObserver(updateBtnLabel).observe(el, {
                    childList: true, subtree: true, attributes: true, attributeFilter: ['class']
                });
            }
        }
        watchList('imageCategoryMainList');
        watchList('imageCategorySubList');

        // 顯示主分類列表
        function showMainStep() {
            var els = catSheetEls();
            currentMainCat = null;
            els.$title.text('選擇主分類');
            els.$back.css('visibility', 'hidden');
            els.$list.empty();
            var curMainKey = $('#imageCategoryMainSelect').val();
            categoriesData.forEach(function(c) {
                var key = c.key != null ? String(c.key) : '';
                var name = $('#imageCategoryMainList .cat-option[data-key="' + key.replace(/"/g, '&quot;') + '"]').text().trim() || c.name || key;
                var hasSub = c.subcategories && c.subcategories.length > 0;
                var isSel  = curMainKey === key;
                var $item  = $('<div class="cat-bs-item" role="button">');
                $item.append(
                    isSel
                        ? $('<i class="bi bi-check2 cat-bs-check">').text('')
                        : $('<span class="cat-bs-placeholder-icon">'),
                    $('<span>').text(name)
                );
                if (hasSub) $item.append($('<i class="bi bi-chevron-right cat-bs-chevron">'));
                if (isSel) $item.addClass('is-selected');
                $item.on('click', function() {
                    if (hasSub) {
                        showSubStep(c);
                    } else {
                        // 無子分類：直接觸發現有 click 並關閉
                        $('#imageCategoryMainList .cat-option[data-key="' + key.replace(/"/g, '&quot;') + '"]').trigger('click');
                        closeSheet();
                    }
                });
                els.$list.append($item);
            });
        }

        // 顯示子分類列表
        function showSubStep(mainCat) {
            var els = catSheetEls();
            currentMainCat = mainCat;
            var key = mainCat.key != null ? String(mainCat.key) : '';
            var mainName = $('#imageCategoryMainList .cat-option[data-key="' + key.replace(/"/g, '&quot;') + '"]').text().trim() || mainCat.name || key;
            els.$title.text(mainName);
            els.$back.css('visibility', 'visible');
            els.$list.empty();
            // 先觸發主分類 click，同步填好 sub list（現有 JS 邏輯）
            $('#imageCategoryMainList .cat-option[data-key="' + key.replace(/"/g, '&quot;') + '"]').trigger('click');
            var curSubKey = $('#imageCategorySubSelect').val();
            (mainCat.subcategories || []).forEach(function(sub) {
                var subKey  = sub.key != null ? String(sub.key) : '';
                var subName = $('#imageCategorySubList .cat-option[data-key="' + subKey.replace(/"/g, '&quot;') + '"]').text().trim() || sub.name || subKey;
                var isSel   = curSubKey === subKey;
                var $item   = $('<div class="cat-bs-item" role="button">');
                $item.append(
                    isSel
                        ? $('<i class="bi bi-check2 cat-bs-check">').text('')
                        : $('<span class="cat-bs-placeholder-icon">'),
                    $('<span>').text(subName)
                );
                if (isSel) $item.addClass('is-selected');
                $item.on('click', function() {
                    $('#imageCategorySubList .cat-option[data-key="' + subKey.replace(/"/g, '&quot;') + '"]').trigger('click');
                    closeSheet();
                });
                els.$list.append($item);
            });
        }

        function openSheet() {
            if (!isMobileCategoryUi()) return;
            showMainStep();
            var els = catSheetEls();
            els.$sheet.addClass('open').attr('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeSheet() {
            var els = catSheetEls();
            els.$sheet.removeClass('open').attr('aria-hidden', 'true');
            document.body.style.overflow = '';
            updateBtnLabel();
        }

        function bindMobileCategoryUi() {
            if (catSheetInited || !isMobileCategoryUi()) return;
            catSheetInited = true;
            var els = catSheetEls();
            els.$close.on('click', closeSheet);
            els.$back.on('click', showMainStep);
            els.$sheet.find('.cat-bs-backdrop').on('click', closeSheet);
            $('#catMobileBtn').show();
            $('#bs-cat-mobile-btn').removeClass('d-none').show();
            setTimeout(updateBtnLabel, 600);
        }

        $(document).on('click', '#catMobileBtn, #bs-cat-mobile-btn', function (e) {
            if (!isMobileCategoryUi()) return;
            e.preventDefault();
            bindMobileCategoryUi();
            openSheet();
        });

        window.matchdoOpenCategorySheet = function () {
            bindMobileCategoryUi();
            openSheet();
        };

        bindMobileCategoryUi();
        try {
            window.matchMedia('(max-width: 768px)').addEventListener('change', function (e) {
                if (e.matches) bindMobileCategoryUi();
            });
        } catch (e) { /* ignore */ }
    })();

    // 儲存此生成結果為訂製產品（含前端輸入的提示詞 generation_prompt）
    $(document).on('click', '#saveGeneratedProductBtn', function () {
        var btn = $(this);
        var promptText = (lastGeneratedPrompt || $('#productPrompt').val() || '').trim();
        var title = promptText ? promptText.substring(0, 80) + (promptText.length > 80 ? '…' : '') : '產品草圖';
        var description = promptText || '（無描述）';
        var seedToSave = lastGeneratedSeed;
        if (seedToSave == null || seedToSave === '') {
            var seedInput = $('#generationSeed').val();
            if (seedInput !== '' && Number.isInteger(Number(seedInput))) seedToSave = Number(seedInput);
        }
        var imageUrl = lastGeneratedImageUrl;
        if (!imageUrl && generatedImageData && typeof generatedImageData === 'string' && generatedImageData.indexOf('data:') === 0) {
            imageUrl = generatedImageData;
        }
        if (!imageUrl) {
            alert('尚無可儲存的生成圖，請先生成草圖。');
            return;
        }
        getAuthToken(function (token) {
            if (!token) {
                alert('請先登入後再儲存。');
                return;
            }
            var mainKey = $('#imageCategoryMainSelect').val() || '';
            var subKey = $('#imageCategorySubSelect').val() || '';
            var refSourcesList = getActiveRefSourcesList();
            var firstRefImageUrl = refSourcesList.length && refSourcesList[0].image_url ? refSourcesList[0].image_url : null;
            var payload = {
                title: title,
                description: description,
                category_key: mainKey || null,
                subcategory_key: subKey || null,
                generation_prompt: promptText || null,
                generation_seed: seedToSave != null ? seedToSave : null,
                ai_generated_image_url: imageUrl
            };
            if (firstRefImageUrl) payload.reference_image_url = firstRefImageUrl;
            if (refSourcesList.length) payload.reference_sources = refSourcesList;
            btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i>儲存中...');
            fetch('/api/custom-products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify(payload)
            })
                .then(function (res) { return res.text().then(function (text) {
                    var data = {};
                    try { data = (text && text.trim() && text.trim().startsWith('{')) ? JSON.parse(text) : {}; } catch (e) {}
                    return { ok: res.ok, data: data };
                }); })
                .then(function (r) {
                    if (r.ok && r.data && r.data.success) {
                        alert('已儲存至「我的訂製產品」。');
                        try { refreshPastGeneratedGallery(); } catch (e) { console.warn(e); }
                    } else {
                        alert(r.data && r.data.error ? r.data.error : '儲存失敗');
                    }
                })
                .catch(function (err) {
                    console.warn('save product:', err);
                    alert('儲存失敗，請稍後再試');
                })
                .finally(function () { btn.prop('disabled', false).html('<i class="fas fa-save me-1"></i>儲存為我的訂製產品'); });
        });
    });

    // 返回頂部
    $('.back-to-top').click(function () {
        $('html, body').animate({ scrollTop: 0 }, 'slow');
        return false;
    });

    // 滾動時顯示返回頂部按鈕
    $(window).scroll(function () {
        if ($(this).scrollTop() > 100) {
            $('.back-to-top').fadeIn();
        } else {
            $('.back-to-top').fadeOut();
        }
    });

    // 取得目前登入 token（優先用 AuthService 與站上一致，避免 session 尚未就緒拿不到 token）
    function getAuthToken(cb) {
        if (typeof window.AuthService !== 'undefined' && window.AuthService.getSession) {
            window.AuthService.getSession().then(function (session) {
                cb(session && session.access_token ? session.access_token : null);
            }).catch(function () { cb(null); });
            return;
        }
        try {
            var c = window.__supabaseClient || window.supabaseClient || (typeof supabase !== 'undefined' && supabase && supabase.createClient ? supabase : null);
            if (c && c.auth) {
                c.auth.getSession().then(function (r) { cb(r && r.data && r.data.session ? r.data.session.access_token : null); }).catch(function () { cb(null); });
                return;
            }
            for (var i = 0; i < (localStorage.length || 0); i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) {
                    var raw = localStorage.getItem(k);
                    if (raw) {
                        try {
                            var data = JSON.parse(raw);
                            if (data && data.access_token) { cb(data.access_token); return; }
                        } catch (parseErr) {}
                    }
                }
            }
        } catch (e) {}
        cb(null);
    }

    // 右側：先問「有沒有歷史資料」，有再抓完整列表與圖。可傳入 token（Auth 回調的 session.access_token）避免搶跑
    function refreshPastGeneratedGallery(optionalToken) {
        var wrap = $('#pastGeneratedGallery');
        if (!wrap.length) return;
        function doFetch(token) {
            var galleryOwnerDisplay = '';
            function getGalleryTitle() { return (galleryOwnerDisplay || t('customProduct.thisAccount')) + t('customProduct.digitalAssetsSuffix'); }
            if (!token) {
                wrap.html(
                    '<p class="past-gallery-title">' + getGalleryTitle() + '</p><div class="past-gallery-inner">' +
                    '<p class="text-muted small mb-0">' + t('customProduct.loginToViewHistory') + '</p>' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>' + t('customProduct.reload') + '</button></div>'
                );
                $('#generatedImagePlaceholder').hide();
                return;
            }
            var sessionThumbs = [];
            wrap.find('.past-item[href^="data:"]').each(function () {
                var href = $(this).attr('href');
                var prompt = $(this).attr('data-prompt') || $(this).attr('title') || '';
                var seed = $(this).attr('data-seed') || '';
                if (href) sessionThumbs.push({ href: href, prompt: prompt, seed: seed });
            });

            function renderEmpty(dbCount) {
                wrap.html(
                    '<p class="past-gallery-title">' + getGalleryTitle() + '</p><div class="past-gallery-inner">' +
                    '<p class="text-muted small mb-0">' + t('customProduct.noHistoryYet') + '</p>' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>' + t('customProduct.reload') + '</button></div>'
                );
                $('#generatedImagePlaceholder').hide();
            }
            function renderLoadError() {
                wrap.html(
                    '<p class="past-gallery-title">' + getGalleryTitle() + '</p><div class="past-gallery-inner">' +
                    '<p class="text-warning small mb-0">' + t('customProduct.loadHistoryError') + '</p>' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>' + t('customProduct.reload') + '</button></div>'
                );
                $('#generatedImagePlaceholder').hide();
            }
            function renderLoading() {
                wrap.html('<p class="past-gallery-title">' + getGalleryTitle() + '</p><div class="past-gallery-inner"><p class="text-muted small mb-0"><i class="fas fa-spinner fa-spin me-1"></i>' + t('home.loading') + '</p></div>');
                $('#generatedImagePlaceholder').hide();
            }
            function renderGallery(products) {
                if (products && products.length > 0 && products[0].owner_display) {
                    galleryOwnerDisplay = String(products[0].owner_display).trim();
                }
                wrap.html('<p class="past-gallery-title">' + getGalleryTitle() + '</p><div class="past-gallery-inner"></div>');
                var grid = wrap.find('.past-gallery-inner');
                sessionThumbs.forEach(function (item) {
                    var dataUrl = item.href || item;
                    var prompt = (item.prompt != null && item.prompt !== undefined) ? String(item.prompt) : '';
                    var seed = (item.seed != null && item.seed !== undefined) ? String(item.seed) : '';
                    var url = (dataUrl + '').replace(/"/g, '&quot;');
                    var tip = (prompt ? String(prompt).replace(/"/g, '&quot;').replace(/</g, '&lt;') : '') || (t('customProduct.thisGeneration') + '（點擊放大）');
                    if (seed) tip += ' · Seed: ' + seed;
                    var $cell = $('<div class="past-item-wrap"></div>').attr({ 'data-image-url': url, 'data-prompt': prompt, 'data-seed': seed !== '' ? seed : '', 'data-owner-display': '' });
                    $cell.append($('<a class="past-item" href="#" role="button" title="' + tip + '"><img src="' + url + '" alt=""></a>'));
                    var caption = (prompt ? prompt.substring(0, 120) : t('customProduct.thisGeneration')) + (seed ? ' · Seed: ' + seed : '');
                    $cell.append($('<p class="past-item-caption text-muted small mb-0">').text(caption));
                    grid.append($cell);
                });
                (products || []).forEach(function (p) {
                    var url = String(p.ai_generated_image_url || p.reference_image_url || '').replace(/"/g, '&quot;');
                    var promptText = String((p.analysis_json && p.analysis_json.generation_prompt) || p.generation_prompt || p.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                    var seedStr = (p.analysis_json && p.analysis_json.generation_seed != null) ? String(p.analysis_json.generation_seed) : (p.generation_seed != null ? String(p.generation_seed) : '');
                    var ownerDisplay = (p.owner_display != null && String(p.owner_display).trim()) ? String(p.owner_display).trim() : (p.owner_email || '');
                    var tip = promptText.substring(0, 120) + (seedStr ? ' · Seed: ' + seedStr : '');
                    var showOnHomepage = p.show_on_homepage === true;
                    var catKey = (p.category != null && p.category !== '') ? String(p.category) : ((p.analysis_json && p.analysis_json.category) != null ? String(p.analysis_json.category) : '');
                    var subKey = (p.subcategory_key != null && p.subcategory_key !== '') ? String(p.subcategory_key) : ((p.analysis_json && p.analysis_json.subcategory_key) != null ? String(p.analysis_json.subcategory_key) : '');
                    var refSourcesJson = (p.reference_sources && Array.isArray(p.reference_sources) && p.reference_sources.length) ? JSON.stringify(p.reference_sources) : '';
                    var $cell = $('<div class="past-item-wrap"></div>').attr({
                        'data-image-url': url,
                        'data-prompt': promptText,
                        'data-seed': seedStr,
                        'data-owner-display': ownerDisplay,
                        'data-product-id': p.id || '',
                        'data-show-on-homepage': showOnHomepage ? '1' : '0',
                        'data-category-key': catKey,
                        'data-subcategory-key': subKey,
                        'data-reference-sources': refSourcesJson
                    });
                    $cell.append($('<a class="past-item" href="#" role="button" title="' + tip + '"><img src="' + url + '" alt=""></a>'));
                    var caption = (promptText ? promptText.substring(0, 120) : '（無提示詞）') + (seedStr ? ' · Seed: ' + seedStr : '');
                    $cell.append($('<p class="past-item-caption text-muted small mb-0" title="' + tip + '">').text(caption));
                    grid.append($cell);
                });
                if (sessionThumbs.length === 0 && (!products || products.length === 0)) {
                    grid.append($('<p class="text-muted small mb-0">').text(t('customProduct.noHistoryYet')));
                    grid.append($('<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>').text(t('customProduct.reload')));
                }
                $('#generatedImagePlaceholder').hide();
                try {
                    if (products && products.length > 0) {
                        var toCache = products.slice(0, 30).map(function (p) {
                            return { id: p.id, ai_generated_image_url: p.ai_generated_image_url, reference_image_url: p.reference_image_url, generation_prompt: p.generation_prompt, generation_seed: p.generation_seed, title: p.title, owner_display: p.owner_display, owner_email: p.owner_email, show_on_homepage: p.show_on_homepage, category: p.category, subcategory_key: p.subcategory_key, analysis_json: p.analysis_json, reference_sources: p.reference_sources };
                        });
                        sessionStorage.setItem('customProductGalleryCache', JSON.stringify({ products: toCache, ownerDisplay: galleryOwnerDisplay, ts: Date.now() }));
                    }
                } catch (e) {}
            }

            var headers = { 'Authorization': 'Bearer ' + token };
            // 第一階段：只問有沒有資料（輕量，不帶圖）
            fetch('/api/custom-products?summary=1', { headers: headers })
                .then(function (res) { return res.text().then(function (text) { return { ok: res.ok, status: res.status, text: text }; }); })
                .then(function (r) {
                    if (!r.ok && r.status === 401) {
                        wrap.html('<p class="past-gallery-title">' + getGalleryTitle() + '</p><div class="past-gallery-inner"><p class="text-muted small mb-0">請重新登入後查看歷史生成的圖</p></div>');
                        $('#generatedImagePlaceholder').hide();
                        return;
                    }
                    var data = {};
                    try {
                        data = (r.text && r.text.trim() && r.text.trim().startsWith('{')) ? JSON.parse(r.text) : {};
                    } catch (e) {
                        renderEmpty();
                        return;
                    }
                    var hasItems = (data.hasItems === true) || (Array.isArray(data.products) && data.products.length > 0);
                    var dbCount = (data.count != null && !isNaN(data.count)) ? Number(data.count) : (Array.isArray(data.products) ? data.products.length : 0);
                    if (!hasItems && sessionThumbs.length === 0) {
                        renderEmpty(dbCount);
                        return;
                    }
                    // 第二階段：有資料才抓完整列表（含圖）
                    fetch('/api/custom-products', { headers: headers })
                        .then(function (res) { return res.text().then(function (text) { return { ok: res.ok, text: text }; }); })
                        .then(function (r2) {
                            var list = [];
                            try {
                                var d = (r2.text && r2.text.trim() && r2.text.trim().startsWith('{')) ? JSON.parse(r2.text) : {};
                                list = Array.isArray(d.products) ? d.products : [];
                            } catch (e) {}
                            if (list.length > 0 && list[0].owner_display) {
                                galleryOwnerDisplay = String(list[0].owner_display).trim();
                            }
                            var products = list.filter(function (p) { return p && p.ai_generated_image_url; });
                            renderGallery(products);
                        })
                        .catch(function (err) {
                            console.warn('refreshPastGeneratedGallery full fetch:', err);
                            if (sessionThumbs.length > 0) {
                                renderGallery([]);
                            } else {
                                renderEmpty();
                            }
                        });
                })
                .catch(function (err) {
                    console.warn('refreshPastGeneratedGallery summary fetch:', err);
                    renderLoadError();
                });
        }
        if (optionalToken != null && optionalToken !== '') {
            doFetch(optionalToken);
        } else {
            getAuthToken(doFetch);
        }
    }

    // 點擊「重新載入」時再抓一次歷史
    $(document).on('click', '.js-reload-history', function () {
        var wrap = $('#pastGeneratedGallery');
        if (wrap.length) wrap.find('.past-gallery-inner').html('<p class="text-muted small mb-0"><i class="fas fa-spinner fa-spin me-1"></i>載入中…</p>');
        refreshPastGeneratedGallery();
    });

    $(document).on('click', '.js-preview-enlarge', function (e) {
        e.preventDefault();
        var url = $(this).attr('src');
        if (!url) return;
        if (window.MatchdoImageLightbox) {
            window.MatchdoImageLightbox.open({ src: url, caption: t('customProduct.thisGeneration') || '' });
            return;
        }
    });

    // 點擊預覽區的生成圖：開同一 modal 放大顯示（與數位資產一致）
    $(document).on('click', '#generatedImagePreview img', function (e) {
        e.preventDefault();
        var url = $(this).attr('src');
        if (!url) return;
        var prompt = (typeof lastGeneratedPrompt !== 'undefined') ? lastGeneratedPrompt : '';
        var seed = (typeof lastGeneratedSeed !== 'undefined' && lastGeneratedSeed != null && lastGeneratedSeed !== '') ? String(lastGeneratedSeed) : '';
        var ck = ($('#imageCategoryMainSelect').val() || '').trim();
        var sk = ($('#imageCategorySubSelect').val() || '').trim();
        $('#pastItemModal').data('redesignCategoryKey', ck).data('redesignSubcategoryKey', sk);
        if (window.i18n && typeof window.i18n.applyPage === 'function') window.i18n.applyPage();
        $('#pastItemModalLabel').text(prompt ? (prompt.length > 50 ? prompt.substring(0, 50) + '…' : prompt) : t('customProduct.pastItemModalTitle'));
        var inner = document.getElementById('pastItemModalBodyInner');
        if (inner) inner.innerHTML = '<img src="' + String(url).replace(/"/g, '&quot;') + '" alt="">';
        $('#pastItemModalPrompt').text(prompt || '（無）');
        $('#pastItemModalSeed').text(seed || '（無）');
        $('#pastItemModalOwner').text(t('customProduct.thisGeneration'));
        applyPastItemModalRefSources(getActiveRefSourcesList());
        $('#pastItemModalShowSection').addClass('d-none');
        var q = [];
        if (ck) q.push('category_key=' + encodeURIComponent(ck));
        if (sk) q.push('subcategory_key=' + encodeURIComponent(sk));
        var galleryUrl = '/custom/gallery.html' + (q.length ? '?' + q.join('&') : '');
        var linkEl = document.getElementById('pastItemModalLink');
        if (linkEl) { linkEl.href = galleryUrl; linkEl.classList.remove('d-none'); }
        var modalEl = document.getElementById('pastItemModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) (new bootstrap.Modal(modalEl)).show();
    });

    // 點擊歷史縮圖：與首頁一致 — 大圖、底部疊加提示詞/SEED/帳號、前往連結+關閉
    $(document).on('click', '.past-item', function (e) {
        e.preventDefault();
        var wrap = $(this).closest('.past-item-wrap');
        if (!wrap.length) return;
        var url = wrap.attr('data-image-url');
        var prompt = wrap.attr('data-prompt') || '';
        var seed = wrap.attr('data-seed') || '';
        var ownerDisplay = wrap.attr('data-owner-display') || '';
        var productId = wrap.attr('data-product-id') || '';
        var showOnHomepage = wrap.attr('data-show-on-homepage') === '1';
        $('#pastItemModal').data('redesignCategoryKey', wrap.attr('data-category-key') || '').data('redesignSubcategoryKey', wrap.attr('data-subcategory-key') || '');
        if (window.i18n && typeof window.i18n.applyPage === 'function') window.i18n.applyPage();
        $('#pastItemModalLabel').text(prompt ? (prompt.length > 50 ? prompt.substring(0, 50) + '…' : prompt) : t('customProduct.pastItemModalTitle'));
        var inner = document.getElementById('pastItemModalBodyInner');
        if (inner) {
            inner.innerHTML = url ? '<img src="' + (url.replace(/"/g, '&quot;')) + '" alt="">' : '<p class="text-muted py-4 mb-0">' + t('home.noImage') + '</p>';
        }
        $('#pastItemModalPrompt').text(prompt || '（無）');
        $('#pastItemModalSeed').text(seed || '（無）');
        $('#pastItemModalOwner').text(ownerDisplay || ('（' + t('customProduct.thisGeneration') + '）'));
        var refSourcesRaw = wrap.attr('data-reference-sources') || '';
        var refSourcesList = [];
        try { if (refSourcesRaw) refSourcesList = JSON.parse(refSourcesRaw); } catch (e) {}
        applyPastItemModalRefSources(Array.isArray(refSourcesList) ? refSourcesList : []);
        var $showSection = $('#pastItemModalShowSection');
        var $checkbox = $('#pastItemModalShowOnHomepage');
        var catKey = (wrap.attr('data-category-key') || '').trim();
        var subKey = (wrap.attr('data-subcategory-key') || '').trim();
        var q = [];
        if (catKey) q.push('category_key=' + encodeURIComponent(catKey));
        if (subKey) q.push('subcategory_key=' + encodeURIComponent(subKey));
        var galleryUrl = '/custom/gallery.html' + (q.length ? '?' + q.join('&') : '');
        var linkEl = document.getElementById('pastItemModalLink');
        if (linkEl) {
            linkEl.href = galleryUrl;
            linkEl.classList.remove('d-none');
        }
        if (productId) {
            $showSection.removeClass('d-none');
            $checkbox.prop('checked', true).prop('disabled', true).data('product-id', productId).data('source-wrap', wrap);
            $('#pastItemModalShowOnHomepageHint').text(t('customProduct.freeUserShowHint')).css('color', '');
        } else {
            $showSection.addClass('d-none');
            $checkbox.removeData('product-id').removeData('source-wrap');
        }
        var modalEl = document.getElementById('pastItemModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            (new bootstrap.Modal(modalEl)).show();
        }
    });

    // 「找廠商訂製」：先送追蹤再開新分頁（原連結為 target="_blank"）
    $(document).on('click', '#pastItemModalLink', function (e) {
        var href = $(this).attr('href');
        if (href && href !== '#') {
            e.preventDefault();
            trackDesignAction('find_vendor');
            window.open(href, '_blank', 'noopener');
        }
    });

    // 「再設計」：帶當前圖與原圖分類到設計頁並設為第一張參考圖、預設分類（可改）
    $(document).on('click', '#pastItemModalRedesign', function () {
        var img = $('#pastItemModalBodyInner img').attr('src');
        if (img) {
            try {
                sessionStorage.setItem('redesignImageUrl', img);
                var ck = ($('#pastItemModal').data('redesignCategoryKey') || '').trim();
                var sk = ($('#pastItemModal').data('redesignSubcategoryKey') || '').trim();
                sessionStorage.setItem('redesignCategoryKey', ck);
                sessionStorage.setItem('redesignSubcategoryKey', sk);
            } catch (e) {}
            window.location.href = '/custom-product.html';
        }
    });

    // 「實境模擬」：帶當前圖到實境模擬 Tab 的圖片預覽格
    $(document).on('click', '#pastItemModalSceneSim', function () {
        var img = $('#pastItemModalBodyInner img').attr('src');
        if (img) {
            try { sessionStorage.setItem('sceneSimImageUrl', img); } catch (e) {}
            window.location.href = '/custom-product.html?tab=scene-sim';
        }
    });

    // 「展示在首頁」勾選變更時呼叫 PATCH 更新
    $(document).on('change', '#pastItemModalShowOnHomepage', function () {
        var productId = $(this).data('product-id');
        var wrap = $(this).data('source-wrap');
        if (!productId || !wrap || !wrap.length) return;
        var checked = $(this).prop('checked');
        getAuthToken(function (token) {
            if (!token) return;
            var url = '/api/custom-products/' + productId + '?show_on_homepage=' + (checked ? 'true' : 'false');
            fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ show_on_homepage: checked })
            }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); }).then(function (res) {
                if (res.ok) {
                    wrap.attr('data-show-on-homepage', checked ? '1' : '0');
                    $('#pastItemModalShowOnHomepageHint').text(checked ? '已設定為展示在首頁' : '已取消展示在首頁').css('color', 'var(--bs-success)');
                } else {
                    var errMsg = (res.data && res.data.error) ? res.data.error : '更新失敗';
                    if (res.status === 503) errMsg = res.data && res.data.error ? res.data.error : errMsg;
                    $('#pastItemModalShowOnHomepageHint').text(errMsg).css('color', 'var(--bs-danger)');
                }
            }).catch(function () {
                $('#pastItemModalShowOnHomepageHint').text('網路錯誤').css('color', 'var(--bs-danger)');
            });
        });
    });

    // 有結果時：把本次生成的圖新增為縮圖（可點擊放大），插在歷史區最前面；與歷史列表一致，點擊開 modal 顯示大圖+提示詞/SEED/帳號
    function addGeneratedThumbnailToGallery(imageDataUrl, prompt, seed) {
        try {
            if (!imageDataUrl) return;
            var wrap = $('#pastGeneratedGallery');
            if (!wrap.length) return;
            var url = String(imageDataUrl).replace(/"/g, '&quot;');
            var promptStr = (prompt != null && String(prompt).trim()) ? String(prompt).trim() : '';
            var seedStr = (seed != null && seed !== '') ? String(seed) : '';
            var tip = (promptStr ? promptStr.replace(/"/g, '&quot;').replace(/</g, '&lt;').substring(0, 200) : '') || '本次生成（點擊放大）';
            if (seedStr) tip += ' · Seed: ' + seedStr;
            var ck = ($('#imageCategoryMainSelect').val() || '').trim();
            var sk = ($('#imageCategorySubSelect').val() || '').trim();
            var refSourcesJson = '';
            try {
                var rs = getActiveRefSourcesList();
                if (rs.length) refSourcesJson = JSON.stringify(rs);
            } catch (e) {}
            var $cell = $('<div class="past-item-wrap"></div>').attr({
                'data-image-url': url,
                'data-prompt': promptStr,
                'data-seed': seedStr,
                'data-owner-display': '',
                'data-category-key': ck,
                'data-subcategory-key': sk,
                'data-reference-sources': refSourcesJson
            });
            $cell.append($('<a class="past-item" href="#" role="button" title="' + tip + '"><img src="' + url + '" alt=""></a>'));
            var caption = (promptStr ? promptStr.substring(0, 120) : t('customProduct.thisGeneration')) + (seedStr ? ' · Seed: ' + seedStr : '');
            $cell.append($('<p class="past-item-caption text-muted small mb-0">').text(caption));
            var inner = wrap.find('.past-gallery-inner');
            if (!inner.length) {
                wrap.html('<p class="past-gallery-title">' + ((ownerDisplay && ownerDisplay.trim()) ? ownerDisplay.trim() : t('customProduct.thisAccount')) + t('customProduct.digitalAssetsSuffix') + '</p><div class="past-gallery-inner"></div>');
                inner = wrap.find('.past-gallery-inner');
            }
            inner.find('p.text-muted').remove();
            inner.prepend($cell);
            $('#generatedImagePlaceholder').hide();
        } catch (err) {
            console.warn('addGeneratedThumbnailToGallery:', err);
        }
    }

    // 從 sessionStorage 快取渲染縮圖（切回頁面時先顯示，再背景更新）
    var GALLERY_CACHE_KEY = 'customProductGalleryCache';
    var GALLERY_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
    function renderGalleryFromCache(wrap, cached) {
        if (!wrap || !wrap.length || !cached || !cached.products) return;
        var products = cached.products;
        var ownerDisplay = (cached.ownerDisplay && String(cached.ownerDisplay).trim()) ? String(cached.ownerDisplay).trim() : '';
        var title = (ownerDisplay || t('customProduct.thisAccount')) + t('customProduct.digitalAssetsSuffix');
        wrap.html('<p class="past-gallery-title">' + title + '</p><div class="past-gallery-inner"></div>');
        var grid = wrap.find('.past-gallery-inner');
        (products || []).forEach(function (p) {
            var url = String(p.ai_generated_image_url || p.reference_image_url || '').replace(/"/g, '&quot;');
            var promptText = String((p.analysis_json && p.analysis_json.generation_prompt) || p.generation_prompt || p.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            var seedStr = (p.analysis_json && p.analysis_json.generation_seed != null) ? String(p.analysis_json.generation_seed) : (p.generation_seed != null ? String(p.generation_seed) : '');
            var ownerD = (p.owner_display != null && String(p.owner_display).trim()) ? String(p.owner_display).trim() : (p.owner_email || '');
            var tip = promptText.substring(0, 120) + (seedStr ? ' · Seed: ' + seedStr : '');
            var showOnHomepage = p.show_on_homepage === true;
            var catKey = (p.category != null && p.category !== '') ? String(p.category) : ((p.analysis_json && p.analysis_json.category) != null ? String(p.analysis_json.category) : '');
            var subKey = (p.subcategory_key != null && p.subcategory_key !== '') ? String(p.subcategory_key) : ((p.analysis_json && p.analysis_json.subcategory_key) != null ? String(p.analysis_json.subcategory_key) : '');
            var refSourcesJson = (p.reference_sources && Array.isArray(p.reference_sources) && p.reference_sources.length) ? JSON.stringify(p.reference_sources) : '';
            var $cell = $('<div class="past-item-wrap"></div>').attr({
                'data-image-url': url,
                'data-prompt': promptText,
                'data-seed': seedStr,
                'data-owner-display': ownerD,
                'data-product-id': p.id || '',
                'data-show-on-homepage': showOnHomepage ? '1' : '0',
                'data-category-key': catKey,
                'data-subcategory-key': subKey,
                'data-reference-sources': refSourcesJson
            });
            $cell.append($('<a class="past-item" href="#" role="button" title="' + tip + '"><img src="' + url + '" alt=""></a>'));
            var caption = (promptText ? promptText.substring(0, 120) : '（無提示詞）') + (seedStr ? ' · Seed: ' + seedStr : '');
            $cell.append($('<p class="past-item-caption text-muted small mb-0" title="' + tip + '">').text(caption));
            grid.append($cell);
        });
        if (products.length === 0) {
            grid.append($('<p class="text-muted small mb-0">').text(t('customProduct.noHistoryYet')));
            grid.append($('<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-spinner fa-spin me-1"></i>').text(t('customProduct.reload')));
        }
        $('#generatedImagePlaceholder').hide();
    }

    // 有 token 才載入歷史（token 可來自 Auth 回調的 session.access_token，避免搶跑）
    function tryLoadHistoryWhenAuthReady(optionalToken) {
        function run(token) {
            if (!token) {
                $('#pastGeneratedGallery').html(
                    '<p class="past-gallery-title">' + t('customProduct.thisAccount') + t('customProduct.digitalAssetsSuffix') + '</p><div class="past-gallery-inner">' +
                    '<p class="text-muted small mb-0">' + t('customProduct.loginToViewHistory') + '</p>' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>' + t('customProduct.reload') + '</button></div>'
                );
                $('#generatedImagePlaceholder').hide();
                return;
            }
            var wrap = $('#pastGeneratedGallery');
            var cached = null;
            try {
                var raw = sessionStorage.getItem(GALLERY_CACHE_KEY);
                if (raw) {
                    var parsed = JSON.parse(raw);
                    if (parsed && parsed.ts && (Date.now() - parsed.ts) < GALLERY_CACHE_MAX_AGE_MS) cached = parsed;
                }
            } catch (e) {}
            if (cached) {
                renderGalleryFromCache(wrap, cached);
            } else {
                wrap.html('<p class="past-gallery-title">' + t('customProduct.thisAccount') + t('customProduct.digitalAssetsSuffix') + '</p><div class="past-gallery-inner"><p class="text-muted small mb-0"><i class="fas fa-spinner fa-spin me-1"></i>' + t('home.loading') + '</p></div>');
            }
            $('#generatedImagePlaceholder').hide();
            refreshPastGeneratedGallery(token);
        }
        if (optionalToken) {
            run(optionalToken);
        } else {
            getAuthToken(run);
        }
    }

    // 先顯示載入中，等 Auth 有 session 再抓歷史
    $('#pastGeneratedGallery').html('<p class="past-gallery-title">' + t('customProduct.thisAccount') + t('customProduct.digitalAssetsSuffix') + '</p><div class="past-gallery-inner"><p class="text-muted small mb-0"><i class="fas fa-spinner fa-spin me-1"></i>' + t('home.loading') + '</p></div>');
    $('#generatedImagePlaceholder').hide();

    // 避免切換視窗時重複載入：Supabase 在分頁重新可見時會觸發 TOKEN_REFRESHED / 有時 INITIAL_SESSION，不要因此清空並重抓歷史
    var historyLoadedOnce = false;
    var supabaseAuth = (window.__supabaseClient || window.supabaseClient || {}).auth;
    if (supabaseAuth && typeof supabaseAuth.onAuthStateChange === 'function') {
        supabaseAuth.onAuthStateChange(function (event, session) {
            if (event === 'TOKEN_REFRESHED') return; // 切回分頁時只刷新 token，不重載歷史
            if (event === 'INITIAL_SESSION' && historyLoadedOnce) return; // 已載入過則不再因 INITIAL_SESSION 重跑
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                historyLoadedOnce = true;
                if (session && session.access_token) {
                    tryLoadHistoryWhenAuthReady(session.access_token);
                } else {
                    tryLoadHistoryWhenAuthReady();
                }
            }
        });
    }
    getAuthToken(function (token) {
        if (token) {
            historyLoadedOnce = true;
            tryLoadHistoryWhenAuthReady(token);
        }
    });

    // ----- 實境模擬 Tab -----
    function setSceneSimPreview(url) {
        var $img = $('#sceneSimPreviewImg');
        var $hint = $('#sceneSimPreviewWrap .scene-sim-preview-hint');
        if (!url || !url.trim()) {
            $img.addClass('d-none').attr('src', '');
            $hint.removeClass('d-none');
            return;
        }
        $img.attr('src', url).removeClass('d-none');
        $hint.addClass('d-none');
    }
    function getSceneSimPreviewUrl() {
        var src = $('#sceneSimPreviewImg').attr('src');
        return (src && src.trim()) ? src.trim() : '';
    }
    // 動態網址：?tab=product-design | scene-sim | pattern-extract
    function getTabParamFromButtonId(buttonId) {
        if (buttonId === 'tab-product-design') return 'product-design';
        if (buttonId === 'tab-vendor-styles') return 'vendor-styles';
        if (buttonId === 'tab-scene-sim') return 'scene-sim';
        if (buttonId === 'tab-pattern-extract') return 'pattern-extract';
        return 'product-design';
    }
    function getTabButtonIdFromParam(param) {
        if (param === 'vendor-styles') return 'tab-vendor-styles';
        if (param === 'scene-sim') return 'tab-scene-sim';
        if (param === 'pattern-extract') return 'tab-pattern-extract';
        return 'tab-product-design';
    }
    function applyTabFromUrl() {
        var params = new URLSearchParams(window.location.search);
        var tabParam = params.get('tab') || 'product-design';
        if (tabParam !== 'product-design' && tabParam !== 'vendor-styles' && tabParam !== 'scene-sim' && tabParam !== 'pattern-extract') tabParam = 'product-design';
        var tabId = getTabButtonIdFromParam(tabParam);
        var tabEl = document.getElementById(tabId);
        if (tabEl && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
            var tab = new bootstrap.Tab(tabEl);
            tab.show();
        }
        if (tabParam === 'vendor-styles' && typeof loadVendorStylesTabList === 'function') {
            setTimeout(loadVendorStylesTabList, 50);
        }
    }
    function updateUrlForTab(tabParam) {
        var base = window.location.pathname || '/custom-product.html';
        var params = new URLSearchParams(window.location.search);
        if (tabParam === 'product-design') params.delete('tab');
        else params.set('tab', tabParam);
        var q = params.toString();
        var url = q ? base + '?' + q : base;
        if (window.history && window.history.replaceState) {
            window.history.replaceState({ tab: tabParam }, '', url);
        }
    }
    // 初次載入：依 URL 切換 Tab
    applyTabFromUrl();
    // 切換 Tab 時更新網址
    $('#designTabs').on('shown.bs.tab', function (e) {
        var targetId = (e.target && e.target.id) ? e.target.id : '';
        var tabParam = getTabParamFromButtonId(targetId);
        updateUrlForTab(tabParam);
        if (window.history && window.history.pushState) {
            window.history.pushState({ tab: tabParam }, '', window.location.pathname + window.location.search);
        }
        if (tabParam === 'pattern-extract' && typeof updatePatternExtractResolutionDisplay === 'function') {
            updatePatternExtractResolutionDisplay();
        }
        if (tabParam === 'vendor-styles') {
            vendorStylesTabOffset = 0;
            loadVendorStylesTabList();
        }
    });
    // 瀏覽器前進/後退時依網址切換 Tab
    $(window).on('popstate', function () {
        applyTabFromUrl();
    });
    // 從首頁/數位資產點「實境模擬」進來：切到 Tab 並帶入圖片（保留原有邏輯，在 applyTabFromUrl 之後執行）
    (function () {
        var params = new URLSearchParams(window.location.search);
        if (params.get('tab') !== 'scene-sim') return;
        var url = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sceneSimImageUrl') : null;
        if (url) {
            try { sessionStorage.removeItem('sceneSimImageUrl'); } catch (e) {}
            var tabEl = document.getElementById('tab-scene-sim');
            if (tabEl && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                var tab = new bootstrap.Tab(tabEl);
                tab.show();
            }
            setSceneSimPreview(url);
        }
    })();
    // 實境模擬：圖片上傳
    // 環境／人物圖：顯示在左欄並儲存 data URL
    window.sceneSimEnvImageDataUrl = null;
    function setSceneSimUploadPreview(dataUrl) {
        if (!dataUrl || !dataUrl.trim()) {
            window.sceneSimEnvImageDataUrl = null;
            $('#sceneSimUploadImg').addClass('d-none').attr('src', '');
            $('#sceneSimUploadZone').removeClass('has-image');
            return;
        }
        window.sceneSimEnvImageDataUrl = dataUrl;
        $('#sceneSimUploadImg').attr('src', dataUrl).removeClass('d-none');
        $('#sceneSimUploadZone').addClass('has-image');
    }
    $(document).on('click', '#sceneSimUploadZone', function (e) {
        if ($(e.target).closest('.scene-sim-upload-label').length) return;
        var input = document.getElementById('sceneSimFile');
        if (input) input.click();
    });
    $('#sceneSimFile').on('change', function () {
        var file = this.files && this.files[0];
        if (!file || !file.type.match(/^image\//)) return;
        var reader = new FileReader();
        reader.onload = function (e) { setSceneSimUploadPreview(e.target.result); };
        reader.readAsDataURL(file);
        this.value = '';
    });
    $('#sceneSimUploadZone').on('dragover', function (e) { e.preventDefault(); e.stopPropagation(); $(this).css('border-color', '#445D7E'); });
    $('#sceneSimUploadZone').on('dragleave', function (e) { e.preventDefault(); $(this).css('border-color', ''); });
    $('#sceneSimUploadZone').on('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).css('border-color', '');
        var file = e.originalEvent && e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files && e.originalEvent.dataTransfer.files[0];
        if (!file || !file.type.match(/^image\//)) return;
        var reader = new FileReader();
        reader.onload = function (ev) { setSceneSimUploadPreview(ev.target.result); };
        reader.readAsDataURL(file);
    });
    function openAssetPickerModal(context) {
        window.assetPickerContext = context || 'sceneSim';
        if (window.i18n && typeof window.i18n.applyPage === 'function') window.i18n.applyPage();
        $('#sceneSimAssetPickerModal').modal('show');
        var $list = $('#sceneSimAssetList');
        var $empty = $('#sceneSimAssetEmpty');
        var $loading = $('#sceneSimAssetLoading');
        $list.empty();
        $empty.addClass('d-none');
        $loading.removeClass('d-none');
        getAuthToken(function (token) {
            if (!token) {
                $loading.addClass('d-none');
                $empty.removeClass('d-none').text(t('customProduct.loginToSelectAssets'));
                return;
            }
            fetch('/api/custom-products', { headers: { 'Authorization': 'Bearer ' + token } })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    $loading.addClass('d-none');
                    var products = (data && data.products) ? data.products : [];
                    if (products.length === 0) {
                        $empty.removeClass('d-none').text(t('customProduct.noDigitalAssetsHint'));
                        return;
                    }
                    $empty.addClass('d-none');
                    products.forEach(function (p) {
                        var url = (p.ai_generated_image_url || p.image_url || '').trim();
                        if (!url) return;
                        var title = (p.title || p.generation_prompt || '').toString().substring(0, 40);
                        var $col = $('<div class="col-6 col-md-4 col-lg-3"></div>');
                        var $card = $('<div class="card border scene-sim-asset-item" style="cursor:pointer;"></div>').attr('data-image-url', url);
                        var $img = $('<img class="card-img-top scene-sim-asset-img" style="height:120px;object-fit:cover;cursor:zoom-in;">').attr('src', url).attr('alt', title).attr('title', t('customProduct.zoomImage') || '點擊放大');
                        $card.append($img);
                        $card.append($('<div class="card-body py-1"><p class="small text-muted mb-0 text-truncate">').text(title || t('customProduct.noTitle')));
                        $col.append($card);
                        $list.append($col);
                    });
                    $list.find('.scene-sim-asset-img').on('dblclick', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var u = $(this).attr('src');
                        if (u) openImageLightbox(u, $(this).attr('alt') || '');
                    });
                    $list.find('.scene-sim-asset-item').on('click', function (e) {
                        if (e.detail > 1) return;
                        var u = $(this).attr('data-image-url');
                        if (u) {
                            if (window.assetPickerContext === 'patternExtract') setPatternExtractPreview(u);
                            else setSceneSimPreview(u);
                        }
                        $('#sceneSimAssetPickerModal').modal('hide');
                    });
                })
                .catch(function () {
                    $loading.addClass('d-none');
                    $empty.removeClass('d-none').text(t('customProduct.loadFailed'));
                });
        });
    }
    $('#sceneSimPreviewWrap').on('click', function (e) {
        if ($(e.target).closest('.scene-sim-preview-img').length) return;
        openAssetPickerModal('sceneSim');
    });
    $('#patternExtractPreviewWrap').on('click', function (e) {
        if ($(e.target).closest('.scene-sim-preview-img').length) return;
        openAssetPickerModal('patternExtract');
    });
    // 實境模擬結果：只顯示圖＋下載按鈕，不存入數位資產
    function renderSceneSimResult(imageDataUrl) {
        if (!imageDataUrl) return;
        var wrap = $('#sceneSimResultWrap');
        var noteText = t('customProduct.sceneSimResultNote');
        var note = '<p class="scene-sim-result-note text-muted small mt-2 mb-0">' + noteText + '</p>';
        var resultLabel = t('customProduct.sceneSimResult');
        var $inner = $('<div class="scene-sim-result-inner"></div>');
        $inner.append($('<img>').attr('src', imageDataUrl).attr('alt', resultLabel).addClass('img-fluid rounded').css('maxWidth', '100%'));
        var $btn = $('<a href="#" class="btn btn-sm btn-outline-primary mt-2"><i class="fas fa-download me-1"></i>下載圖片</a>');
        $btn.on('click', function (e) {
            e.preventDefault();
            try {
                var dataUrl = (imageDataUrl || '');
                var mimeMatch = dataUrl.match(/^data:image\/(jpeg|jpg|png);base64,/i);
                var ext = (mimeMatch && mimeMatch[1]) ? (mimeMatch[1].toLowerCase() === 'png' ? 'png' : 'jpg') : 'jpg';
                var mime = ext === 'png' ? 'image/png' : 'image/jpeg';
                var base64 = dataUrl.split(',')[1];
                if (!base64) return;
                var bin = atob(base64);
                var arr = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                var blob = new Blob([arr], { type: mime });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = resultLabel + '.' + ext;
                a.click();
                URL.revokeObjectURL(url);
            } catch (err) { console.warn(err); }
        });
        $inner.append($btn).append(note);
        wrap.html('').append($inner);
    }

    // 「套用至實境」：呼叫 API 生圖，結果用 renderSceneSimResult 顯示
    $('#sceneSimApplyBtn').on('click', function () {
        var envUrl = window.sceneSimEnvImageDataUrl || '';
        var productUrl = getSceneSimPreviewUrl();
        if (!envUrl) {
            alert('請上傳環境或人物圖片（左欄）');
            return;
        }
        if (!productUrl) {
            alert('請選擇產品圖片（右欄，可點擊從數位資產選擇）');
            return;
        }
        var $btn = $('#sceneSimApplyBtn');
        var $wrap = $('#sceneSimResultWrap');
        var prompt = ($('#sceneSimPrompt').val() || '').trim();
        $btn.prop('disabled', true);
        $wrap.html('<p class="text-muted small mb-0">' + t('home.loading') + '</p><p class="scene-sim-result-note text-muted small mt-2 mb-0">' + t('customProduct.sceneSimResultNote') + '</p>');
        var headers = { 'Content-Type': 'application/json' };
        Promise.resolve().then(function () {
            if (typeof window.AuthService !== 'undefined' && typeof window.AuthService.getSession === 'function') {
                return window.AuthService.getSession();
            }
            return null;
        }).then(function (session) {
            if (session && session.access_token) headers['Authorization'] = 'Bearer ' + session.access_token;
            return fetch('/api/scene-simulate', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    environmentImage: envUrl,
                    productImage: productUrl,
                    prompt: prompt
                })
            });
        }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (result) {
                $btn.prop('disabled', false);
                var data = result.data;
                var noteHtml = '<p class="scene-sim-result-note text-muted small mt-2 mb-0">' + t('customProduct.sceneSimResultNote') + '</p>';
                if (result.status === 401) {
                    $wrap.html('<p class="text-warning small mb-0">' + (t('customProduct.loginToSelectAssets') || '請先登入') + '</p>' + noteHtml);
                    return;
                }
                if (result.status === 402) {
                    $wrap.html('<p class="text-danger small mb-0">' + (data.error || ('點數不足（需要 ' + (data.required || 20) + ' 點，目前餘額 ' + (data.balance != null ? data.balance : 0) + ' 點）')) + '</p>' + noteHtml);
                    return;
                }
                if (data.success && data.imageData) {
                    renderSceneSimResult(data.imageData);
                } else {
                    $wrap.html('<p class="text-danger small mb-0">' + (data.error || t('customProduct.loadFailed')) + '</p>' + noteHtml);
                }
            })
            .catch(function (err) {
                $btn.prop('disabled', false);
                $wrap.html('<p class="text-danger small mb-0">' + t('customProduct.loadFailed') + '</p><p class="scene-sim-result-note text-muted small mt-2 mb-0">' + t('customProduct.sceneSimResultNote') + '</p>');
                console.warn('scene-simulate:', err);
            });
    });

    // ----- 圖樣提取 Tab（單張圖上傳、選填提示詞、可選無縫拼接、Size Mode） -----
    window.patternExtractImageDataUrl = null;
    window.patternExtractImageDimensions = { w: 1024, h: 1024 };
    // 各比例預設解析度均為 1 MP 總像素（1,048,576），與 1:1 同為 20 點
    var PATTERN_EXTRACT_ASPECT_MAP = {
        '1:1': [1024, 1024],   // 1024*1024 = 1,048,576
        '16:9': [1368, 768],   // 1368*768 = 1,050,624 ≈ 1 MP
        '9:16': [768, 1368],   // 768*1368 = 1,050,624 ≈ 1 MP
        '4:3': [1184, 888],    // 1184*888 = 1,051,392 ≈ 1 MP
        '3:4': [888, 1184]     // 888*1184 = 1,051,392 ≈ 1 MP
    };
    /** 圖樣提取點數（與後端一致）：依總解析度（寬×高）總像素計算，不依長寬比。1 MP = 1024×1024 像素，總像素無條件進位，上限 4 MP；1 MP=20 點，每多 1 MP +10 點 */
    function patternExtractPointsFromResolution(w, h) {
        var oneMp = 1024 * 1024;
        var totalPixels = w * h;  // 總解析度
        var mp = Math.min(4, Math.ceil(totalPixels / oneMp) || 1);
        return 20 + (mp - 1) * 10;
    }
    function clampResolution(v) {
        var n = parseInt(v, 10);
        if (isNaN(n)) return 1024;
        var step = 8;
        var rounded = Math.round(n / step) * step;
        return Math.min(2048, Math.max(512, rounded));
    }
    function initPatternExtractPointsPopover() {
        var el = document.getElementById('patternExtractPointsHelp');
        if (!el || typeof bootstrap === 'undefined' || !bootstrap.Popover) return;
        var title = t('customProduct.patternExtractPointsHelpLabel') || '點數計價說明';
        var content = t('customProduct.patternExtractPointsTooltip') || '依總解析度（寬×高）計價：1 MP＝20 點，每多 1 MP ＋10 點（無條件進位，上限 4 MP）';
        var existing = bootstrap.Popover.getInstance(el);
        if (existing) existing.dispose();
        new bootstrap.Popover(el, {
            title: title,
            content: content,
            trigger: 'click',
            placement: 'top',
            container: 'body'
        });
    }
    function updatePatternExtractResolutionDisplay() {
        var mode = $('#patternExtractSizeMode').val();
        var hasImage = !!window.patternExtractImageDataUrl;
        if (mode === 'same' && !hasImage) {
            $('#patternExtractResolutionDisplay').text('—').attr('title', t('customProduct.patternExtractResolutionHint'));
            var defaultPts = 20;
            var fromLabel = t('customProduct.patternExtractPointsFrom') || '20 點起，依匯出解析度而定';
            var ptsLabel = (t('customProduct.patternExtractPointsAbout') || '約 {n} 點').replace('{n}', defaultPts);
            $('#patternExtractPointsDisplay').text(fromLabel + ' · ' + ptsLabel).attr('title', fromLabel);
            initPatternExtractPointsPopover();
            return;
        }
        var dims = getPatternExtractWidthHeight();
        $('#patternExtractResolutionDisplay').text(dims.w + '×' + dims.h).attr('title', t('customProduct.currentResolution'));
        var pts = patternExtractPointsFromResolution(dims.w, dims.h);
        var fromLabel = t('customProduct.patternExtractPointsFrom') || '20 點起，依匯出解析度而定';
        var ptsLabel = (t('customProduct.patternExtractPointsAbout') || '約 {n} 點').replace('{n}', pts);
        $('#patternExtractPointsDisplay').text(fromLabel + ' · ' + ptsLabel).attr('title', t('customProduct.patternExtractPointsTooltip') || '');
        initPatternExtractPointsPopover();
    }
    function getPatternExtractWidthHeight() {
        var mode = $('#patternExtractSizeMode').val();
        if (mode === 'aspect') {
            var pair = PATTERN_EXTRACT_ASPECT_MAP[$('#patternExtractAspectRatio').val()] || [1024, 1024];
            return { w: pair[0], h: pair[1] };
        }
        if (mode === 'manual') {
            var w = clampResolution($('#patternExtractWidth').val());
            var h = clampResolution($('#patternExtractHeight').val());
            return { w: w, h: h };
        }
        return window.patternExtractImageDimensions || { w: 1024, h: 1024 };
    }
    function updatePatternExtractSizeModeUI() {
        var mode = $('#patternExtractSizeMode').val();
        $('#patternExtractSizeAspect').css('display', mode === 'aspect' ? 'block' : 'none');
        $('#patternExtractSizeManualPanel').css('display', mode === 'manual' ? 'block' : 'none');
        updatePatternExtractResolutionDisplay();
    }
    // 圖樣提取：僅能從數位資產選擇圖片，設定預覽與解析度
    function setPatternExtractPreview(imageUrl) {
        if (!imageUrl || !imageUrl.trim()) {
            window.patternExtractImageDataUrl = null;
            window.patternExtractImageDimensions = { w: 1024, h: 1024 };
            $('#patternExtractPreviewImg').addClass('d-none').attr('src', '');
            $('#patternExtractPreviewInner').removeClass('d-none');
            updatePatternExtractResolutionDisplay();
            return;
        }
        window.patternExtractImageDataUrl = imageUrl.trim();
        $('#patternExtractPreviewImg').attr('src', window.patternExtractImageDataUrl).removeClass('d-none');
        $('#patternExtractPreviewInner').addClass('d-none');
        var img = document.getElementById('patternExtractPreviewImg');
        if (img) {
            img.onload = function () {
                var nw = img.naturalWidth || 1024;
                var nh = img.naturalHeight || 1024;
                window.patternExtractImageDimensions = { w: clampResolution(nw), h: clampResolution(nh) };
                updatePatternExtractResolutionDisplay();
            };
            if (img.complete) img.onload();
        } else {
            updatePatternExtractResolutionDisplay();
        }
    }
    $('#patternExtractSizeMode').on('change', updatePatternExtractSizeModeUI);
    $('#patternExtractAspectRatio').on('change', updatePatternExtractResolutionDisplay);
    $('#patternExtractWidth').on('input', function () {
        var v = clampResolution(this.value);
        $('#patternExtractWidth').val(v);
        $('#patternExtractWidthSlider').val(v);
        updatePatternExtractResolutionDisplay();
    });
    $('#patternExtractWidthSlider').on('input', function () {
        var v = parseInt(this.value, 10);
        $('#patternExtractWidth').val(v);
        updatePatternExtractResolutionDisplay();
    });
    $('#patternExtractHeight').on('input', function () {
        var v = clampResolution(this.value);
        $('#patternExtractHeight').val(v);
        $('#patternExtractHeightSlider').val(v);
        updatePatternExtractResolutionDisplay();
    });
    $('#patternExtractHeightSlider').on('input', function () {
        var v = parseInt(this.value, 10);
        $('#patternExtractHeight').val(v);
        updatePatternExtractResolutionDisplay();
    });
    updatePatternExtractSizeModeUI();
    function renderPatternExtractResult(imageDataUrl) {
        if (!imageDataUrl) return;
        var wrap = $('#patternExtractResultWrap');
        var note = '<p class="scene-sim-result-note text-muted small mt-2 mb-0">' + (t('customProduct.patternExtractResultNote') || '此圖不會存入數位資產，請自行下載保存。') + '</p>';
        var $inner = $('<div class="scene-sim-result-inner"></div>');
        $inner.append($('<img>').attr('src', imageDataUrl).attr('alt', t('customProduct.patternExtractTab') || '圖樣提取結果').addClass('img-fluid rounded js-preview-enlarge').css({ maxWidth: '100%', cursor: 'zoom-in' }).attr('title', '點擊放大'));
        var $btn = $('<a href="#" class="btn btn-sm btn-outline-primary mt-2"><i class="fas fa-download me-1"></i>' + (t('customProduct.downloadImage') || '下載圖片') + '</a>');
        $btn.on('click', function (e) {
            e.preventDefault();
            try {
                var dataUrl = (imageDataUrl || '');
                var mimeMatch = dataUrl.match(/^data:image\/(jpeg|jpg|png);base64,/i);
                var ext = (mimeMatch && mimeMatch[1]) ? (mimeMatch[1].toLowerCase() === 'png' ? 'png' : 'jpg') : 'jpg';
                var mime = ext === 'png' ? 'image/png' : 'image/jpeg';
                var base64 = dataUrl.split(',')[1];
                if (!base64) return;
                var bin = atob(base64);
                var arr = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                var blob = new Blob([arr], { type: mime });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'pattern-extract.' + ext;
                a.click();
                URL.revokeObjectURL(url);
            } catch (err) { console.warn(err); }
        });
        $inner.append($btn).append(note);
        wrap.html('').append($inner);
    }
    $('#patternExtractApplyBtn').on('click', function () {
        var imageUrl = window.patternExtractImageDataUrl || '';
        if (!imageUrl) {
            alert(t('customProduct.patternExtractSelectRequired') || '請從數位資產選擇一張圖片');
            return;
        }
        var $btn = $('#patternExtractApplyBtn');
        var $wrap = $('#patternExtractResultWrap');
        var prompt = ($('#patternExtractPrompt').val() || '').trim();
        var seamless = $('#patternExtractSeamless').prop('checked');
        var dims = getPatternExtractWidthHeight();
        var outputFormat = ($('#patternExtractOutputFormat').val() === 'png') ? 'png' : 'jpeg';
        $btn.prop('disabled', true);
        $wrap.html('<p class="text-muted small mb-0">' + (t('home.loading') || '載入中…') + '</p><p class="scene-sim-result-note text-muted small mt-2 mb-0">' + (t('customProduct.patternExtractResultNote') || '此圖不會存入數位資產，請自行下載保存。') + '</p>');
        var headers = { 'Content-Type': 'application/json' };
        Promise.resolve().then(function () {
            if (typeof window.AuthService !== 'undefined' && typeof window.AuthService.getSession === 'function') {
                return window.AuthService.getSession();
            }
            return null;
        }).then(function (session) {
            if (session && session.access_token) headers['Authorization'] = 'Bearer ' + session.access_token;
            return fetch('/api/pattern-extract', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ image: imageUrl, prompt: prompt, seamless: seamless, width: dims.w, height: dims.h, output_format: outputFormat })
            });
        }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
            .then(function (result) {
                $btn.prop('disabled', false);
                var data = result.data;
                var noteHtml = '<p class="scene-sim-result-note text-muted small mt-2 mb-0">' + (t('customProduct.patternExtractResultNote') || '此圖不會存入數位資產，請自行下載保存。') + '</p>';
                if (result.status === 401) {
                    $wrap.html('<p class="text-warning small mb-0">' + (t('customProduct.loginToSelectAssets') || '請先登入') + '</p>' + noteHtml);
                    return;
                }
                if (result.status === 402) {
                    $wrap.html('<p class="text-danger small mb-0">' + (data.error || ('點數不足（需要 ' + (data.required || 20) + ' 點）')) + '</p>' + noteHtml);
                    return;
                }
                if (data.success && data.imageData) {
                    renderPatternExtractResult(data.imageData);
                } else {
                    $wrap.html('<p class="text-danger small mb-0">' + (data.error || t('customProduct.loadFailed')) + '</p>' + noteHtml);
                }
            })
            .catch(function (err) {
                $btn.prop('disabled', false);
                $wrap.html('<p class="text-danger small mb-0">' + t('customProduct.loadFailed') + '</p><p class="scene-sim-result-note text-muted small mt-2 mb-0">' + (t('customProduct.patternExtractResultNote') || '此圖不會存入數位資產，請自行下載保存。') + '</p>');
                console.warn('pattern-extract:', err);
            });
    });
});

// 聯繫廠商（全域函數）
function contactManufacturer(id) {
    // TODO: 實作聯繫功能
    alert('聯繫功能開發中，廠商 ID: ' + id);
}

// 重試生成圖片
function retryGeneration() {
    $('#generatedImagePreview').empty();
    $('#generateImageBtn').click();
}

// 切換到上傳模式
function switchToUpload() {
    $('#textInput').prop('checked', false);
    $('#imageUpload').prop('checked', true).trigger('change');
    $('#generatedImagePreview').empty();
}
