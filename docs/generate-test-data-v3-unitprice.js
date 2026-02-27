// ============================================
// 測試數據生成腳本 V3 - 單價版本
// 用途：生成正確的單價測試數據
// 更新：2026-02-06
// 重要：所有 listings.price_min/max 都是單價
// ============================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(
    process.env.SUPABASE_URL,
    SUPABASE_KEY
);

// ==================== 台灣縣市 ====================
const taiwanCities = [
    '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'
];

// ==================== 常見單位定義 ====================
const UNITS = {
    interior: '坪',         // 室內設計
    carpentry: '組',        // 木工（系統櫃、家具）
    painting: 'm²',         // 油漆
    plumbing: '次',         // 水電
    video: '秒',            // 影片（以秒計價）
    web: '頁',              // 網站（以頁計價）
    app: '功能',            // APP（以功能計價）
    design: '件',           // 平面設計
    marketing: '月'         // 數位行銷（以月計價）
};

// ==================== 生成專家數據 ====================
function generateExperts() {
    const experts = [];
    const VERSION = 'v3'; // 新版本

    // ========================================
    // 第一部分：居家裝潢類 (20位簡化版)
    // ========================================
    
    // 室內設計師 (6位) - 單價/坪
    const interiorDesigners = [
        { city: '台北市', name: '陳設計師', style: '現代簡約', unitPrice: [2500, 3500], tags: ['室內設計', '現代風格', '3D圖面'] },
        { city: '新北市', name: '王設計', style: '小坪數', unitPrice: [2200, 3000], tags: ['室內設計', '小坪數', '空間規劃'] },
        { city: '台中市', name: '江設計師', style: '日式無印', unitPrice: [2400, 3200], tags: ['室內設計', '日式風格', '簡約'] },
        { city: '台南市', name: '李設計', style: '工業風', unitPrice: [2300, 3100], tags: ['室內設計', '工業風', '老屋改造'] },
        { city: '高雄市', name: '張設計', style: '現代奢華', unitPrice: [3000, 4500], tags: ['室內設計', '奢華', '豪宅'] },
        { city: '桃園市', name: '劉統包', style: '全室統包', unitPrice: [2800, 4000], tags: ['統包', '一條龍', '室內設計', '木工', '油漆'] }
    ];

    interiorDesigners.forEach((d, i) => {
        experts.push({
            email: `expert.interior${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: d.name,
            specialty: 'home',
            experience_years: 5 + Math.floor(Math.random() * 10),
            description: `專業室內設計師，擅長${d.style}設計`,
            service_areas: [d.city],
            listings: [{
                title: `${d.style}室內設計`,
                category: 'home',
                subcategory: 'home__interior_design',
                price_min: d.unitPrice[0],
                price_max: d.unitPrice[1],
                unit: UNITS.interior,
                delivery_days: 30,
                description: `專長${d.style}設計。【單價 $${d.unitPrice[0]}-${d.unitPrice[1]}/坪】`,
                service_location: [d.city],
                is_remote: false,
                tags: d.tags
            }]
        });
    });

    // 木工師傅 (6位) - 單價/組（系統櫃）
    const carpenters = [
        { city: '新北市', specialty: '系統櫃', unitPrice: [8000, 15000], tags: ['木工', '系統櫃', '收納'] },
        { city: '台中市', specialty: '實木家具', unitPrice: [10000, 20000], tags: ['木工', '實木家具', '客製化'] },
        { city: '高雄市', specialty: '木作裝潢', unitPrice: [9000, 18000], tags: ['木工', '木作', '裝潢'] },
        { city: '桃園市', specialty: '客製化家具', unitPrice: [8500, 16000], tags: ['木工', '客製化', '家具'] },
        { city: '台北市', specialty: '系統櫃', unitPrice: [9500, 17000], tags: ['木工', '系統櫃', '收納'] },
        { city: '台南市', specialty: '木地板', unitPrice: [150, 300], tags: ['木工', '木地板', '施工'] }
    ];

    carpenters.forEach((c, i) => {
        const unit = c.specialty === '木地板' ? 'm²' : UNITS.carpentry;
        experts.push({
            email: `expert.carpenter${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `林木工${i + 1}`,
            specialty: 'home',
            experience_years: 5 + Math.floor(Math.random() * 8),
            description: `專業木工師傅，擅長${c.specialty}`,
            service_areas: [c.city],
            listings: [{
                title: `${c.specialty}服務`,
                category: 'home',
                subcategory: 'home__carpentry',
                price_min: c.unitPrice[0],
                price_max: c.unitPrice[1],
                unit: unit,
                delivery_days: 15,
                description: `提供專業${c.specialty}服務。【單價 $${c.unitPrice[0]}-${c.unitPrice[1]}/${unit}】`,
                service_location: [c.city],
                is_remote: false,
                tags: c.tags
            }]
        });
    });

    // 油漆工程 (4位) - 單價/m²
    const painters = [
        { city: '台北市', unitPrice: [120, 250], tags: ['油漆', '粉刷', '刮除'] },
        { city: '台中市', unitPrice: [100, 220], tags: ['油漆', '防水', '修補'] },
        { city: '高雄市', unitPrice: [90, 200], tags: ['油漆', '噴漆', '牆面'] },
        { city: '新北市', unitPrice: [110, 230], tags: ['油漆', '室內', '外牆'] }
    ];

    painters.forEach((p, i) => {
        experts.push({
            email: `expert.painter${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `黃油漆${i + 1}`,
            specialty: 'home',
            experience_years: 5 + Math.floor(Math.random() * 6),
            description: `專業油漆師傅，品質保證`,
            service_areas: [p.city],
            listings: [{
                title: `油漆工程`,
                category: 'home',
                subcategory: 'home__painting',
                price_min: p.unitPrice[0],
                price_max: p.unitPrice[1],
                unit: UNITS.painting,
                delivery_days: 10,
                description: `提供專業油漆工程。【單價 $${p.unitPrice[0]}-${p.unitPrice[1]}/m²】`,
                service_location: [p.city],
                is_remote: false,
                tags: p.tags
            }]
        });
    });

    // 水電工程 (4位) - 單價/次（以案計價）
    const plumbers = [
        { city: '台北市', unitPrice: [3000, 8000], tags: ['水電', '維修', '安裝'] },
        { city: '台中市', unitPrice: [2500, 7000], tags: ['水電', '配線', '檢修'] },
        { city: '高雄市', unitPrice: [2800, 7500], tags: ['水電', '管路', '更換'] },
        { city: '新北市', unitPrice: [2700, 7800], tags: ['水電', '抓漏', '修繕'] }
    ];

    plumbers.forEach((p, i) => {
        experts.push({
            email: `expert.plumber${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `吳水電${i + 1}`,
            specialty: 'home',
            experience_years: 5 + Math.floor(Math.random() * 7),
            description: `專業水電師傅，快速到府`,
            service_areas: [p.city],
            listings: [{
                title: `水電工程`,
                category: 'home',
                subcategory: 'home__electrical',  // 修正：使用正確的 key
                price_min: p.unitPrice[0],
                price_max: p.unitPrice[1],
                unit: UNITS.plumbing,
                delivery_days: 5,
                description: `提供專業水電服務。【單價 $${p.unitPrice[0]}-${p.unitPrice[1]}/次】`,
                service_location: [p.city],
                is_remote: false,
                tags: p.tags
            }]
        });
    });

    // ========================================
    // 第二部分：影片製作 (6位)
    // ========================================
    
    const videoExperts = [
        { city: '台北市', name: '小明', unitPrice: [80, 200], tags: ['影片', '企業形象', '動畫'] },
        { city: '新北市', name: '阿華', unitPrice: [60, 150], tags: ['影片', '活動記錄', '剪輯'] },
        { city: '台中市', name: '小美', unitPrice: [70, 180], tags: ['影片', '產品介紹', '攝影'] },
        { city: '高雄市', name: '阿強', unitPrice: [65, 160], tags: ['影片', '廣告', '後製'] },
        { city: '桃園市', name: '小李', unitPrice: [75, 190], tags: ['影片', '微電影', '腳本'] },
        { city: '台南市', name: '阿傑', unitPrice: [70, 170], tags: ['影片', '婚禮', '空拍'] }
    ];

    videoExperts.forEach((v, i) => {
        experts.push({
            email: `expert.video${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: v.name,
            specialty: 'video',
            experience_years: 3 + Math.floor(Math.random() * 5),
            description: `專業影片製作，經驗豐富`,
            service_areas: [v.city],
            listings: [{
                title: `影片製作服務`,
                category: 'video',
                subcategory: 'video__corporate',
                price_min: v.unitPrice[0],
                price_max: v.unitPrice[1],
                unit: UNITS.video,
                delivery_days: 20,
                description: `提供專業影片製作。【單價 $${v.unitPrice[0]}-${v.unitPrice[1]}/秒】`,
                service_location: [v.city],
                is_remote: true,
                tags: v.tags
            }]
        });
    });

    // ========================================
    // 第三部分：網站開發 (6位)
    // ========================================
    
    const webExperts = [
        { name: '技術總監', unitPrice: [5000, 15000], tags: ['網站', 'RWD', 'SEO'] },
        { name: '前端工程師', unitPrice: [4000, 12000], tags: ['網站', 'React', 'Vue'] },
        { name: '全端工程師', unitPrice: [6000, 18000], tags: ['網站', 'Node.js', '資料庫'] },
        { name: 'UI設計師', unitPrice: [3000, 10000], tags: ['網站', 'UI設計', 'Figma'] },
        { name: '後端工程師', unitPrice: [5500, 16000], tags: ['網站', 'API', '伺服器'] },
        { name: '系統架構師', unitPrice: [8000, 25000], tags: ['網站', '架構設計', '雲端'] }
    ];

    webExperts.forEach((w, i) => {
        experts.push({
            email: `expert.web${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: w.name,
            specialty: 'web',
            experience_years: 4 + Math.floor(Math.random() * 6),
            description: `專業網站開發，技術扎實`,
            service_areas: ['全台'],
            listings: [{
                title: `網站開發服務`,
                category: 'web',
                subcategory: 'web__corporate',
                price_min: w.unitPrice[0],
                price_max: w.unitPrice[1],
                unit: UNITS.web,
                delivery_days: 30,
                description: `提供專業網站開發。【單價 $${w.unitPrice[0]}-${w.unitPrice[1]}/頁】`,
                service_location: ['全台'],
                is_remote: true,
                tags: w.tags
            }]
        });
    });

    return experts;
}

// ==================== 建立測試專家 ====================
async function createTestExperts() {
    const experts = generateExperts();
    const expertIds = [];
    
    console.log(`準備建立 ${experts.length} 位測試專家（V3 單價版本）...`);
    
    for (const expert of experts) {
        try {
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: expert.email,
                password: expert.password,
                email_confirm: true
            });
            
            if (authError) {
                console.log(`   ❌ ${expert.full_name}: ${authError.message}`);
                continue;
            }
            
            if (!authData || !authData.user) {
                console.log(`   ❌ ${expert.full_name}: authData 或 user 為空`);
                continue;
            }
            
            const userId = authData.user.id;
            expertIds.push({ userId, data: expert });
            
            await supabase.from('users').insert({
                id: userId,
                email: expert.email,
                full_name: expert.full_name
            });
            
            await supabase.from('experts_profile').insert({
                user_id: userId,
                specialty: expert.specialty,
                experience_years: expert.experience_years,
                description: expert.description,
                service_areas: expert.service_areas,
                verification_status: 'verified'
            });
            
            await supabase.from('contact_info').insert({
                user_id: userId,
                phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
                email: expert.email,
                line_id: `line_${expert.full_name}`,
                phone_visible: true,
                email_visible: true,
                line_visible: true
            });
            
            const firstListing = expert.listings[0];
            console.log(`   ✅ ${expert.full_name} (${firstListing.title} - $${firstListing.price_min}-${firstListing.price_max}/${firstListing.unit})`);
            
        } catch (error) {
            console.log(`   ❌ ${expert.full_name}: ${error.message}`);
        }
    }
    
    return expertIds;
}

// ==================== 建立專家報價 ====================
async function createListings(expertIds) {
    let totalListings = 0;
    
    for (const expert of expertIds) {
        try {
            const listingsData = expert.data.listings;
            
            for (const listingData of listingsData) {
                const { error } = await supabase.from('listings').insert({
                    expert_id: expert.userId,
                    title: listingData.title,
                    category: listingData.category,
                    subcategory: listingData.subcategory,
                    description: listingData.description,
                    price_min: listingData.price_min,
                    price_max: listingData.price_max,
                    unit: listingData.unit,
                    delivery_days: listingData.delivery_days,
                    service_location: listingData.service_location,
                    is_remote: listingData.is_remote,
                    status: 'active',
                    tags: listingData.tags,
                    images: []
                });
                
                if (error) {
                    console.log(`   ❌ ${expert.data.full_name} - ${listingData.title}: ${error.message}`);
                } else {
                    console.log(`   ✅ ${listingData.title} ($${listingData.price_min}-${listingData.price_max}/${listingData.unit})`);
                    totalListings++;
                }
            }
            
        } catch (error) {
            console.log(`   ❌ ${expert.data.full_name}: ${error.message}`);
        }
    }
    
    return totalListings;
}

// ==================== 生成測試項目 ====================
async function createTestProjects() {
    console.log('\n📋 建立測試發案項目...');
    
    // 創建一個測試客戶
    const clientEmail = `test.client.v3@matchdo.test`;
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: clientEmail,
        password: 'Test1234!',
        email_confirm: true
    });
    
    if (authError) {
        console.log(`   ❌ 建立客戶失敗: ${authError.message}`);
        return;
    }
    
    const clientId = authData.user.id;
    
    await supabase.from('users').insert({
        id: clientId,
        email: clientEmail,
        full_name: '測試客戶'
    });
    
    // 建立專案
    const { data: projectData, error: projectError } = await supabase.from('projects').insert({
        owner_id: clientId,  // 修正：使用 owner_id 而不是 client_id
        title: '30坪新家裝潢',
        description: '現代簡約風格，包含室內設計、木工、油漆',
        category: 'home',
        budget_min: 250000,
        budget_max: 350000,
        location: '台北市',  // 修正：使用 location 而不是 project_location
        status: 'published'  // 修正：使用 published 而不是 matching
    }).select().single();
    
    if (projectError) {
        console.log(`   ❌ 建立專案失敗: ${projectError.message}`);
        return;
    }
    
    console.log(`   ✅ 專案建立成功: ${projectData.title}`);
    
    // 建立專案項目（包含 quantity 和 unit）
    const projectItems = [
        {
            project_id: projectData.id,
            item_name: '室內設計',
            item_description: '30坪客廳+餐廳+臥室，現代簡約風格',
            category_name: 'home',
            subcategory: 'home__interior_design',
            quantity: 30,
            unit: '坪',
            budget_min: 70000,
            budget_max: 100000,
            status: 'active'
        },
        {
            project_id: projectData.id,
            item_name: '系統櫃',
            item_description: '客廳電視牆+臥室衣櫃',
            category_name: 'home',
            subcategory: 'home__carpentry',
            quantity: 5,
            unit: '組',
            budget_min: 40000,
            budget_max: 70000,
            status: 'active'
        },
        {
            project_id: projectData.id,
            item_name: '油漆工程',
            item_description: '全室牆面粉刷',
            category_name: 'home',
            subcategory: 'home__painting',
            quantity: 120,
            unit: 'm²',
            budget_min: 12000,
            budget_max: 28000,
            status: 'active'
        }
    ];
    
    for (const item of projectItems) {
        const { error } = await supabase.from('project_items').insert(item);
        
        if (error) {
            console.log(`   ❌ ${item.item_name}: ${error.message}`);
        } else {
            const unitPriceMin = Math.round(item.budget_min / item.quantity);
            const unitPriceMax = Math.round(item.budget_max / item.quantity);
            console.log(`   ✅ ${item.item_name} (${item.quantity}${item.unit}, 單價約 $${unitPriceMin}-${unitPriceMax}/${item.unit})`);
        }
    }
    
    console.log(`\n✅ 測試項目建立完成！專案ID: ${projectData.id}`);
}

