// ============================================
// 生成測試專案和項目
// 用途：為已存在的專家生成測試專案
// 更新：2026-02-06
// ============================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(
    process.env.SUPABASE_URL,
    SUPABASE_KEY
);

// ==================== 生成測試項目 ====================
async function createTestProject() {
    console.log('🚀 開始建立測試專案...\n');
    
    // 創建測試客戶
    const clientEmail = `test.client.v3@matchdo.test`;
    
    // 先嘗試刪除舊的測試客戶
    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', clientEmail)
        .single();
    
    if (existingUser) {
        console.log(`   🗑️  刪除舊的測試客戶...`);
        await supabase.auth.admin.deleteUser(existingUser.id);
    }
    
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
    
    console.log(`   ✅ 測試客戶建立成功`);
    
    // 建立專案
    const { data: projectData, error: projectError } = await supabase.from('projects').insert({
        owner_id: clientId,
        title: '30坪新家裝潢',
        description: '現代簡約風格，包含室內設計、木工、油漆',
        category: 'home',
        budget_min: 250000,
        budget_max: 350000,
        location: '台北市',
        status: 'published'
    }).select().single();
    
    if (projectError) {
        console.log(`   ❌ 建立專案失敗: ${projectError.message}`);
        return;
    }
    
    console.log(`   ✅ 專案建立成功: ${projectData.title} (ID: ${projectData.id})`);
    
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
            status: 'published'  // 修正：使用正確的 status
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
            status: 'published'
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
            status: 'published'
        }
    ];
    
    console.log(`\n   📋 建立專案項目...`);
    
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
    
    console.log(`\n✅ 測試專案建立完成！`);
    console.log(`\n📊 摘要：`);
    console.log(`   - 專案ID: ${projectData.id}`);
    console.log(`   - 客戶Email: ${clientEmail}`);
    console.log(`   - 總預算: $${projectData.budget_min.toLocaleString()} - $${projectData.budget_max.toLocaleString()}`);
    console.log(`   - 項目數: ${projectItems.length} 個`);
}

createTestProject().catch(console.error);
