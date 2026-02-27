$(document).ready(function () {
    var generatedImageData = null;

    // 載入產品類別（與 /admin/custom-categories.html 同源）
    (function loadCategories() {
        var sel = $('#productCategory');
        if (!sel.length) return;
        $.get('/api/custom-product-categories').then(function (res) {
            var categories = res.categories || [];
            sel.find('option:not(:first)').remove();
            categories.forEach(function (c) {
                var optgroup = $('<optgroup></optgroup>').attr('label', (c.name || c.key).replace(/"/g, '&quot;'));
                optgroup.append($('<option></option>').val(c.key).text(c.name || c.key));
                (c.subcategories || []).forEach(function (sub) {
                    optgroup.append($('<option></option>').val(sub.key).text(sub.name || sub.key));
                });
                sel.append(optgroup);
            });
        }).fail(function () {
            sel.append($('<option value="other">其他</option>'));
        });
    })();

    // 切換輸入方式
    $('input[name="inputMethod"]').change(function () {
        var method = $(this).val();
        $('.btn-method').removeClass('active');
        $(this).next('label.btn-method').addClass('active');
        if (method === 'upload') {
            $('#uploadSection').show();
            $('#generateSection').hide();
            $('#productImages').prop('required', true);
            $('#productPrompt').prop('required', false);
        } else {
            $('#uploadSection').hide();
            $('#generateSection').show();
            $('#productImages').prop('required', false);
            $('#productPrompt').prop('required', true);
        }
    });
    $('input[name="inputMethod"]:checked').next('label.btn-method').addClass('active');

    // 圖片預覽（上傳）
    $('#productImages').change(function (e) {
        const preview = $('#imagePreview');
        preview.empty();
        const files = e.target.files;
        
        if (files.length > 0) {
            // 顯示圖片數量提示
            const countBadge = $('<div class="alert alert-info mb-3"></div>')
                .html(`<i class="fas fa-images me-2"></i>已選擇 <strong>${files.length}</strong> 張圖片，AI 將綜合分析`);
            preview.append(countBadge);

            // 顯示每張圖片預覽
            Array.from(files).forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const container = $('<div class="position-relative d-inline-block"></div>');
                    const img = $('<img>')
                        .attr('src', e.target.result)
                        .addClass('img-thumbnail')
                        .css({ 'max-width': '150px', 'max-height': '150px' });
                    
                    // 圖片編號
                    const badge = $('<span class="position-absolute top-0 start-0 badge bg-primary m-1"></span>')
                        .text(index + 1);
                    
                    container.append(img).append(badge);
                    preview.append(container);
                };
                reader.readAsDataURL(file);
            });
        }
    });

    // 參考圖片預覽（最多 8 張）
    $('#referenceImages').change(function (e) {
        var preview = $('#referenceImagesPreview');
        preview.empty();
        var files = Array.from((e.target.files || []).slice(0, 8));
        if (files.length >= 1) {
            preview.append($('<span class="text-muted small"></span>').text('已選 ' + files.length + ' 張（FLUX 2.0 最多 8 張）'));
            files.forEach(function (file, i) {
                var reader = new FileReader();
                reader.onload = function (ev) {
                    preview.append($('<img>').attr('src', ev.target.result).addClass('img-thumbnail').css({ maxWidth: '60px', maxHeight: '60px' }));
                };
                reader.readAsDataURL(file);
            });
        }
    });

    // AI 生成圖片（有參考圖用 FLUX 2.0 PRO，否則用 Gemini）；須帶入主分類與子分類
    $('#generateImageBtn').click(async function () {
        const prompt = $('#productPrompt').val().trim();
        if (!prompt) {
            alert('請輸入產品描述');
            return;
        }
        var categoryKeys = [];
        var sel = $('#productCategory');
        var opt = sel.find('option:selected');
        var selectedVal = opt.val();
        if (selectedVal) {
            var grp = opt.closest('optgroup');
            if (grp.length) {
                var mainKey = grp.find('option').first().val();
                if (mainKey) categoryKeys.push(mainKey);
                if (selectedVal !== mainKey) categoryKeys.push(selectedVal);
            } else {
                categoryKeys.push(selectedVal);
            }
        }
        if (categoryKeys.length === 0) {
            alert('請先選擇產品分類（主分類或子分類），會影響生成的產品類型。');
            return;
        }

        const btn = $(this);
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>AI 生成中...');

        var referenceImages = [];
        var refInput = $('#referenceImages')[0];
        if (refInput && refInput.files && refInput.files.length > 0) {
            var files = Array.from(refInput.files).slice(0, 8);
            for (var i = 0; i < files.length; i++) {
                var dataUrl = await new Promise(function (resolve, reject) {
                    var r = new FileReader();
                    r.onload = function () { resolve(r.result); };
                    r.onerror = reject;
                    r.readAsDataURL(files[i]);
                });
                referenceImages.push(dataUrl);
            }
        }

        try {
            var payload = { prompt: prompt, categoryKeys: categoryKeys, aspectRatio: '1:1', resolution: '2K' };
            if (referenceImages.length > 0) payload.referenceImages = referenceImages;
            var headers = { 'Content-Type': 'application/json' };
            try {
                var session = (typeof window.AuthService !== 'undefined' && window.AuthService.getSession) ? await window.AuthService.getSession() : null;
                if (session && session.session && session.session.access_token) headers['Authorization'] = 'Bearer ' + session.session.access_token;
            } catch (e) {}

            const response = await fetch('/api/generate-product-image', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                generatedImageData = result.imageData;
                var engine = result.usedFlux ? 'FLUX 2.0 PRO' : 'Gemini';
                $('#generatedImagePreview').html(
                    '<div class="card">' +
                    '<img src="' + result.imageData + '" class="card-img-top" alt="AI 生成產品圖">' +
                    '<div class="card-body">' +
                    '<p class="card-text text-success mb-2"><i class="fas fa-check-circle me-2"></i>專業示意圖生成成功</p>' +
                    '<div class="text-muted small mb-2"><i class="fas fa-info-circle me-1"></i>' + engine + ' | 比例：' + result.aspectRatio + '</div>' +
                    '<button type="button" class="btn btn-sm btn-outline-primary" onclick="$(\'#generateImageBtn\').click()"><i class="fas fa-redo me-1"></i>重新生成</button> ' +
                    '<button type="button" class="btn btn-sm btn-outline-secondary ms-1" onclick="$(\'input[value=upload]\').click()"><i class="fas fa-upload me-1"></i>改用上傳</button>' +
                    '</div></div>'
                );
            } else {
                // 錯誤處理 UI
                $('#generatedImagePreview').html(`
                    <div class="alert alert-danger">
                        <h6><i class="fas fa-exclamation-triangle me-2"></i>生成失敗</h6>
                        <p class="mb-2">${result.error || '未知錯誤'}</p>
                        ${result.details ? `<p class="small text-muted mb-2">${result.details}</p>` : ''}
                        <button type="button" class="btn btn-sm btn-danger" onclick="$('#generateImageBtn').click()">
                            <i class="fas fa-redo me-1"></i>重試
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary ms-2" onclick="$('input[value=upload]').click()">
                            <i class="fas fa-upload me-1"></i>改用上傳圖片
                        </button>
                    </div>
                `);
            }
        } catch (error) {
            console.error('Generate image error:', error);
            // 網路錯誤處理 UI
            $('#generatedImagePreview').html(`
                <div class="alert alert-warning">
                    <h6><i class="fas fa-wifi me-2"></i>網路連線失敗</h6>
                    <p class="mb-2">請檢查網路連線或稍後再試</p>
                    <button type="button" class="btn btn-sm btn-warning" onclick="$('#generateImageBtn').click()">
                        <i class="fas fa-redo me-1"></i>重試
                    </button>
                </div>
            `);
        } finally {
            btn.prop('disabled', false).html(originalText);
        }
    });

    // 提交表單
    $('#customProductForm').submit(async function (e) {
        e.preventDefault();

        const method = $('input[name="inputMethod"]:checked').val();
        const formData = new FormData();

        // 根據輸入方式處理圖片
        if (method === 'upload') {
            const files = $('#productImages')[0].files;
            if (files.length === 0) {
                alert('請上傳至少一張圖片');
                return;
            }
            Array.from(files).forEach(file => {
                formData.append('images', file);
            });
        } else {
            if (!generatedImageData) {
                alert('請先生成示意圖');
                return;
            }
            formData.append('generatedImage', generatedImageData);
            formData.append('prompt', $('#productPrompt').val());
        }

        // 主分類 key 與子分類 key 都要存：主分類存 category / category_key，子分類存 subcategory_key
        var sel = $('#productCategory');
        var opt = sel.find('option:selected');
        var selectedVal = opt.val();
        var mainKey = '';
        var subKey = '';
        if (selectedVal) {
            var grp = opt.closest('optgroup');
            if (grp.length) {
                mainKey = grp.find('option').first().val() || '';
                if (selectedVal !== mainKey) subKey = selectedVal;
            } else {
                mainKey = selectedVal;
            }
        }
        formData.append('category', mainKey || selectedVal || '');
        formData.append('category_key', mainKey);
        if (subKey) formData.append('subcategory_key', subKey);
        formData.append('quantity', $('#quantity').val());
        formData.append('description', $('#productDescription').val());
        formData.append('budgetMin', $('#budgetMin').val());
        formData.append('budgetMax', $('#budgetMax').val());

        // 顯示載入狀態
        const submitBtn = $(this).find('button[type="submit"]');
        submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>AI 分析中...');

        try {
            const response = await fetch('/api/analyze-custom-product', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                displayAnalysisResult(result);
            } else {
                alert('分析失敗：' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('分析失敗，請稍後再試');
        } finally {
            submitBtn.prop('disabled', false).html('<i class="fas fa-search me-2"></i>AI 智能媒合廠商');
        }
    });

    // 顯示分析結果
    function displayAnalysisResult(result) {
        const { analysis, manufacturers } = result;

        // 顯示分析內容
        let analysisHTML = `
            <div class="alert alert-info">
                <h6><i class="fas fa-info-circle me-2"></i>AI 產品分析結果</h6>
                <p class="mb-2"><strong>產品類型：</strong>${analysis.productType || '未識別'}</p>
                <p class="mb-2"><strong>材質建議：</strong>${analysis.materials ? analysis.materials.join('、') : '未識別'}</p>
                <p class="mb-2"><strong>工藝需求：</strong>${analysis.techniques ? analysis.techniques.join('、') : '未識別'}</p>
                <p class="mb-2"><strong>製作難度：</strong>${analysis.difficulty || '中等'}</p>`;
        
        if (analysis.estimatedDays) {
            analysisHTML += `<p class="mb-2"><strong>預估工期：</strong>${analysis.estimatedDays}</p>`;
        }
        
        if (analysis.designStyle) {
            analysisHTML += `<p class="mb-2"><strong>設計風格：</strong>${analysis.designStyle}</p>`;
        }
        
        if (analysis.keyFeatures && analysis.keyFeatures.length > 0) {
            analysisHTML += `<p class="mb-2"><strong>產品特點：</strong>${analysis.keyFeatures.join('、')}</p>`;
        }
        
        if (analysis.recommendations) {
            analysisHTML += `<p class="mb-0"><strong>製作建議：</strong>${analysis.recommendations}</p>`;
        }
        
        analysisHTML += `</div>`;
        
        $('#analysisContent').html(analysisHTML);

        // 顯示推薦廠商
        const manufacturerHTML = manufacturers.map(mfr => `
            <div class="col-md-6 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h6 class="card-title">${mfr.name}</h6>
                        <p class="card-text text-muted small">${mfr.specialty}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="badge bg-success">${mfr.matchScore}% 匹配度</span>
                            <span class="text-primary">${mfr.experience}年經驗</span>
                        </div>
                        <hr>
                        <div class="d-flex justify-content-between">
                            <small><i class="fas fa-map-marker-alt me-1"></i>${mfr.location}</small>
                            <small><i class="fas fa-star me-1"></i>${mfr.rating}/5.0</small>
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-primary btn-sm w-100" onclick="contactManufacturer('${mfr.id}')">
                            <i class="fas fa-phone me-2"></i>立即聯繫
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        $('#manufacturerList').html(manufacturerHTML || '<p class="text-muted">暫無推薦廠商</p>');
        
        // 顯示結果區塊
        $('#analysisResult').slideDown();
        
        // 滾動到結果
        $('html, body').animate({
            scrollTop: $('#analysisResult').offset().top - 100
        }, 500);
    }

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
