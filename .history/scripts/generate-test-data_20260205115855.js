/**
 * 測試數據生成腳本
 * 用途: 在本地測試時生成模擬的專案、報價、媒合數據
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // 使用 service role key 繞過 RLS
);

// 測試數據範本
const categories = ['網頁設計', '室內設計', 'Logo設計', 'APP開發', '影片剪輯', '平面設計', '行銷企劃', 'SEO優化'];

const projectTemplates = [
    { title: '公司形象網站設計', description: '需要設計一個專業的企業形象網站，包含首頁、關於我們、服務介紹、聯絡我們等頁面。', category: '網頁設計', budget: 80000 },
    { title: '電商平台開發', description: '建立完整的電商平台，需包含商品管理、購物車、金流串接等功能。', category: 'APP開發', budget: 300000 },
    { title: '品牌Logo設計', description: '為新創公司設計品牌Logo，需要3-5個提案，可修改3次。', category: 'Logo設計', budget: 15000 },
    { title: '辦公室室內設計', description: '約30坪的辦公室空間，需要規劃工作區、會議室和休息區。', category: '室內設計', budget: 250000 },
    { title: '產品宣傳影片', description: '拍攝並剪輯3分鐘的產品介紹影片，需包含腳本撰寫。', category: '影片剪輯', budget: 50000 },
    { title: '社群媒體廣告設計', description: '設計一系列FB/IG廣告圖片，共20張，含文案。', category: '平面設計', budget: 25000 },
    { title: 'SEO網站優化', description: '改善網站SEO，提升關鍵字排名，包含3個月的維護。', category: 'SEO優化', budget: 60000 },
    { title: '品牌行銷策略規劃', description: '制定完整的年度行銷策略，包含市場分析和執行計畫。', category: '行銷企劃', budget: 120000 }
];

const expertServices = [
    { title: '專業網站設計服務', description: '10年經驗，擅長RWD響應式設計，WordPress客製化', category: '網頁設計', base_price: 50000 },
    { title: '全端開發服務', description: 'React + Node.js 全端開發，API串接經驗豐富', category: 'APP開發', base_price: 200000 },
    { title: 'Logo設計與品牌識別', description: '提供完整品牌視覺設計，包含Logo、名片、信封等', category: 'Logo設計', base_price: 12000 },
    { title: '住宅/商業空間設計', description: '室內設計+工程統包，一條龍服務', category: '室內設計', base_price: 180000 },
    { title: '影片拍攝剪輯', description: '商業影片、活動紀錄、Youtube頻道經營', category: '影片剪輯', base_price: 30000 },
    { title: '平面設計接案', description: '海報、DM、名片、社群圖片設計', category: '平面設計', base_price: 3000 },
    { title: 'SEO顧問服務', description: 'Google排名優化，關鍵字研究，網站健檢', category: 'SEO優化', base_price: 40000 },
    { title: '行銷顧問諮詢', description: '數位行銷策略、廣告投放、數據分析', category: '行銷企劃', base_price: 80000 }
];

async function main() {
    console.log('🚀 開始生成測試數據...\n');

    try {
        // 1. 獲取當前用戶 (假設已登入)
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ 錯誤: 請先登入 Supabase');
            console.log('提示: 需要使用有效的用戶 token 或 service role key');
            return;
        }

        console.log(`✅ 使用用戶: ${user.email}\n`);

        // 2. 生成測試專案
        console.log('📦 生成測試專案...');
        const projects = [];
        
        for (let i = 0; i < 5; i++) {
            const template = projectTemplates[i % projectTemplates.length];
            const project = {
                owner_id: user.id,
                category: template.category,
                budget: template.budget + Math.floor(Math.random() * 20000),
                description: template.description,
                status: ['analyzing', 'matched', 'in_progress'][Math.floor(Math.random() * 3)],
                images: [],
                analysis: {
                    summary: template.title,
                    items: []
                },
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
            };

            const { data, error } = await supabase
                .from('projects')
                .insert(project)
                .select()
                .single();

            if (error) {
                console.error(`   ❌ 專案 ${i + 1} 建立失敗:`, error.message);
            } else {
                projects.push(data);
                console.log(`   ✅ 專案 ${i + 1}: ${template.title} (ID: ${data.id.substring(0, 8)}...)`);
            }
        }

        console.log(`\n✅ 成功建立 ${projects.length} 個測試專案\n`);

        // 3. 生成測試報價 (如果有 expert_listings 表)
        console.log('💼 檢查 expert_listings 表...');
        const { data: listings, error: listingsError } = await supabase
            .from('expert_listings')
            .select('id')
            .limit(1);

        if (listingsError) {
            console.log('   ℹ️  expert_listings 表不存在或無權限，跳過報價生成');
        } else {
            console.log('   ✅ 表存在，可以生成報價');
            // TODO: 生成測試報價
        }

        // 4. 顯示統計
        console.log('\n' + '='.repeat(50));
        console.log('📊 測試數據生成完成！');
        console.log('='.repeat(50));
        console.log(`總共建立: ${projects.length} 個專案`);
        console.log('\n💡 提示:');
        console.log('   - 訪問 http://localhost:3000/client/my-projects.html 查看專案列表');
        console.log('   - 訪問 http://localhost:3000/client/dashboard.html 查看控制台');
        console.log('   - 使用 project ID 測試 project-detail.html');
        console.log('\n');

        // 輸出第一個專案的 ID 供測試使用
        if (projects.length > 0) {
            console.log(`🔗 測試連結: http://localhost:3000/client/project-detail.html?id=${projects[0].id}`);
        }

    } catch (error) {
        console.error('❌ 發生錯誤:', error.message);
        console.error(error);
    }
}

// 執行腳本
if (require.main === module) {
    main().then(() => {
        console.log('\n✨ 腳本執行完成');
        process.exit(0);
    }).catch(error => {
        console.error('\n💥 腳本執行失敗:', error);
        process.exit(1);
    });
}

module.exports = { main };
