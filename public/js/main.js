(function ($) {
    "use strict";

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
            
            // 收集所有選中的子分類的欄位（保留子分類信息）
            const allFields = {};
            subcats.forEach(subName => {
                const subData = data.subcategories.find(s => s.name === subName);
                if (subData && subData.form_config) {
                    subData.form_config.forEach(field => {
                        const key = field.name || field.label;
                        if (!allFields[key]) {
                            allFields[key] = { ...field, _subcategory: subName }; // 記錄子分類
                        }
                    });
                }
            });
            
            // 渲染欄位
            const fields = Object.values(allFields);
            
            if (fields.length === 0) {
                return;
            }
            
            let html = '<div class="border-top pt-3 mb-3"><h6 class="text-primary mb-3"><i class="fas fa-clipboard-list me-2"></i>專案基本資訊</h6><div class="row">';
            
            fields.forEach(f => {
                const fieldName = f.name || (f.label || '').replace(/\s+/g, '_');
                const requiredAttr = f.required ? 'required' : '';
                const requiredBadge = f.required ? ' <span class="text-danger">*</span>' : '';
                const placeholder = f.placeholder || '';
                const unitText = f.unit ? ` (${f.unit})` : '';
                const subAttr = f._subcategory ? ` data-subcategory="${f._subcategory}"` : '';
                
                html += '<div class="col-md-6 mb-3">';
                html += `<label class="form-label">${f.label}${unitText}${requiredBadge}</label>`;
                
                if (f.type === 'select') {
                    html += `<select class="form-select" name="dynamic_${fieldName}"${subAttr} ${requiredAttr}>`;
                    html += '<option value="">請選擇</option>';
                    (f.options || []).forEach(opt => {
                        html += `<option value="${opt}">${opt}</option>`;
                    });
                    html += '</select>';
                } else if (f.type === 'textarea') {
                    html += `<textarea class="form-control" name="dynamic_${fieldName}"${subAttr} rows="3" placeholder="${placeholder}" ${requiredAttr}></textarea>`;
                } else if (f.type === 'number') {
                    html += `<input type="number" class="form-control" name="dynamic_${fieldName}"${subAttr} placeholder="${placeholder}" step="0.01" ${requiredAttr}>`;
                } else if (f.type === 'date') {
                    html += `<input type="date" class="form-control" name="dynamic_${fieldName}"${subAttr} ${requiredAttr}>`;
                } else {
                    html += `<input type="text" class="form-control" name="dynamic_${fieldName}"${subAttr} placeholder="${placeholder}" ${requiredAttr}>`;
                }
                
                html += '</div>';
            });
            
            html += '</div></div>';
            $dynamicFields.html(html);
            
            // 確保所有欄位都可以編輯
            $dynamicFields.find('input, select, textarea').prop('disabled', false).prop('readonly', false);
            
        } catch (e) {
            console.error('❌ 載入子分類欄位失敗:', e);
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

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();
    
    
    // Initiate the wowjs（若頁面有載入 WOW 才執行，避免 contact-info 等頁報錯）
    if (typeof WOW !== 'undefined') { new WOW().init(); }


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

        // 取得選中的分類與子分類
        const selectedCategory = $('#category').val();
        const subcats = $('#subcategory').val() || [];

        // 驗證必填
        if (!selectedCategory) {
            $('#aiResult').html('<div class="alert alert-warning">請選擇施作大分類。</div>');
            return;
        }
        if (!subcats || subcats.length === 0) {
            $('#aiResult').html('<div class="alert alert-warning">請至少選擇一個子分類。</div>');
            return;
        }
        
        // 檢查是否有上傳圖片或填寫描述（至少要有一個）
        const files = document.getElementById('designImages').files;
        const userDesc = $('#userDescription').val().trim();
        
        if (!files.length && !userDesc) {
            $('#aiResult').html('<div class="alert alert-warning">請至少上傳一張設計圖或填寫需求描述。</div>');
            return;
        }
        
        // 驗證專案地點
        const projectLocation = $('#projectLocation').val();
        if (!projectLocation) {
            $('#aiResult').html('<div class="alert alert-warning">請選擇專案地點。</div>');
            return;
        }

        var formData = new FormData(this);
        
        formData.append('category', selectedCategory);
        
        // 將多選子分類合併進 formData（用於專案標記）
        if (subcats && subcats.length > 0) {
            formData.append('subcategories', JSON.stringify(subcats));
            // 傳第一個子分類給 AI 提示詞使用
            formData.append('subcategory', subcats[0]);
        }
        
        // 收集動態欄位（按子分類分組）並作為 JSON 發送
        const dynamicData = {};
        $('#dynamicFields').find('input, select, textarea').each(function() {
            const name = $(this).attr('name');
            const subcategory = $(this).data('subcategory');
            if (name && name.startsWith('dynamic_') && subcategory) {
                const labelText = $(this).closest('.col-md-6').find('label').text().split('(')[0].trim().replace(' *', '');
                
                if (!dynamicData[subcategory]) {
                    dynamicData[subcategory] = {};
                }
                dynamicData[subcategory][labelText] = $(this).val();
            }
        });
        formData.append('dynamic_fields_json', JSON.stringify(dynamicData));
        
        // 取得登入token - 多重方式確保取得
        let authHeader = {};
        let tokenFound = false;
        
        try {
            // 方式1: 從 AuthService
            if (window.AuthService) {
                const session = await AuthService.getSession();
                if (session && session.access_token) {
                    authHeader['Authorization'] = 'Bearer ' + session.access_token;
                    authHeader['X-Auth-Token'] = session.access_token;
                    tokenFound = true;
                }
            }
            
            // 方式2: 從 supabaseClient (如果方式1失敗)
            if (!tokenFound && window.supabaseClient) {
                const { data } = await window.supabaseClient.auth.getSession();
                if (data && data.session && data.session.access_token) {
                    authHeader['Authorization'] = 'Bearer ' + data.session.access_token;
                    authHeader['X-Auth-Token'] = data.session.access_token;
                    tokenFound = true;
                }
            }
            
            // 方式3: 從 localStorage (最後手段)
            if (!tokenFound) {
                const stored = localStorage.getItem('supabase.auth.token');
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed && parsed.access_token) {
                            authHeader['Authorization'] = 'Bearer ' + parsed.access_token;
                            authHeader['X-Auth-Token'] = parsed.access_token;
                            tokenFound = true;
                        }
                    } catch (e) {}
                }
            }
        } catch (err) {
            console.error('取得 token 失敗:', err);
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
            success: async function (res) {
                let headerInfo = '';
                
                // 如果後端沒返回 project_id，前端立即創建
                if (!res.project_id && window.supabaseClient) {
                    try {
                        const user = await AuthService.getCurrentUser();
                        if (user) {
                            const categoryVal = $('#category').val();
                            const subcategoryVal = $('#subcategory').val() || [];
                            
                            // 收集動態欄位（按子分類分組）
                            const dynamicData = {};
                            $('#dynamicFields').find('input, select, textarea').each(function() {
                                const name = $(this).attr('name');
                                const subcategory = $(this).data('subcategory');
                                if (name && name.startsWith('dynamic_') && subcategory) {
                                    const labelText = $(this).closest('.col-md-6').find('label').text().split('(')[0].trim().replace(' *', '');
                                    
                                    if (!dynamicData[subcategory]) {
                                        dynamicData[subcategory] = {};
                                    }
                                    dynamicData[subcategory][labelText] = $(this).val();
                                }
                            });
                            
                            const { data, error } = await supabaseClient
                                .from('projects')
                                .insert({ 
                                    title: $('#category option:selected').text() + ' - AI 估價',
                                    category: categoryVal,
                                    status: 'draft',
                                    owner_id: user.id,
                                    subcategory: subcategoryVal,
                                    description: JSON.stringify({ 
                                        items: res.items || [],
                                        dynamic_fields: dynamicData
                                    })
                                })
                                .select()
                                .single();
                            
                            if (!error && data) {
                                res.project_id = data.id;
                            }
                        }
                    } catch (e) {}
                }
                
                if (res.project_id) {
                    currentProjectId = res.project_id; // 儲存專案 ID
                    headerInfo = `<div class="alert alert-success">
                        已建立專案記錄：ID ${res.project_id}
                        <a href="/client/project-detail.html?id=${res.project_id}" class="btn btn-sm btn-success ms-3">
                            <i class="fas fa-folder-open me-1"></i>前往專案管理
                        </a>
                    </div>`;
                }
                // 上傳的設計圖預覽與網址（後端回傳 uploaded_files）
                let uploadedFilesHtml = '';
                if (res.uploaded_files && res.uploaded_files.length > 0) {
                    uploadedFilesHtml = '<div class="card mb-3"><div class="card-header py-2"><small class="text-muted"><i class="fas fa-images me-1"></i>已上傳的設計圖（可複製網址）</small></div><div class="card-body py-2"><div class="row g-2">' +
                        res.uploaded_files.map(function (f, i) {
                            var url = (f.url || f).toString();
                            var name = (f.filename || '圖片' + (i + 1)).toString();
                            return '<div class="col-6 col-md-4"><div class="border rounded p-2"><img src="' + url + '" class="img-fluid rounded" style="height:80px;object-fit:cover;" alt="' + name + '" onerror="this.style.background=\'#eee\'"><small class="d-block text-truncate mt-1" title="' + name + '">' + name + '</small><div class="input-group input-group-sm mt-1"><input type="text" class="form-control" value="' + url + '" readonly id="homeFileUrl' + i + '"><button class="btn btn-outline-secondary btn-sm" type="button" onclick="navigator.clipboard.writeText(document.getElementById(\'homeFileUrl' + i + '\').value);this.textContent=\'已複製\'">複製</button></div></div></div>';
                        }).join('') +
                        '</div></div></div>';
                }
                if (res.success && res.items && res.items.length > 0) {
                    // 清空舊內容，避免重複
                    $('#aiResult').empty();
                    
                    let html = headerInfo + uploadedFilesHtml + '<form id="quoteForm"><div class="table-responsive"><table class="table table-bordered mt-3"><thead><tr><th>項目</th><th>規格</th><th>數量</th><th>單位</th><th>刪除</th></tr></thead><tbody>';
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
                    $('#aiResult').html(html);
                } else {
                    let noItemsMsg = '<div class="text-danger">AI 未辨識到任何項目，請調整提示詞或圖片</div>';
                    if (!res.project_id && window.AuthService) {
                        noItemsMsg += '<div class="alert alert-warning mt-2">儲存專案需先<strong>登入</strong>，請登入後重新點「AI 辨識項目」即可建立專案並儲存。</div>';
                    }
                    $('#aiResult').html(headerInfo + uploadedFilesHtml + noItemsMsg);
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
    $(document).on('submit', '#quoteForm', async function (e) {
        e.preventDefault();
        
        if (!currentProjectId) {
            alert('找不到專案 ID。請先登入後，重新點「AI 辨識項目」建立專案，再按儲存。');
            return;
        }
        
        // 防止重複提交
        const submitBtn = $(this).find('button[type="submit"]');
        if (submitBtn.prop('disabled')) return;
        submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>處理中...');

        // 先讀取表格項目
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
        
        // 收集動態欄位數據（所有 name 以 dynamic_ 開頭的欄位）
        const dynamicData = {};
        $('#dynamicFields input, #dynamicFields select, #dynamicFields textarea').each(function() {
            const $field = $(this);
            const name = $field.attr('name');
            const val = $field.val();
            if (name && name.startsWith('dynamic_') && val) {
                // 將 dynamic_xxx 轉換為欄位名稱
                const fieldLabel = name.replace('dynamic_', '').replace(/_/g, ' ');
                if (!dynamicData['default']) dynamicData['default'] = {};
                dynamicData['default'][fieldLabel] = val;
            }
        });
        
        // 如果沒有專案 ID（例如 Server 因 RLS 建立失敗），嘗試前端建立
        if (!currentProjectId) {
            try {
                // 1. 檢查登入
                if (!window.AuthService || !window.supabaseClient) {
                    alert('系統錯誤：認證服務未載入');
                    submitBtn.prop('disabled', false).text('儲存到專案');
                    return;
                }
                const user = await AuthService.getCurrentUser();
                if (!user) {
                    if (confirm('儲存專案需要登入會員，是否前往登入/註冊？')) {
                        window.location.href = (window.AuthService && typeof AuthService.getLoginUrl === 'function') ? AuthService.getLoginUrl() : '/login.html';
                    }
                    submitBtn.prop('disabled', false).text('儲存到專案');
                    return;
                }

                // 2. 建立專案
                $('#aiResult').append('<div class="text-info mt-2" id="temp-creating">正在建立新專案...</div>');
                
                const title = $('#category option:selected').text() + ' - AI 估價';
                const categoryVal = $('#category option:selected').text();
                const subcategoryVal = $('#subcategory').val() || [];
                const promptVal = $('#prompt').val();
                const userDescription = $('#projectDescriptionInput').val();
                
                const { data, error } = await supabaseClient
                    .from('projects')
                    .insert({ 
                        title: title,
                        category: categoryVal,
                        status: 'draft',
                        owner_id: user.id,
                        // 寫入新欄位 (如果已建立)
                        items: items,
                        subcategory: subcategoryVal,
                        // 同時保留 description 作為備份與舊版相容
                        description: JSON.stringify({ 
                            prompt: promptVal, 
                            user_description: userDescription,
                            dynamic_fields: dynamicData, // 儲存動態欄位數值
                            source: 'client-ai', 
                            items: items,
                            subcategory: subcategoryVal
                        })
                    })
                    .select()
                    .single();

                $('#temp-creating').remove();

                if (error) {
                    console.error('Client create project error:', error);
                    alert('建立專案失敗：' + error.message);
                    return;
                }

                if (data) {
                    currentProjectId = data.id;
                    // 更新 UI 顯示專案 ID
                    const headerInfo = `<div class="alert alert-success">
                        已補建專案記錄：ID ${data.id}
                        <a href="/client/project-detail.html?id=${data.id}" class="btn btn-sm btn-success ms-3">
                            <i class="fas fa-folder-open me-1"></i>前往專案管理
                        </a>
                    </div>`;
                    $('#aiResult').prepend(headerInfo);
                }
                
            } catch (err) {
                console.error('建立專案詳細錯誤:', err);
                alert('建立專案發生錯誤: ' + (err.message || JSON.stringify(err)));
                return;
            }
        }

        if (!currentProjectId) {
            alert('找不到專案 ID，且無法自動建立');
            return;
        }

        // let items = [];  <-- 已經在上面定義過了，移除這段重複代碼
        // $('#quoteForm tbody tr').each(function () { ...
        
        /* 
           移除原本在此處的 items 讀取邏輯，改用上面已定義的 items
        */

        $('#aiResult').append('<div class="text-center">儲存中，請稍候...</div>');
        
        // 直接使用前端 Supabase Client 更新項目，避免後端 RLS 權限問題
        try {
            // 先取得目前的 description 以便合併
            const { data: currentProject, error: fetchError } = await supabaseClient
                .from('projects')
                .select('description')
                .eq('id', currentProjectId)
                .single();

            if (fetchError) throw fetchError;

            let currentDescription = {};
            try {
                currentDescription = JSON.parse(currentProject.description || '{}');
            } catch(e) {}

            const newDescription = {
                ...currentDescription,
                items: items,
                dynamic_fields: dynamicData // 更新動態欄位數值
            };

            const { error: updateError } = await supabaseClient
                .from('projects')
                .update({ 
                    items: items, // 同步更新新欄位
                    description: JSON.stringify(newDescription),
                    status: 'draft' // 確保狀態為 draft
                })
                .eq('id', currentProjectId);

            if (updateError) throw updateError;

            // 成功
            let html = `<div class="alert alert-success mt-3 shadow-sm border-2">
                <div class="d-flex align-items-center">
                    <i class="fas fa-check-circle fa-2x me-3"></i>
                    <div>
                        <h5 class="mb-1">專案已成功建立草稿！</h5>
                        <p class="mb-2">您的資料已儲存。請前往「我的專案」進行工項細調並發佈專案。</p>
                        <a href="/client/my-projects.html" class="btn btn-primary">
                            <i class="fas fa-list-ul me-1"></i>前往「我的專案」細調與發佈
                        </a>
                    </div>
                </div>
            </div>`;
            $('#aiResult').html(html);

        } catch (err) {
            console.error('儲存失敗:', err);
            $('#aiResult').append('<div class="text-danger mt-2">儲存失敗：' + (err.message || '未知錯誤') + '</div>');
        }
    });

    // 直接儲存按鈕（不調用 AI）
    $('#directSaveBtn').on('click', async function() {
        console.log('🟢 直接儲存按鈕被點擊');
        try {
            // 檢查登入
            const user = await AuthService.getCurrentUser();
            console.log('👤 當前用戶:', user);
            if (!user) {
                $('#aiResult').html('<div class="alert alert-danger">請先登入</div>');
                return;
            }

            // 收集表單數據
            const categoryVal = $('#category').val();
            const subcategoryVal = $('#subcategory').val() || [];
            
            if (!categoryVal || subcategoryVal.length === 0) {
                $('#aiResult').html('<div class="alert alert-warning">請選擇分類和子分類</div>');
                return;
            }

            // 收集動態欄位（按子分類分組）
            const dynamicData = {};
            $('#dynamicFields').find('input, select, textarea').each(function() {
                const name = $(this).attr('name');
                if (name && name.startsWith('dynamic_')) {
                    const subcategory = $(this).data('subcategory');
                    const labelText = $(this).closest('.col-md-6').find('label').text().split('(')[0].trim().replace(' *', '');
                    
                    if (subcategory) {
                        // 按子分類分組
                        if (!dynamicData[subcategory]) {
                            dynamicData[subcategory] = {};
                        }
                        dynamicData[subcategory][labelText] = $(this).val();
                    } else {
                        // 如果沒有子分類屬性，使用第一個子分類
                        const firstSub = subcategoryVal[0];
                        if (firstSub) {
                            if (!dynamicData[firstSub]) {
                                dynamicData[firstSub] = {};
                            }
                            dynamicData[firstSub][labelText] = $(this).val();
                        }
                    }
                }
            });
            
            // 收集專案地點
            const projectLocation = $('#projectLocation').val();
            
            if (!projectLocation) {
                $('#aiResult').html('<div class="alert alert-warning">請選擇專案地點</div>');
                return;
            }

            console.log('📦 收集到的動態數據:', dynamicData);
            console.log('📍 專案地點:', projectLocation);
            $('#aiResult').html('<div class="alert alert-info">正在儲存...</div>');

            // 直接創建專案
            const { data, error } = await supabaseClient
                .from('projects')
                .insert({ 
                    title: $('#category option:selected').text() + ' - 草稿',
                    category: categoryVal,
                    status: 'draft',
                    owner_id: user.id,
                    subcategory: subcategoryVal,
                    project_location: [projectLocation], // 陣列格式
                    description: JSON.stringify({ 
                        dynamic_fields: dynamicData
                    })
                })
                .select()
                .single();
            
            if (error) {
                throw error;
            }
            
            // 成功
            currentProjectId = data.id;
            let html = `<div class="alert alert-success mt-3 shadow-sm border-2">
                <div class="d-flex align-items-center">
                    <i class="fas fa-check-circle fa-2x me-3"></i>
                    <div>
                        <h5 class="mb-1">✅ 專案已成功建立！</h5>
                        <p class="mb-2">專案 ID: ${data.id}</p>
                        <a href="/client/project-detail.html?id=${data.id}" class="btn btn-primary">
                            <i class="fas fa-folder-open me-1"></i>查看專案
                        </a>
                    </div>
                </div>
            </div>`;
            $('#aiResult').html(html);

        } catch (err) {
            console.error('直接儲存失敗:', err);
            $('#aiResult').html('<div class="alert alert-danger">儲存失敗：' + (err.message || '未知錯誤') + '</div>');
        }
    });

})(jQuery);

