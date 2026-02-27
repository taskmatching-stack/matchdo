    let currentProjectId = null; // 儲存當前專案 ID

    // 載入大分類與子分類選單
    async function renderCategoryOptions() {
        var $cat = $('#category');
        $cat.empty();
        try {
            const res = await fetch('/api/categories', { cache: 'no-store' });
            const data = await res.json();
            const list = Array.isArray(data.categories) ? data.categories : [];
            window.__AI_CATEGORIES_CACHE__ = list;
            if (!list.length) {
                $('#aiResult').html('<div class="text-danger">尚未設定分類，請先到後台「分類管理」新增並儲存。</div>');
                return;
            }
            list.forEach(function (cat) {
                $cat.append(`<option value="${cat.key}">${cat.name}</option>`);
            });
        } catch (e) {
            $('#aiResult').html('<div class="text-danger">載入分類失敗，請稍後重試或聯絡管理員。</div>');
            return;
        }
        $cat.trigger('change');
    }

    function renderSubcategoryOptions(catKey) {
        var $sub = $('#subcategory');
        $sub.empty();
        var src = window.__AI_CATEGORIES_CACHE__ || [];
        var cat = src.find(c => c.key === catKey);
        if (cat && cat.sub && cat.sub.length > 0) {
            cat.sub.forEach(function (sub) {
                $sub.append(`<option value="${sub}">${sub}</option>`);
            });
            $sub.val([cat.sub[0]]);
            // 載入第一個子分類的必問問題
            loadDynamicFields(catKey, [cat.sub[0]]);
        }
    }

    // 載入子分類的必問問題
    async function loadDynamicFields(catKey, subcats) {
        console.log('🔍 loadDynamicFields 被調用:', { catKey, subcats });
        const $dynamicFields = $('#dynamicFields');
        $dynamicFields.empty();
        
        if (!subcats || subcats.length === 0) {
            console.log('❌ 沒有子分類');
            return;
        }
        
        try {
            // 從 API 獲取子分類的 form_config
            const apiUrl = `/api/subcategories?category_key=${catKey}`;
            console.log('📡 API 請求:', apiUrl);
            const res = await fetch(apiUrl);
            const data = await res.json();
            console.log('📥 API 返回:', data);
            
            if (!data.success || !data.subcategories) {
                console.log('❌ API 返回失敗或沒有子分類');
                return;
            }
            
            // 收集所有選中的子分類的欄位（去重）
            const allFields = {};
            subcats.forEach(subName => {
                const subData = data.subcategories.find(s => s.name === subName);
                console.log(`🔎 查找子分類 "${subName}":`, subData);
                if (subData && subData.form_config) {
                    console.log(`✅ "${subName}" 有 ${subData.form_config.length} 個欄位`);
                    subData.form_config.forEach(field => {
                        const key = field.name || field.label;
                        if (!allFields[key]) {
                            allFields[key] = field;
                        }
                    });
                }
            });
            
            // 渲染欄位
            const fields = Object.values(allFields);
            console.log('📝 準備渲染欄位:', fields);
            
            if (fields.length === 0) {
                console.log('❌ 沒有欄位可以渲染');
                $dynamicFields.html('<div class="alert alert-warning"><strong>提示：</strong>此子分類尚未設定必填欄位。請到後台「分類管理」設定。</div>');
                return;
            }
            
            let html = '<div class="border-top pt-3 mb-3"><h6 class="text-primary mb-3"><i class="fas fa-clipboard-list me-2"></i>專案基本資訊</h6><div class="row">';
            
            fields.forEach(f => {
                const fieldName = f.name || (f.label || '').replace(/\s+/g, '_');
                const requiredAttr = f.required ? 'required' : '';
                const requiredBadge = f.required ? ' <span class="text-danger">*</span>' : '';
                const placeholder = f.placeholder || '';
                const unitText = f.unit ? ` (${f.unit})` : '';
                
                html += '<div class="col-md-6 mb-3">';
                html += `<label class="form-label">${f.label}${unitText}${requiredBadge}</label>`;
                
                if (f.type === 'select') {
                    html += `<select class="form-select" name="dynamic_${fieldName}" ${requiredAttr}>`;
                    html += '<option value="">請選擇</option>';
                    (f.options || []).forEach(opt => {
                        html += `<option value="${opt}">${opt}</option>`;
                    });
                    html += '</select>';
                } else if (f.type === 'textarea') {
                    html += `<textarea class="form-control" name="dynamic_${fieldName}" rows="3" placeholder="${placeholder}" ${requiredAttr}></textarea>`;
                } else if (f.type === 'number') {
                    html += `<input type="number" class="form-control" name="dynamic_${fieldName}" placeholder="${placeholder}" ${requiredAttr}>`;
                } else {
                    html += `<input type="text" class="form-control" name="dynamic_${fieldName}" placeholder="${placeholder}" ${requiredAttr}>`;
                }
                
                html += '</div>';
            });
            
            html += '</div></div>';
            $dynamicFields.html(html);
            console.log('✅ 欄位渲染完成');
            
        } catch (e) {
            console.error('❌ 載入子分類欄位失敗:', e);
            $dynamicFields.html(`<div class="alert alert-danger">載入失敗: ${e.message}</div>`);
        }
    }

    // 監聽子分類選擇變化
    $(document).on('change', '#subcategory', function () {
        const catKey = $('#category').val();
        const subcats = $(this).val();
        if (catKey && subcats && subcats.length > 0) {
            loadDynamicFields(catKey, subcats);
        } else {
            $('#dynamicFields').empty();
        }
    });

    // 大分類選擇時自動載入子分類
    $(document).on('change', '#category', function () {
        var catKey = $(this).val();
        renderSubcategoryOptions(catKey);
    });

    // 頁面載入時初始化分類
    $(function () {
        renderCategoryOptions();
    });
