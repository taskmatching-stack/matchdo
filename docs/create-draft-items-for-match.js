// ============================================
// 建立「草稿」專案項目供 run-split 媒合測試
// run-split 只會媒合 status = 'draft' 的項目
// 執行：node docs/create-draft-items-for-match.js
// ============================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(
    process.env.SUPABASE_URL,
    SUPABASE_KEY
);

async function main() {
    console.log('🚀 建立草稿專案與項目（供 run-split 測試）...\n');

    const clientEmail = 'test.client.v3@matchdo.test';

    // 取得或建立測試客戶
    let clientId;
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', clientEmail).single();
    if (existingUser) {
        clientId = existingUser.id;
        console.log('   使用現有測試客戶:', clientEmail);
    } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: clientEmail,
            password: 'Test1234!',
            email_confirm: true
        });
        if (authError) {
            console.error('   建立客戶失敗:', authError.message);
            process.exit(1);
        }
        clientId = authData.user.id;
        await supabase.from('users').insert({ id: clientId, email: clientEmail, full_name: '測試客戶' });
        console.log('   已建立測試客戶:', clientEmail);
    }

    // 建立專案（若 projects 表有 project_location，可加 project_location: []）
    const projectPayload = {
        owner_id: clientId,
        title: '30坪新家裝潢（媒合測試）',
        description: '現代簡約，室內設計+系統櫃+油漆',
        category: 'home',
        budget_min: 250000,
        budget_max: 350000,
        location: '台北市',
        status: 'published'
    };
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert(projectPayload)
        .select('id')
        .single();

    if (projectError) {
        console.error('   建立專案失敗:', projectError.message);
        process.exit(1);
    }
    const projectId = project.id;
    console.log('   專案已建立:', projectId);

    // 建立 3 個「草稿」項目（quantity、unit 必填，供單價×數量媒合）
    const items = [
        { item_name: '室內設計', item_description: '30坪現代簡約', category_name: 'home', subcategory: 'home__interior_design', quantity: 30, unit: '坪', budget_min: 70000, budget_max: 100000, status: 'draft' },
        { item_name: '系統櫃', item_description: '電視牆+衣櫃', category_name: 'home', subcategory: 'home__carpentry', quantity: 5, unit: '組', budget_min: 40000, budget_max: 70000, status: 'draft' },
        { item_name: '油漆工程', item_description: '全室粉刷', category_name: 'home', subcategory: 'home__painting', quantity: 120, unit: 'm²', budget_min: 12000, budget_max: 28000, status: 'draft' }
    ];

    const itemIds = [];
    for (const it of items) {
        const row = { project_id: projectId, ...it };
        const { data: inserted, error } = await supabase.from('project_items').insert(row).select('id').single();
        if (error) {
            console.error('   建立項目失敗:', it.item_name, error.message);
            continue;
        }
        itemIds.push(inserted.id);
        console.log('   項目:', it.item_name, inserted.id);
    }

    if (itemIds.length === 0) {
        console.error('   未成功建立任何項目，請檢查 project_items 表與觸發器（如 total_items 欄位）。');
        process.exit(1);
    }

    console.log('\n✅ 完成。請用以下參數測試 run-split：\n');
    console.log('   project_id:', projectId);
    console.log('   item_ids:  ', JSON.stringify(itemIds));
    console.log('\n範例 curl：');
    console.log(`   curl -X POST http://localhost:3000/api/match/run-split -H "Content-Type: application/json" -d '{"project_id":"${projectId}","item_ids":${JSON.stringify(itemIds)}}'`);
}

main().catch((e) => { console.error(e); process.exit(1); });
