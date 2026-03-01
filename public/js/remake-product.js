/**
 * 再製設計表單 - 分類來自 /api/remake-categories（後台「再製分類」），AI 必須有參考圖
 * 檔案：public/js/remake-product.js，頁面：public/remake-product.html
 */
$(document).ready(function () {
    let generatedImageData = null;
    let lastGeneratedImageUrl = null;  // 最近一次生成的圖 URL（供儲存到後端）
    let lastGeneratedPrompt = null;    // 最近一次前端輸入的提示詞（必存）
    let lastGeneratedSeed = null;      // 最近一次使用的 Seed（可重現風格，供儲存）

    // 圖內容分類：自訂 div 列表（主/子選單、預設選第一項）
    let categoriesData = [];
    (function loadCategories() {
        const mainList = $('#imageCategoryMainList');
        const subList = $('#imageCategorySubList');
        const mainHidden = $('#imageCategoryMainSelect');
        const subHidden = $('#imageCategorySubSelect');
        if (!mainList.length) return;
        function categoryDisplayName(key, fallback) {
            if (!key) return fallback || '';
            var t = window.i18n && window.i18n.t ? window.i18n.t.bind(window.i18n) : function () { return ''; };
            var k = 'category.' + String(key);
            var translated = t(k);
            return (translated && translated !== k) ? translated : (fallback || key || '');
        }
        function tKey(key) {
            var t = window.i18n && window.i18n.t ? window.i18n.t.bind(window.i18n) : function (k) { return k; };
            return t(key) || key;
        }
        var url = '/api/remake-categories';
        var lang = (window.i18n && window.i18n.getLang && window.i18n.getLang()) || '';
        if (lang && lang !== 'zh-TW') url += (url.indexOf('?') === -1 ? '?' : '&') + 'lang=' + encodeURIComponent(lang);
        $.get(url).then(function (res) {
            try {
                categoriesData = Array.isArray(res && res.categories) ? res.categories : [];
            } catch (e) {
                categoriesData = [];
            }
            mainList.empty();
            categoriesData.forEach(function (c) {
                var key = (c.key != null && c.key !== '') ? String(c.key) : '';
                var displayName = categoryDisplayName(key, c.name || c.key);
                var opt = $('<div class="cat-option" role="option" tabindex="0" data-key="' + key.replace(/"/g, '&quot;') + '">').text(displayName);
                opt.on('click', function () {
                    var selectedKey = $(this).attr('data-key');
                    mainList.find('.cat-option').removeClass('selected');
                    $(this).addClass('selected');
                    mainHidden.val(selectedKey);
                    updateSubList(selectedKey);
                });
                mainList.append(opt);
            });
            function updateSubList(mainKeyFromClick) {
                var mainKey = mainKeyFromClick != null ? mainKeyFromClick : mainHidden.val();
                subList.removeClass('empty').empty();
                subHidden.val('');
                if (!mainKey) {
                    subList.addClass('empty').text(tKey('customProduct.selectMainFirst'));
                    return;
                }
                var cat = categoriesData.find(function (c) { return (c.key != null ? String(c.key) : '') === String(mainKey); });
                if (!cat || !cat.subcategories || cat.subcategories.length === 0) {
                    subList.addClass('empty').text(tKey('customProduct.noSubcategory'));
                    return;
                }
                (cat.subcategories || []).forEach(function (sub) {
                    var subKey = (sub.key != null && sub.key !== '') ? String(sub.key) : '';
                    var subDisplayName = categoryDisplayName(subKey, sub.name || sub.key);
                    var opt = $('<div class="cat-option" role="option" tabindex="0" data-key="' + subKey.replace(/"/g, '&quot;') + '">').text(subDisplayName);
                    opt.on('click', function () {
                        subList.find('.cat-option').removeClass('selected');
                        $(this).addClass('selected');
                        subHidden.val($(this).attr('data-key'));
                    });
                    subList.append(opt);
                });
                subList.find('.cat-option').first().addClass('selected');
                subHidden.val(cat.subcategories[0].key);
            }
            if (categoriesData.length > 0) {
                mainList.find('.cat-option').first().addClass('selected');
                var firstKey = categoriesData[0].key != null ? String(categoriesData[0].key) : '';
                mainHidden.val(firstKey);
                updateSubList(firstKey);
            }
            $('#generateImageBtn').prop('disabled', refDataUrls.filter(Boolean).length === 0);
        }).fail(function () {
            mainList.addClass('empty').text(tKey('customProduct.loadFailed'));
        });
    })();

    // 8 格參考圖：每格獨立加圖；縮圖點擊選取 → 對應卡片高亮並捲動到可見
    const MAX_REF_IMAGES = 8;
    let refDataUrls = []; // length 8, null = 空
    let refDescs = [];
    let currentAddSlot = 0;
    let selectedRefIndex = 0; // 目前選中的參考圖索引（對應上方縮圖與下方卡片）

    function ensureRefArrays() {
        while (refDataUrls.length < MAX_REF_IMAGES) refDataUrls.push(null);
        refDataUrls = refDataUrls.slice(0, MAX_REF_IMAGES);
        while (refDescs.length < MAX_REF_IMAGES) refDescs.push('');
        refDescs = refDescs.slice(0, MAX_REF_IMAGES);
    }

    function updateRefSelection() {
        $('#referenceImagesSlots .ref-slot').removeClass('selected');
        var slotEl = $('#referenceImagesSlots .ref-slot[data-slot="' + selectedRefIndex + '"]');
        if (slotEl.length && refDataUrls[selectedRefIndex]) slotEl.addClass('selected');
        $('#referenceImagesCards .ref-card').removeClass('ref-card-selected');
        var cardEl = $('#referenceImagesCards .ref-card[data-index="' + selectedRefIndex + '"]');
        if (cardEl.length) cardEl.addClass('ref-card-selected');
    }

    function renderRefSlots() {
        try {
            ensureRefArrays();
            const slotsEl = $('#referenceImagesSlots');
            if (!slotsEl.length) return;
            slotsEl.empty();
            for (let i = 0; i < MAX_REF_IMAGES; i++) {
            const slot = $('<div class="ref-slot" data-slot="' + i + '"></div>');
            if (refDataUrls[i]) {
                slot.addClass('filled');
                if (i === selectedRefIndex) slot.addClass('selected');
                slot.append($('<img class="ref-slot-thumb" alt="參考圖 ' + (i + 1) + '">').attr('src', refDataUrls[i]));
                slot.append($('<button type="button" class="ref-slot-clear" title="移除">×</button>').on('click', function (ev) {
                    ev.stopPropagation();
                    refDataUrls[i] = null;
                    refDescs[i] = '';
                    renderRefSlots();
                    renderRefCards();
                }));
                slot.on('click', function (ev) {
                    var idx = parseInt($(this).data('slot'), 10);
                    if (refDataUrls[idx]) { selectedRefIndex = idx; updateRefSelection(); }
                });
            } else {
                slot.append($('<button type="button" class="ref-slot-add" title="加圖"><i class="fas fa-plus"></i></button>').on('click', function () {
                    currentAddSlot = i;
                    document.getElementById('referenceImageFile').click();
                }));
            }
            slotsEl.append(slot);
        }
        var hasRef = refDataUrls.filter(Boolean).length > 0;
        $('#generateImageBtn').prop('disabled', !hasRef);
        } catch (err) {
            console.error('renderRefSlots error:', err);
        }
    }

    function renderRefCards() {
        try {
            ensureRefArrays();
            const container = $('#referenceImagesCards');
            const mergeBtn = $('#mergeDescriptionsBtn');
            if (!container.length) return;
            container.find('.ref-card').each(function () {
                var i = parseInt($(this).data('index'), 10);
                if (!isNaN(i) && i >= 0 && i < MAX_REF_IMAGES) refDescs[i] = $(this).find('.ref-desc').val() || '';
            });
            container.empty();
            for (let i = 0; i < MAX_REF_IMAGES; i++) {
                if (!refDataUrls[i]) continue;
                const card = $('<div class="ref-card" data-index="' + i + '"></div>');
                card.append($('<img class="ref-card-thumb" alt="參考圖 ' + (i + 1) + '">').attr('src', refDataUrls[i]));
                const right = $('<div class="ref-card-right"></div>');
                right.append($('<span class="ref-card-label text-muted small">參考圖 ' + (i + 1) + ' · 從此圖產生描述</span>'));
                const descArea = $('<textarea class="ref-desc form-control" rows="2" placeholder="此圖描述（可手動填或按鈕產生）"></textarea>').val(refDescs[i] || '');
                right.append(descArea);
                const btn = $('<button type="button" class="btn btn-outline-secondary btn-describe-one"><i class="fas fa-eye me-1"></i>從此圖產生描述</button>');
                btn.on('click', function () { describeOneImage(i, btn, descArea); });
                right.append(btn);
                card.append(right);
                container.append(card);
            }
            var filledCount = refDataUrls.filter(Boolean).length;
            if (filledCount > 0) mergeBtn.show();
            else mergeBtn.hide();
            var firstFilled = refDataUrls.findIndex(Boolean);
            if (firstFilled >= 0 && !refDataUrls[selectedRefIndex]) selectedRefIndex = firstFilled;
            updateRefSelection();
            var hasRef = refDataUrls.filter(Boolean).length > 0;
            $('#generateImageBtn').prop('disabled', !hasRef);
        } catch (err) {
            console.error('renderRefCards error:', err);
        }
    }

    function showGeneratedResult() {
        $('#generatedImagePlaceholder').hide();
        $('#generatedImagePreviewWrap').addClass('has-result');
    }

    $(function () {
        ensureRefArrays();
        renderRefSlots();
        renderRefCards();
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
            refDataUrls[0] = redesignUrl;
            selectedRefIndex = 0;
            renderRefSlots();
            renderRefCards();
            updateRefSelection();
        }
    });

    $('#referenceImageFile').change(async function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            var dataUrl = await new Promise(function (resolve, reject) {
                var r = new FileReader();
                r.onload = function () { resolve(r.result); };
                r.onerror = function () { reject(new Error('讀取失敗')); };
                r.readAsDataURL(file);
            });
            ensureRefArrays();
            refDataUrls[currentAddSlot] = dataUrl;
            renderRefSlots();
            renderRefCards();
        } catch (err) {
            alert('讀取圖片失敗，請重試。');
        }
        e.target.value = '';
    });

    async function describeOneImage(index, btn, descArea) {
        if (!refDataUrls[index]) return;
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i>讀圖中...');
        try {
            var lang = (window.i18n && typeof window.i18n.getLang === 'function') ? window.i18n.getLang() : '';
            const res = await fetch('/api/describe-reference-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: [refDataUrls[index]], lang: lang })
            });
            const data = await res.json();
            if (data.success && data.description) {
                descArea.val(data.description);
                refDescs[index] = data.description;
            } else {
                alert(data.error || '無法產生描述');
            }
        } catch (e) {
            alert('讀圖產生描述時發生錯誤');
        } finally {
            btn.prop('disabled', false).html(originalText);
        }
    }

    // 將各張圖的描述合併至上方「描述你想生成的產品」
    $('#mergeDescriptionsBtn').click(function () {
        const parts = [];
        $('#referenceImagesCards .ref-card').each(function () {
            const text = $(this).find('.ref-desc').val().trim();
            if (text) parts.push(text);
        });
        const current = $('#productPrompt').val().trim();
        const merged = parts.length ? parts.join('\n\n') : '';
        $('#productPrompt').val(merged || current);
    });

    // AI 生成圖片：再製方案必須有參考圖，分類來自 remake_categories
    $('#generateImageBtn').click(async function () {
        const prompt = $('#productPrompt').val().trim();
        if (!prompt) {
            alert('請輸入文字描述');
            return;
        }
        if (refDataUrls.filter(Boolean).length === 0) {
            alert('再製方案必須上傳至少一張參考圖，AI 依圖改裝');
            return;
        }
        const mainKey = $('#imageCategoryMainSelect').val();
        const subKey = $('#imageCategorySubSelect').val();
        const categoryKeys = [];
        if (mainKey) categoryKeys.push(mainKey);
        if (subKey) categoryKeys.push(subKey);
        if (categoryKeys.length === 0) {
            alert('請選擇主分類');
            return;
        }

        const btn = $(this);
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>AI 生成中...');
        document.getElementById('generatedImagePreviewWrap')?.classList.add('is-loading');

        var referenceImages = refDataUrls.filter(Boolean);
        var seedVal = $('#generationSeed').val();
        var seedNum = (seedVal !== '' && seedVal != null && Number.isInteger(Number(seedVal))) ? Number(seedVal) : null;

        try {
            const payload = {
                prompt,
                categoryKeys,
                aspectRatio: '1:1',
                resolution: '2K',
                categorySource: 'remake',
                output_format: 'jpeg'
            };
            if (referenceImages.length > 0) payload.referenceImages = referenceImages;
            if (seedNum != null) payload.seed = seedNum;

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
                generatedImageData = result.imageData;
                lastGeneratedImageUrl = result.imageUrl || null;
                lastGeneratedPrompt = prompt || '';
                lastGeneratedSeed = (result.seedUsed != null && result.seedUsed !== '') ? result.seedUsed : null;
                if (lastGeneratedSeed != null) $('#generationSeed').val(lastGeneratedSeed);
                addGeneratedThumbnailToGallery(result.imageData, prompt, lastGeneratedSeed);
                $('#generatedImagePreview').html(
                    '<p class="text-success small mb-2"><i class="fas fa-check-circle me-1"></i>已生成並儲存，重整後仍會保留在右側歷史</p>' +
                    '<button type="button" class="btn btn-sm btn-outline-primary" onclick="$(\'#generateImageBtn\').click()"><i class="fas fa-redo me-1"></i>重新生成</button>'
                );
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
            btn.prop('disabled', false).html(originalText);
            document.getElementById('generatedImagePreviewWrap')?.classList.remove('is-loading');
        }
    });

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
            btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i>儲存中...');
            fetch('/api/custom-products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                    title: title,
                    description: description,
                    category_key: mainKey || null,
                    subcategory_key: subKey || null,
                    generation_prompt: promptText || null,
                    generation_seed: seedToSave != null ? seedToSave : null,
                    ai_generated_image_url: imageUrl
                })
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
            function getGalleryTitle() { return (galleryOwnerDisplay || '該帳號') + '的數位資產'; }
            if (!token) {
                wrap.html(
                    '<p class="past-gallery-title">' + getGalleryTitle() + '</p><div class="past-gallery-inner">' +
                    '<p class="text-muted small mb-0">請登入後查看歷史生成的圖</p>' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>重新載入</button></div>'
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
                    '<p class="text-muted small mb-0">尚無歷史生成的圖（儲存後的圖會保留，重整後仍可看到）</p>' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>重新載入</button></div>'
                );
                $('#generatedImagePlaceholder').hide();
            }
            function renderLoadError() {
                wrap.html(
                    '<p class="past-gallery-title">' + getGalleryTitle() + '</p><div class="past-gallery-inner">' +
                    '<p class="text-warning small mb-0">無法載入歷史，請按「重新載入」再試</p>' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>重新載入</button></div>'
                );
                $('#generatedImagePlaceholder').hide();
            }
            function renderLoading() {
                wrap.html('<p class="past-gallery-title">' + getGalleryTitle() + '</p><div class="past-gallery-inner"><p class="text-muted small mb-0"><i class="fas fa-spinner fa-spin me-1"></i>載入中…</p></div>');
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
                    var tip = (prompt ? String(prompt).replace(/"/g, '&quot;').replace(/</g, '&lt;') : '') || '本次生成（點擊放大）';
                    if (seed) tip += ' · Seed: ' + seed;
                    var $cell = $('<div class="past-item-wrap"></div>').attr({ 'data-image-url': url, 'data-prompt': prompt, 'data-seed': seed !== '' ? seed : '', 'data-owner-display': '' });
                    $cell.append($('<a class="past-item" href="#" role="button" title="' + tip + '"><img src="' + url + '" alt=""></a>'));
                    var caption = (prompt ? prompt.substring(0, 120) : '本次生成') + (seed ? ' · Seed: ' + seed : '');
                    $cell.append($('<p class="past-item-caption text-muted small mb-0">').text(caption));
                    grid.append($cell);
                });
                (products || []).forEach(function (p) {
                    var url = String(p.ai_generated_image_url || '').replace(/"/g, '&quot;');
                    var promptText = String((p.analysis_json && p.analysis_json.generation_prompt) || p.generation_prompt || p.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                    var seedStr = (p.analysis_json && p.analysis_json.generation_seed != null) ? String(p.analysis_json.generation_seed) : (p.generation_seed != null ? String(p.generation_seed) : '');
                    var ownerDisplay = (p.owner_display != null && String(p.owner_display).trim()) ? String(p.owner_display).trim() : (p.owner_email || '');
                    var tip = promptText.substring(0, 120) + (seedStr ? ' · Seed: ' + seedStr : '');
                    var showOnHomepage = p.show_on_homepage === true;
                    var $cell = $('<div class="past-item-wrap"></div>').attr({
                        'data-image-url': url,
                        'data-prompt': promptText,
                        'data-seed': seedStr,
                        'data-owner-display': ownerDisplay,
                        'data-product-id': p.id || '',
                        'data-show-on-homepage': showOnHomepage ? '1' : '0'
                    });
                    $cell.append($('<a class="past-item" href="#" role="button" title="' + tip + '"><img src="' + url + '" alt=""></a>'));
                    var caption = (promptText ? promptText.substring(0, 120) : '（無提示詞）') + (seedStr ? ' · Seed: ' + seedStr : '');
                    $cell.append($('<p class="past-item-caption text-muted small mb-0" title="' + tip + '">').text(caption));
                    grid.append($cell);
                });
                if (sessionThumbs.length === 0 && (!products || products.length === 0)) {
                    grid.append($('<p class="text-muted small mb-0">尚無歷史生成的圖（儲存後的圖會保留，重整後仍可看到）</p>'));
                    grid.append($('<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>重新載入</button>'));
                }
                $('#generatedImagePlaceholder').hide();
                try {
                    if (products && products.length > 0) {
                        var toCache = products.slice(0, 30).map(function (p) {
                            return { id: p.id, ai_generated_image_url: p.ai_generated_image_url, generation_prompt: p.generation_prompt, generation_seed: p.generation_seed, title: p.title, owner_display: p.owner_display, owner_email: p.owner_email, show_on_homepage: p.show_on_homepage, analysis_json: null };
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
        $('#pastItemModalLabel').text(prompt ? (prompt.length > 50 ? prompt.substring(0, 50) + '…' : prompt) : '生成草圖');
        var inner = document.getElementById('pastItemModalBodyInner');
        if (inner) {
            inner.innerHTML = url ? '<img src="' + (url.replace(/"/g, '&quot;')) + '" alt="">' : '<p class="text-muted py-4 mb-0">無圖</p>';
        }
        $('#pastItemModalPrompt').text(prompt || '（無）');
        $('#pastItemModalSeed').text(seed || '（無）');
        $('#pastItemModalOwner').text(ownerDisplay || '（本次生成）');
        var $showSection = $('#pastItemModalShowSection');
        var $checkbox = $('#pastItemModalShowOnHomepage');
        if (productId) {
            $showSection.removeClass('d-none');
            $checkbox.prop('checked', true).prop('disabled', true).data('product-id', productId).data('source-wrap', wrap);
            $('#pastItemModalShowOnHomepageHint').text('免費用戶預設展示在首頁，無法取消').css('color', '');
            var linkEl = document.getElementById('pastItemModalLink');
            if (linkEl) {
                linkEl.href = '/iStudio-1.0.0/client/custom-product-detail.html?id=' + encodeURIComponent(productId);
                linkEl.classList.remove('d-none');
            }
        } else {
            $showSection.addClass('d-none');
            $checkbox.removeData('product-id').removeData('source-wrap');
            var linkEl = document.getElementById('pastItemModalLink');
            if (linkEl) {
                linkEl.href = '#';
                linkEl.classList.add('d-none');
            }
        }
        var modalEl = document.getElementById('pastItemModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            (new bootstrap.Modal(modalEl)).show();
        }
    });

    // 「再設計」：帶當前圖到設計頁並設為第一張參考圖
    $(document).on('click', '#pastItemModalRedesign', function () {
        var img = $('#pastItemModalBodyInner img').attr('src');
        if (img) {
            try { sessionStorage.setItem('redesignImageUrl', img); } catch (e) {}
            window.location.href = '/custom-product.html';
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
            var $cell = $('<div class="past-item-wrap"></div>').attr({
                'data-image-url': url,
                'data-prompt': promptStr,
                'data-seed': seedStr,
                'data-owner-display': ''
            });
            $cell.append($('<a class="past-item" href="#" role="button" title="' + tip + '"><img src="' + url + '" alt=""></a>'));
            var caption = (promptStr ? promptStr.substring(0, 120) : '本次生成') + (seedStr ? ' · Seed: ' + seedStr : '');
            $cell.append($('<p class="past-item-caption text-muted small mb-0">').text(caption));
            var inner = wrap.find('.past-gallery-inner');
            if (!inner.length) {
                wrap.html('<p class="past-gallery-title">該帳號的數位資產</p><div class="past-gallery-inner"></div>');
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
        var title = (ownerDisplay || '該帳號') + '的數位資產';
        wrap.html('<p class="past-gallery-title">' + title + '</p><div class="past-gallery-inner"></div>');
        var grid = wrap.find('.past-gallery-inner');
        (products || []).forEach(function (p) {
            var url = String(p.ai_generated_image_url || '').replace(/"/g, '&quot;');
            var promptText = String((p.analysis_json && p.analysis_json.generation_prompt) || p.generation_prompt || p.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            var seedStr = (p.analysis_json && p.analysis_json.generation_seed != null) ? String(p.analysis_json.generation_seed) : (p.generation_seed != null ? String(p.generation_seed) : '');
            var ownerD = (p.owner_display != null && String(p.owner_display).trim()) ? String(p.owner_display).trim() : (p.owner_email || '');
            var tip = promptText.substring(0, 120) + (seedStr ? ' · Seed: ' + seedStr : '');
            var showOnHomepage = p.show_on_homepage === true;
            var $cell = $('<div class="past-item-wrap"></div>').attr({
                'data-image-url': url,
                'data-prompt': promptText,
                'data-seed': seedStr,
                'data-owner-display': ownerD,
                'data-product-id': p.id || '',
                'data-show-on-homepage': showOnHomepage ? '1' : '0'
            });
            $cell.append($('<a class="past-item" href="#" role="button" title="' + tip + '"><img src="' + url + '" alt=""></a>'));
            var caption = (promptText ? promptText.substring(0, 120) : '（無提示詞）') + (seedStr ? ' · Seed: ' + seedStr : '');
            $cell.append($('<p class="past-item-caption text-muted small mb-0" title="' + tip + '">').text(caption));
            grid.append($cell);
        });
        if (products.length === 0) {
            grid.append($('<p class="text-muted small mb-0">尚無歷史生成的圖（儲存後的圖會保留，重整後仍可看到）</p>'));
            grid.append($('<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-spinner fa-spin me-1"></i>重新載入</button>'));
        }
        $('#generatedImagePlaceholder').hide();
    }

    // 有 token 才載入歷史（token 可來自 Auth 回調的 session.access_token，避免搶跑）
    function tryLoadHistoryWhenAuthReady(optionalToken) {
        function run(token) {
            if (!token) {
                $('#pastGeneratedGallery').html(
                    '<p class="past-gallery-title">該帳號的數位資產</p><div class="past-gallery-inner">' +
                    '<p class="text-muted small mb-0">請登入後查看歷史生成的圖</p>' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary mt-2 js-reload-history"><i class="fas fa-sync-alt me-1"></i>重新載入</button></div>'
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
                wrap.html('<p class="past-gallery-title">該帳號的數位資產</p><div class="past-gallery-inner"><p class="text-muted small mb-0"><i class="fas fa-spinner fa-spin me-1"></i>載入中…</p></div>');
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
    $('#pastGeneratedGallery').html('<p class="past-gallery-title">該帳號的數位資產</p><div class="past-gallery-inner"><p class="text-muted small mb-0"><i class="fas fa-spinner fa-spin me-1"></i>載入中…</p></div>');
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

/* ── 手機版專屬：textarea auto-grow ── */
(function () {
    if (window.innerWidth > 768) return;
    var ta = document.getElementById('productPrompt');
    if (!ta) return;
    ta.rows = 1;
    ta.style.resize = 'none';
    ta.style.overflow = 'hidden';
    ta.style.minHeight = 'unset';
    function autoGrow() {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
    }
    ta.addEventListener('input', autoGrow);
    autoGrow();
})();

/* ── 手機版專屬：分類 Bottom Sheet ── */
(function catBottomSheet() {
    if (window.innerWidth > 768) return;

    var sheet = document.getElementById('catBottomSheet');
    var mobileBtn = document.getElementById('catMobileBtn');
    if (!sheet || !mobileBtn) return;

    var bsList = document.getElementById('catBsList');
    var bsTitle = document.getElementById('catBsTitle');
    var bsBack = document.getElementById('catBsBack');
    var bsClose = document.getElementById('catBsClose');
    var backdrop = document.getElementById('catBsBackdrop');
    var step = 'main';

    function updateBtnLabel() {
        var mainEl = document.querySelector('#imageCategoryMainList .cat-option.selected');
        var subEl = document.querySelector('#imageCategorySubList .cat-option.selected');
        var label = '';
        if (mainEl) label = mainEl.textContent.trim();
        if (subEl) label += ' › ' + subEl.textContent.trim();
        if (label) {
            document.getElementById('catMobileBtnLabel').textContent = label;
            mobileBtn.classList.add('has-value');
        } else {
            document.getElementById('catMobileBtnLabel').textContent = '選擇分類';
            mobileBtn.classList.remove('has-value');
        }
    }

    function watchList() {
        var obs = new MutationObserver(updateBtnLabel);
        ['#imageCategoryMainList', '#imageCategorySubList'].forEach(function (sel) {
            var el = document.querySelector(sel);
            if (el) obs.observe(el, { subtree: true, attributes: true, attributeFilter: ['class'] });
        });
    }
    watchList();
    setTimeout(updateBtnLabel, 600);

    function openSheet() {
        sheet.classList.add('open');
        document.body.style.overflow = 'hidden';
        showMainStep();
    }
    function closeSheet() {
        sheet.classList.remove('open');
        document.body.style.overflow = '';
    }

    function showMainStep() {
        step = 'main';
        bsTitle.textContent = '選擇主分類';
        bsBack.style.visibility = 'hidden';
        bsList.innerHTML = '';
        var opts = document.querySelectorAll('#imageCategoryMainList .cat-option');
        opts.forEach(function (opt) {
            var item = document.createElement('div');
            item.className = 'cat-bs-item' + (opt.classList.contains('selected') ? ' is-selected' : '');
            item.innerHTML = '<span class="cat-bs-check">' + (opt.classList.contains('selected') ? '✓' : '') + '</span>'
                + '<span>' + opt.textContent.trim() + '</span>'
                + '<span class="cat-bs-chevron">›</span>';
            item.addEventListener('click', function () {
                opt.click();
                setTimeout(function () { showSubStep(); }, 100);
            });
            bsList.appendChild(item);
        });
    }

    function showSubStep() {
        step = 'sub';
        var mainEl = document.querySelector('#imageCategoryMainList .cat-option.selected');
        bsTitle.textContent = mainEl ? mainEl.textContent.trim() : '選擇子分類';
        bsBack.style.visibility = 'visible';
        bsList.innerHTML = '';
        var opts = document.querySelectorAll('#imageCategorySubList .cat-option');
        if (!opts.length) {
            var empty = document.createElement('div');
            empty.className = 'cat-bs-item';
            empty.style.color = '#94a3b8';
            empty.textContent = '此分類無子分類';
            bsList.appendChild(empty);
            return;
        }
        opts.forEach(function (opt) {
            var item = document.createElement('div');
            item.className = 'cat-bs-item' + (opt.classList.contains('selected') ? ' is-selected' : '');
            item.innerHTML = '<span class="cat-bs-check">' + (opt.classList.contains('selected') ? '✓' : '') + '</span>'
                + '<span>' + opt.textContent.trim() + '</span>';
            item.addEventListener('click', function () {
                opt.click();
                updateBtnLabel();
                setTimeout(closeSheet, 180);
            });
            bsList.appendChild(item);
        });
    }

    mobileBtn.style.display = 'flex';
    mobileBtn.addEventListener('click', openSheet);
    bsBack.addEventListener('click', showMainStep);
    bsClose.addEventListener('click', closeSheet);
    backdrop.addEventListener('click', closeSheet);
})();
