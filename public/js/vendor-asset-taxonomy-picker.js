/**
 * 廠商素材：生產模式 + 工藝多選（MT-3a）
 * 動態掛載，不硬編碼 HTML 進 manufacturer-materials.html
 */
(function (global) {
    'use strict';

    var productionTypesCache = null;
    var API_HINT = '工藝詞彙尚未就緒：請確認已部署最新程式，並在 Supabase 執行 docs/add-manufacturer-taxonomy.sql';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function setToken(t) {
        global.__vendorTaxonomyToken = t || '';
    }

    async function loadProductionTypes() {
        if (productionTypesCache) return productionTypesCache;
        var r = await fetch('/api/taxonomy?dimension=production_type');
        var d = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(d.error || API_HINT);
        productionTypesCache = d.items || [];
        return productionTypesCache;
    }

    function showApiHint(block, msg) {
        if (!block) return;
        var el = block.querySelector('.vendor-taxonomy-api-hint');
        if (!el) return;
        el.textContent = msg || API_HINT;
        el.classList.remove('d-none');
    }

    function fillProductionTypeSelect(sel, selectedKey) {
        if (!sel) return;
        var cur = selectedKey != null ? String(selectedKey) : String(sel.value || '');
        sel.innerHTML = '<option value="">— 未指定 —</option>';
        (productionTypesCache || []).forEach(function (it) {
            var opt = document.createElement('option');
            opt.value = it.key;
            opt.textContent = it.name_zh || it.key;
            sel.appendChild(opt);
        });
        sel.value = cur || '';
    }

    function renderSelectedChips(wrap, selected, onRemove) {
        if (!wrap) return;
        wrap.innerHTML = '';
        selected.forEach(function (cap) {
            var chip = document.createElement('span');
            chip.className = 'badge bg-light text-dark border me-1 mb-1 d-inline-flex align-items-center gap-1';
            chip.innerHTML = esc(cap.label || cap.key) +
                ' <button type="button" class="btn-close btn-close-sm" style="font-size:.55rem" aria-label="移除"></button>';
            chip.querySelector('button').addEventListener('click', function () {
                onRemove(cap.key);
            });
            wrap.appendChild(chip);
        });
    }

    function initCapabilityPicker(root) {
        if (!root || root.dataset.taxonomyPickerInit === '1') return;
        root.dataset.taxonomyPickerInit = '1';
        var searchInput = root.querySelector('.vendor-capability-search');
        var resultsEl = root.querySelector('.vendor-capability-results');
        var selectedWrap = root.querySelector('.vendor-capability-selected');
        var selected = [];

        function refreshChips() {
            renderSelectedChips(selectedWrap, selected, function (key) {
                selected = selected.filter(function (c) { return c.key !== key; });
                refreshChips();
            });
        }

        function setSelected(list) {
            selected = (list || []).map(function (c) {
                return { key: c.key, label: c.label || c.name_zh || c.key };
            });
            refreshChips();
        }

        function addCap(cap) {
            if (!cap || !cap.key) return;
            if (selected.some(function (c) { return c.key === cap.key; })) return;
            selected.push({ key: cap.key, label: cap.label || cap.name_zh || cap.key });
            refreshChips();
            if (searchInput) searchInput.value = '';
            if (resultsEl) {
                resultsEl.classList.add('d-none');
                resultsEl.innerHTML = '';
            }
        }

        async function runSearch() {
            var q = searchInput ? String(searchInput.value || '').trim() : '';
            if (!q) {
                if (resultsEl) {
                    resultsEl.classList.add('d-none');
                    resultsEl.innerHTML = '';
                }
                return;
            }
            try {
                var r = await fetch('/api/taxonomy/search?q=' + encodeURIComponent(q) + '&dimension=capability&limit=15');
                var d = await r.json().catch(function () { return {}; });
                if (!resultsEl) return;
                if (!r.ok) {
                    resultsEl.innerHTML = '<div class="list-group-item small text-danger">' + esc(d.error || API_HINT) + '</div>';
                    resultsEl.classList.remove('d-none');
                    return;
                }
                var items = d.items || [];
                if (!items.length) {
                    resultsEl.innerHTML = '<div class="list-group-item small text-muted">無符合項目</div>';
                } else {
                    resultsEl.innerHTML = items.map(function (it) {
                        return '<button type="button" class="list-group-item list-group-item-action small py-2 vendor-capability-pick" data-key="' +
                            esc(it.key) + '" data-label="' + esc(it.name_zh || it.key) + '">' +
                            esc(it.name_zh || it.key) + '</button>';
                    }).join('');
                    resultsEl.querySelectorAll('.vendor-capability-pick').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            addCap({ key: btn.getAttribute('data-key'), label: btn.getAttribute('data-label') });
                        });
                    });
                }
                resultsEl.classList.remove('d-none');
            } catch (_) { /* ignore */ }
        }

        if (searchInput) {
            var debounce = null;
            searchInput.addEventListener('input', function () {
                clearTimeout(debounce);
                debounce = setTimeout(runSearch, 280);
            });
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    runSearch();
                }
            });
        }

        root.__getCapabilityKeys = function () {
            return selected.map(function (c) { return c.key; });
        };
        root.__setCapabilities = setSelected;
    }

    function buildTaxonomyFieldsHtml() {
        return '<div class="col-12 vendor-taxonomy-fields mt-1">' +
            '<p class="vendor-taxonomy-api-hint text-danger small mb-2 d-none"></p>' +
            '<div class="row g-2">' +
            '<div class="col-md-5">' +
            '<label class="form-label fw-semibold small mb-1">生產模式 <span class="text-muted fw-normal">（選填）</span></label>' +
            '<select class="form-select form-select-sm vendor-production-type-select"><option value="">— 未指定 —</option></select>' +
            '</div>' +
            '<div class="col-md-7">' +
            '<label class="form-label fw-semibold small mb-1">可執行工藝 <span class="text-muted fw-normal">（選填，可複選）</span></label>' +
            '<div class="vendor-capability-picker position-relative">' +
            '<input type="text" class="form-control form-control-sm vendor-capability-search" placeholder="搜尋：燙金、CNC、車縫…" autocomplete="off">' +
            '<div class="list-group vendor-capability-results position-absolute w-100 shadow-sm d-none" style="z-index:20;max-height:10rem;overflow-y:auto"></div>' +
            '<div class="vendor-capability-selected d-flex flex-wrap gap-1 mt-2"></div>' +
            '</div></div></div></div>';
    }

    function insertTaxonomyBlock(form, block) {
        var customCol = form.querySelector('.add-customization-levels');
        if (customCol) {
            var wrap = customCol.closest('.col-12');
            if (wrap && wrap.parentNode) {
                wrap.parentNode.insertBefore(block, wrap);
                return;
            }
        }
        var moq = form.querySelector('.add-min-order-qty');
        if (moq) {
            var moqWrap = moq.closest('.col-md-6, .col-12');
            if (moqWrap && moqWrap.parentNode) {
                if (moqWrap.nextElementSibling) {
                    moqWrap.parentNode.insertBefore(block, moqWrap.nextElementSibling);
                } else {
                    moqWrap.parentNode.appendChild(block);
                }
                return;
            }
        }
        var title = form.querySelector('.add-title');
        if (title) {
            var titleWrap = title.closest('.col-12');
            if (titleWrap && titleWrap.parentNode) {
                titleWrap.parentNode.insertBefore(block, titleWrap);
                return;
            }
        }
        var row = form.querySelector('.row');
        if (row) row.appendChild(block);
    }

    function shouldMountAddForm(form) {
        if (!form) return false;
        var kind = form.getAttribute('data-kind') || '';
        return kind === 'prototype' || kind === 'part';
    }

    async function mountTaxonomyFieldsInForm(form, asset) {
        if (!form || !shouldMountAddForm(form) || form.querySelector('.vendor-taxonomy-fields')) return;
        var wrap = document.createElement('div');
        wrap.innerHTML = buildTaxonomyFieldsHtml();
        var block = wrap.firstElementChild;
        insertTaxonomyBlock(form, block);
        initCapabilityPicker(block.querySelector('.vendor-capability-picker'));
        try {
            await loadProductionTypes();
            fillProductionTypeSelect(block.querySelector('.vendor-production-type-select'), asset && asset.production_type_key);
        } catch (e) {
            showApiHint(block, e && e.message);
        }
        if (asset && asset.capabilities && asset.capabilities.length) {
            var picker = block.querySelector('.vendor-capability-picker');
            if (picker && picker.__setCapabilities) picker.__setCapabilities(asset.capabilities);
        }
    }

    async function mountEditTaxonomyFields(asset) {
        var form = document.getElementById('edit-form');
        if (!form) return;
        var kind = (document.getElementById('edit-asset-kind') && document.getElementById('edit-asset-kind').value) || '';
        if (kind !== 'prototype' && kind !== 'part') return;
        var existing = form.querySelector('.vendor-taxonomy-fields-edit');
        if (!existing) {
            var wrap = document.createElement('div');
            wrap.className = 'vendor-taxonomy-fields-edit';
            wrap.innerHTML = buildTaxonomyFieldsHtml().replace('vendor-taxonomy-fields', 'vendor-taxonomy-fields vendor-taxonomy-fields-inner');
            var protoMeta = document.getElementById('edit-prototype-meta-wrap');
            if (protoMeta && protoMeta.parentNode) {
                protoMeta.parentNode.insertBefore(wrap, protoMeta.nextElementSibling);
            } else {
                form.insertBefore(wrap, form.firstChild);
            }
            existing = wrap;
        }
        initCapabilityPicker(existing.querySelector('.vendor-capability-picker'));
        try {
            await loadProductionTypes();
            fillProductionTypeSelect(existing.querySelector('.vendor-production-type-select'), asset && asset.production_type_key);
        } catch (e) {
            showApiHint(existing, e && e.message);
        }
        var picker = existing.querySelector('.vendor-capability-picker');
        if (picker && picker.__setCapabilities) {
            picker.__setCapabilities(asset && asset.capabilities && asset.capabilities.length ? asset.capabilities : []);
        }
    }

    function appendTaxonomyToFormData(fd, container) {
        if (!fd || !container) return;
        var root = container.querySelector('.vendor-taxonomy-fields') ||
            container.querySelector('.vendor-taxonomy-fields-edit') ||
            container;
        var ptSel = root.querySelector('.vendor-production-type-select');
        if (ptSel) fd.append('production_type_key', ptSel.value || '');
        var picker = root.querySelector('.vendor-capability-picker');
        if (picker && typeof picker.__getCapabilityKeys === 'function') {
            fd.append('capability_keys', JSON.stringify(picker.__getCapabilityKeys()));
        }
    }

    function renderCapabilityBadgesHtml(capabilities, productionTypeLabel) {
        var html = '';
        if (productionTypeLabel) {
            html += '<span class="badge bg-info-subtle text-info border me-1 mb-1">' + esc(productionTypeLabel) + '</span> ';
        }
        (capabilities || []).forEach(function (c) {
            html += '<span class="badge bg-light text-primary border me-1 mb-1" title="工藝">' + esc(c.label || c) + '</span> ';
        });
        return html;
    }

    global.VendorAssetTaxonomy = {
        setToken: setToken,
        loadProductionTypes: loadProductionTypes,
        mountTaxonomyFieldsInForm: mountTaxonomyFieldsInForm,
        mountEditTaxonomyFields: mountEditTaxonomyFields,
        appendTaxonomyToFormData: appendTaxonomyToFormData,
        renderCapabilityBadgesHtml: renderCapabilityBadgesHtml,
        initAllAddForms: function () {
            var forms = Array.prototype.slice.call(document.querySelectorAll('.add-form'))
                .filter(shouldMountAddForm);
            return Promise.all(forms.map(function (form) {
                return mountTaxonomyFieldsInForm(form);
            }));
        }
    };
})(typeof window !== 'undefined' ? window : global);
