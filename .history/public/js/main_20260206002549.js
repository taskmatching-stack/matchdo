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
        if (cat && cat.sub) {
            cat.sub.forEach(function (sub) {
                $sub.append(`<option value="${sub}">${sub}</option>`);
            });
        }
    }

    // 大分類選擇時自動帶入預設提示詞與子分類
    $(document).on('change', '#category', function () {
        var catKey = $(this).val();
        var src = window.__AI_CATEGORIES_CACHE__ || [];
        var cat = src.find(c => c.key === catKey);
        if (cat) {
            $('#prompt').val(cat.prompt);
            renderSubcategoryOptions(catKey);
        }
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

    $('#aiForm').on('submit', function (e) {
        e.preventDefault();
        var formData = new FormData(this);
        
        // 取得選中的分類與子分類
        const selectedCategory = $('#category').val();
        const subcats = $('#subcategory').val();
        
        if (selectedCategory) {
            formData.append('category', selectedCategory);
        }
        
        // 將多選子分類合併進 formData（用於專案標記）
        if (subcats && subcats.length > 0) {
            formData.append('subcategories', JSON.stringify(subcats));
            // 傳第一個子分類給 AI 提示詞使用
            formData.append('subcategory', subcats[0]);
        }
        
        $('#aiResult').html('<div class="text-center">AI 分析中，請稍候...</div>');
        $.ajax({
            url: '/api/ai-detect',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
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
                    $('#aiResult').html(headerInfo + '<div class="text-danger">AI 未辨識到任何項目，請調整提示詞或圖片</div>');
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
        
        // 如果沒有專案 ID（例如 Server 因 RLS 建立失敗），嘗試前端建立
        if (!currentProjectId) {
            try {
                // 1. 檢查登入
                if (!window.AuthService || !window.supabaseClient) {
                    alert('系統錯誤：認證服務未載入');
                    return;
                }
                const user = await AuthService.getCurrentUser();
                if (!user) {
                    if (confirm('儲存專案需要登入會員，是否前往登入/註冊？')) {
                        // 儲存當前資料到 LocalStorage 以便回來後恢復 (TODO)
                        window.location.href = '/login.html';
                    }
                    return;
                }

                // 2. 建立專案
                $('#aiResult').append('<div class="text-info mt-2" id="temp-creating">正在建立新專案...</div>');
                
                const title = $('#category option:selected').text() + ' - AI 估價';
                const promptVal = $('#prompt').val();
                
                const { data, error } = await supabaseClient
                    .from('projects')
                    .insert({ 
                        title: title, 
                        description: JSON.stringify({ prompt: promptVal, source: 'client-ai', items: items }), // 同步將 items 存入 description 以備份
                        status: 'editing',
                        owner_id: user.id,  // 修正：使用 owner_id
                        // analysis: { items: items } // 同步存入 analysis 欄位
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

