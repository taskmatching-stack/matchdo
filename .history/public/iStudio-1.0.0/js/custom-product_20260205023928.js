$(document).ready(function () {
    let generatedImageData = null;

    // 切換輸入方式
    $('input[name="inputMethod"]').change(function () {
        const method = $(this).val();
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

    // AI 生成圖片（使用 Gemini 3 Pro Image Preview）
    $('#generateImageBtn').click(async function () {
        const prompt = $('#productPrompt').val().trim();
        if (!prompt) {
            alert('請輸入產品描述');
            return;
        }

        const btn = $(this);
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>AI 生成中...');

        try {
            const response = await fetch('/api/generate-product-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt,
                    aspectRatio: '1:1',  // 可選：1:1, 16:9, 4:3, 3:2, 9:16 等
                    resolution: '2K'     // 可選：1K, 2K, 4K
                })
            });

            const result = await response.json();
            
            if (result.success) {
                generatedImageData = result.imageData;
                $('#generatedImagePreview').html(`
                    <div class="card">
                        <img src="${result.imageData}" class="card-img-top" alt="AI 生成產品圖">
                        <div class="card-body">
                            <p class="card-text text-success mb-2">
                                <i class="fas fa-check-circle me-2"></i>專業示意圖生成成功
                            </p>
                            <div class="text-muted small mb-2">
                                <i class="fas fa-info-circle me-1"></i>
                                解析度：${result.resolution} | 比例：${result.aspectRatio}
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-primary" onclick="$('#generateImageBtn').click()">
                                <i class="fas fa-redo me-1"></i>重新生成
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-secondary ms-1" onclick="$('input[value=upload]').click()">
                                <i class="fas fa-upload me-1"></i>改用上傳
                            </button>
                        </div>
                    </div>
                `);
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

        // 其他表單資料
        formData.append('category', $('#productCategory').val());
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
