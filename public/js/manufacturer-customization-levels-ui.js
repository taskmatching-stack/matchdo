/**
 * 訂製程度按鈕 UI（與 manufacturer-materials 數位原型表單一致）
 */
(function (global) {
    var OPTIONS = [
        { key: 'mono_graphic', i18n: 'baseModels.customLevelMonoGraphic', fb: '單色表面圖文' },
        { key: 'color_graphic', i18n: 'baseModels.customLevelColorGraphic', fb: '彩色表面圖文' },
        { key: 'color_material', i18n: 'baseModels.customLevelColorMaterial', fb: '主體顏色／材質' },
        { key: 'size_part', i18n: 'baseModels.customLevelSizePart', fb: '尺寸／零件' },
        { key: 'form_structure', i18n: 'baseModels.customLevelFormStructure', fb: '造型／結構' }
    ];
    var GRAPHIC_KEYS = ['mono_graphic', 'color_graphic'];

    function tr(key, fb) {
        if (global.i18n && typeof global.i18n.t === 'function') {
            var v = global.i18n.t(key);
            if (v && v !== key) return v;
        }
        return fb || key;
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function hasBothGraphicLevels(keys) {
        var out = keys || [];
        return out.indexOf('mono_graphic') >= 0 && out.indexOf('color_graphic') >= 0;
    }

    function sanitizeGraphicLevels(keys) {
        var out = (keys || []).slice();
        if (hasBothGraphicLevels(out)) {
            out = out.filter(function (k) { return k !== 'mono_graphic'; });
        }
        return out;
    }

    function renderLevelButton(opt, selected) {
        var label = tr(opt.i18n, opt.fb);
        var on = !!selected[opt.key];
        var graphicAttr = GRAPHIC_KEYS.indexOf(opt.key) >= 0 ? ' data-graphic-mutex="1"' : '';
        return '<button type="button" class="btn btn-sm btn-outline-secondary customization-level-btn' + (on ? ' active' : '') + '" data-level="' + esc(opt.key) + '"' + graphicAttr + ' aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
    }

    function bindButtons(container) {
        if (!container || container._clBtnBound) return;
        container._clBtnBound = true;
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('.customization-level-btn');
            if (!btn || !container.contains(btn)) return;
            var isGraphic = btn.getAttribute('data-graphic-mutex') === '1';
            if (isGraphic) {
                var willActivate = !btn.classList.contains('active');
                if (willActivate) {
                    container.querySelectorAll('.customization-level-btn[data-graphic-mutex="1"]').forEach(function (gBtn) {
                        gBtn.classList.remove('active');
                        gBtn.setAttribute('aria-pressed', 'false');
                    });
                    btn.classList.add('active');
                    btn.setAttribute('aria-pressed', 'true');
                } else {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-pressed', 'false');
                }
                return;
            }
            btn.classList.toggle('active');
            btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
        });
    }

    function renderButtons(container, selectedKeys) {
        if (!container) return;
        bindButtons(container);
        var selected = {};
        sanitizeGraphicLevels(selectedKeys || []).forEach(function (k) { selected[String(k)] = true; });
        var graphicOpts = OPTIONS.filter(function (o) { return GRAPHIC_KEYS.indexOf(o.key) >= 0; });
        var otherOpts = OPTIONS.filter(function (o) { return GRAPHIC_KEYS.indexOf(o.key) < 0; });
        var graphicHtml = graphicOpts.map(function (opt) { return renderLevelButton(opt, selected); }).join('');
        var otherHtml = otherOpts.map(function (opt) { return renderLevelButton(opt, selected); }).join('');
        container.innerHTML =
            '<div class="w-100"><span class="small text-muted">' + esc(tr('baseModels.surfaceGraphicPickOne', '表面圖文（擇一，可不選）')) + '</span></div>' +
            '<div class="d-flex flex-wrap gap-2 mb-2 pt-1">' + graphicHtml + '</div>' +
            '<div class="d-flex flex-wrap gap-2">' + otherHtml + '</div>';
    }

    function getSelected(container) {
        if (!container) return [];
        var out = [];
        container.querySelectorAll('.customization-level-btn.active').forEach(function (btn) {
            var v = btn.getAttribute('data-level');
            if (v && out.indexOf(v) < 0) out.push(v);
        });
        return out;
    }

    function validateSelection(levels) {
        if (!levels || !levels.length) return tr('baseModels.needCustomizationLevel', '請至少選擇一項訂製程度');
        if (hasBothGraphicLevels(levels)) return tr('baseModels.graphicMutexError', '單色表面圖文與彩色表面圖文只能擇一');
        return '';
    }

    function labelsForKeys(keys) {
        return sanitizeGraphicLevels(keys || []).map(function (k) {
            var opt = OPTIONS.find(function (o) { return o.key === k; });
            return opt ? tr(opt.i18n, opt.fb) : k;
        });
    }

    function renderBadgesHtml(keys) {
        var labels = labelsForKeys(keys);
        if (!labels.length) return '';
        return labels.map(function (lbl) {
            return '<span class="badge bg-light text-secondary border me-1 mb-1">' + esc(lbl) + '</span>';
        }).join('');
    }

    global.MatchdoCustomizationLevelsUi = {
        renderButtons: renderButtons,
        getSelected: getSelected,
        validateSelection: validateSelection,
        renderBadgesHtml: renderBadgesHtml,
        labelsForKeys: labelsForKeys
    };
}(typeof window !== 'undefined' ? window : this));