// ==================== 清除測試數據 ====================
async function cleanTestData() {
    console.log('🗑️  開始清除測試數據...\n');
    
    // 查找所有 v2 和 v3 版本的測試帳號
    const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .or('email.like.%.v2@matchdo.test,email.like.%.v3@matchdo.test,email.eq.test.client.v3@matchdo.test');
    
    if (users && users.length > 0) {
        console.log(`找到 ${users.length} 個測試帳號，開始刪除...`);
        
        for (const user of users) {
            try {
                await supabase.auth.admin.deleteUser(user.id);
                console.log(`   ✅ 已刪除: ${user.email}`);
            } catch (error) {
                console.log(`   ❌ 刪除失敗 ${user.email}: ${error.message}`);
            }
        }
    }
    
    console.log('\n✅ 清除完成！');
}

// ==================== 主程式 ====================
async function main() {
    console.log('🚀 開始生成測試數據（V3 單價版本）...\n');
    
    const args = process.argv.slice(2);
    if (args.includes('--clean')) {
        await cleanTestData();
        return;
    }
    
    // 步驟 1：建立專家
    console.log('📋 步驟 1/3：建立測試專家...');
    const expertIds = await createTestExperts();
    
    // 步驟 2：建立報價
    console.log('\n📋 步驟 2/3：建立專家報價...');
    const totalListings = await createListings(expertIds);
    
    // 步驟 3：建立測試項目
    console.log('\n📋 步驟 3/3：建立測試發案項目...');
    await createTestProjects();
    
    console.log('\n✅ 測試數據生成完成！');
    console.log('\n📊 數據統計：');
    console.log(`   - 總專家數：${expertIds.length} 位`);
    console.log(`   - 總報價數：${totalListings} 筆`);
    console.log('   - 測試專案：1 個（包含 3 個項目）');
    console.log('\n💡 重要：');
    console.log('   - 所有 listings.price_min/max 都是「單價」');
    console.log('   - 所有 project_items 都有 quantity 和 unit');
    console.log('   - 可以直接測試單價媒合邏輯');
}

main().catch(console.error);