(function ($) {
    "use strict";

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();
    
    
    // Initiate the wowjs
    new WOW().init();


    // Sticky Navbar
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.sticky-top').addClass('bg-white shadow-sm').css('top', '0px');
        } else {
            $('.sticky-top').removeClass('bg-white shadow-sm').css('top', '-150px');
        }
    });
    
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 100) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });


    // 移除 Header 轮播初始化（首頁已不再使用）


    // Testimonials carousel
    $(".testimonial-carousel").owlCarousel({
        items: 1,
        autoplay: true,
        smartSpeed: 1000,
        animateIn: 'fadeIn',
        animateOut: 'fadeOut',
        dots: true,
        loop: true,
        nav: false
    });
    


    // 兩階段流程：1. AI 辨識 2. 人工確認/編輯 3. 送出估價
    // 多圖預覽
    $(document).on('change', '#designImages', function () {
        const files = this.files;
        const $preview = $('#imagePreview');
        $preview.empty();
        if (!files || files.length === 0) return;
        Array.from(files).forEach(file => {
            const url = URL.createObjectURL(file);
            $preview.append(`<img src="${url}" alt="preview" style="width:100px;height:100px;object-fit:cover;border:1px solid #eee;border-radius:4px;" />`);
        });
    });

    $('#aiForm').on('submit', async function (e) {
        e.preventDefault();
        var formData = new FormData(this);
        
        const selectedCategory = $('#category').val();
        const subcats = $('#subcategory').val();
        
        if (!selectedCategory) {
            $('#aiResult').html('<div class="alert alert-warning">請選擇施作大分類。</div>');
            return;
        }
        if (!subcats || (Array.isArray(subcats) && subcats.length === 0)) {
            $('#aiResult').html('<div class="alert alert-warning">請至少選擇一個子分類。</div>');
            return;
        }
        
        formData.append('category', selectedCategory);
        
        if (subcats && subcats.length > 0) {
            formData.append('subcategories', JSON.stringify(subcats));
            formData.append('subcategory', subcats[0]);
        }
        
        let authHeader = {};
        try {
            var session = null;
            if (window.AuthService) {
                session = await AuthService.getSession();
            }
            if (!session && window.supabaseClient) {
                var res = await window.supabaseClient.auth.getSession();
                session = res.data && res.data.session ? res.data.session : null;
            }
            if (session && session.access_token) {
                var tok = 'Bearer ' + session.access_token;
                authHeader['Authorization'] = tok;
                authHeader['X-Auth-Token'] = session.access_token;
            }
        } catch (err) {
            console.warn('取得登入 token 失敗', err);
        }
        
        $('#aiResult').html('<div class="text-center">AI 分析中，請稍候...</div>');
        $.ajax({
            url: '/api/ai-detect',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: authHeader,
            beforeSend: function (xhr) {
                if (authHeader['Authorization']) {
                    xhr.setRequestHeader('Authorization', authHeader['Authorization']);
                }
                if (authHeader['X-Auth-Token']) {
                    xhr.setRequestHeader('X-Auth-Token', authHeader['X-Auth-Token']);
                }
            },
            success: function (res) {
                let headerInfo = '';
                if (res.project_id) {
                    currentProjectId = res.project_id; // 儲存專案 ID
                    headerInfo = `<div class="alert alert-success">
                        已建立專案記錄：ID ${res.project_id}
                        <a href="/client/project-detail.html?id=${res.project_id}" class="btn btn-sm btn-success ms-3">
                            <i class="fas fa-folder-open me-1"></i>前往專案管理
                        </a>
                    </div>`;
                }
                if (res.success && res.items && res.items.length > 0) {
                    let html = '<form id="quoteForm"><div class="table-responsive"><table class="table table-bordered mt-3"><thead><tr><th>項目</th><th>規格</th><th>數量</th><th>單位</th><th>刪除</th></tr></thead><tbody>';
                    res.items.forEach(function (item, idx) {
                        html += `<tr>
                            <td><input type="text" name="item_name" class="form-control" value="${item.item_name || ''}"></td>
                            <td><input type="text" name="spec" class="form-control" value="${item.spec || ''}"></td>
                            <td><input type="number" name="quantity" class="form-control" value="${item.quantity || ''}"></td>
                            <td><input type="text" name="unit" class="form-control" value="${item.unit || ''}"></td>
                            <td><button type="button" class="btn btn-sm btn-danger del-row">刪除</button></td>
                        </tr>`;
                    });
                    html += '</tbody></table></div>';
                    html += '<button type="button" class="btn btn-secondary mb-2" id="addRow">新增項目</button> ';
                    html += '<button type="submit" class="btn btn-primary"><i class="fas fa-save me-1"></i>儲存到專案</button></form>';
                    $('#aiResult').html(headerInfo + html);
                } else {
                    let noItemsMsg = '<div class="text-danger">AI 未辨識到任何項目，請調整提示詞或圖片</div>';
                    if (!res.project_id && window.AuthService) {
                        noItemsMsg += '<div class="alert alert-warning mt-2">儲存專案需先<strong>登入</strong>，請登入後重新點「AI 辨識項目」即可建立專案並儲存。</div>';
                    }
                    $('#aiResult').html(headerInfo + noItemsMsg);
                }
            },
            error: function (xhr) {
                let msg = '系統忙碌中，請稍後再試';
                let debug = '';
                if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                if (xhr.responseJSON && xhr.responseJSON.prompt) {
                    debug += `<details class='mt-2'><summary>顯示原始提示詞與 AI 回答</summary><div><b>Prompt：</b><pre style='white-space:pre-wrap;'>${xhr.responseJSON.prompt}</pre></div>`;
                }
                if (xhr.responseJSON && xhr.responseJSON.raw) {
                    debug += `<div><b>AI 回答：</b><pre style='white-space:pre-wrap;'>${xhr.responseJSON.raw}</pre></div></details>`;
                }
                $('#aiResult').html('<div class="text-danger">' + msg + '</div>' + debug);
            }
        });
    });

    // 動態表格：刪除/新增行
    $(document).on('click', '.del-row', function () {
        $(this).closest('tr').remove();
    });
    $(document).on('click', '#addRow', function () {
        let row = `<tr>
            <td><input type="text" name="item_name" class="form-control"></td>
            <td><input type="text" name="spec" class="form-control"></td>
            <td><input type="number" name="quantity" class="form-control"></td>
            <td><input type="text" name="unit" class="form-control"></td>
            <td><button type="button" class="btn btn-sm btn-danger del-row">刪除</button></td>
        </tr>`;
        $(this).closest('form').find('tbody').append(row);
    });

    // 送出估價（更新項目到專案）
    $(document).on('submit', '#quoteForm', function (e) {
        e.preventDefault();
        
        if (!currentProjectId) {
            alert('找不到專案 ID。請先登入後，重新點「AI 辨識項目」建立專案，再按儲存。');
            return;
        }

        let items = [];
        $('#quoteForm tbody tr').each(function () {
            let item = {
                item_name: $(this).find('input[name="item_name"]').val(),
                spec: $(this).find('input[name="spec"]').val(),
                quantity: parseFloat($(this).find('input[name="quantity"]').val()) || 0,
                unit: $(this).find('input[name="unit"]').val()
            };
            if (item.item_name) items.push(item);
        });
        
        if (items.length === 0) {
            $('#aiResult').append('<div class="text-danger mt-2">請至少輸入一個項目</div>');
            return;
        }

        $('#aiResult').append('<div class="text-center">儲存中，請稍候...</div>');
        
        // 直接更新項目到資料庫
        $.ajax({
            url: '/api/projects/update-items',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ 
                project_id: currentProjectId,
                items: items 
            }),
            success: function (res) {
                if (res.success) {
                    let html = `<div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        項目已儲存到專案！
                        <a href="/client/project-detail.html?id=${currentProjectId}" class="btn btn-sm btn-primary ms-3">
                            <i class="fas fa-folder-open me-1"></i>前往專案管理
                        </a>
                    </div>`;
                    $('#aiResult').html(html);
                } else {
                    $('#aiResult').append('<div class="text-danger mt-2">儲存失敗：' + (res.error || '未知錯誤') + '</div>');
                }
            },
            error: function (xhr) {
                $('#aiResult').append('<div class="text-danger mt-2">系統錯誤，請稍後再試</div>');
            }
        });
    });

})(jQuery);

