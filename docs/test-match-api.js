// ============================================
// 單價×數量媒合 API 測試腳本
// 請先啟動 server：node server.js
// 執行：node docs/test-match-api.js
// ============================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const BASE = process.env.API_BASE_URL || 'http://localhost:3000';

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(
    process.env.SUPABASE_URL,
    SUPABASE_KEY
);

async function request(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.details || res.statusText);
    return data;
}

async function main() {
    console.log('🧪 單價×數量媒合 API 測試\n');
    console.log('   請確認 server 已啟動：node server.js\n');

    // ---------- 1. 預覽（帶 quantity、unit）----------
    console.log('--- 1. POST /api/match/preview（quantity=30, unit=坪）---');
    try {
        const preview = await request('/api/match/preview', {
            category: 'home',
            subcategory: 'home__interior_design',
            budget_min: 70000,
            budget_max: 100000,
            quantity: 30,
            unit: '坪'
        });
        console.log('   success:', preview.success);
        console.log('   use_unit_pricing:', preview.use_unit_pricing);
        console.log('   matched_experts:', preview.matched_experts, '/', preview.total_experts);
        console.log('   match_percentage:', preview.match_percentage + '%');
        console.log('   avg_market_price:', preview.avg_market_price);
        console.log('   note:', preview.note || '');
    } catch (e) {
        console.log('   ❌ 失敗:', e.message);
        console.log('   請確認 server 已啟動（node server.js）');
        process.exit(1);
    }

    // ---------- 2. 查詢一組可用的 draft 項目 ----------
    console.log('\n--- 2. 查詢可用的草稿項目（供 run-split）---');
    const { data: items } = await supabase
        .from('project_items')
        .select('id, project_id, item_name, quantity, unit, budget_min, budget_max')
        .eq('status', 'draft')
        .not('quantity', 'is', null)
        .not('unit', 'is', null)
        .limit(5);

    let projectId, itemIds;
    if (items && items.length > 0) {
        projectId = items[0].project_id;
        itemIds = items.map((i) => i.id);
        console.log('   找到專案:', projectId);
        console.log('   項目:', items.map((i) => i.item_name).join(', '));
    } else {
        console.log('   目前沒有「草稿」且含 quantity/unit 的項目。');
        console.log('   請先執行：node docs/create-draft-items-for-match.js');
        console.log('   再重新執行本腳本。');
        process.exit(0);
    }

    // ---------- 3. 執行媒合 ----------
    console.log('\n--- 3. POST /api/match/run-split ---');
    try {
        const run = await request('/api/match/run-split', {
            project_id: projectId,
            item_ids: itemIds
        });
        console.log('   success:', run.success);
        console.log('   total_matches:', run.total_matches);
        if (run.match_results && run.match_results.length) {
            run.match_results.forEach((r) => {
                console.log('   -', r.item_name, ':', r.matched_count, '位專家');
            });
        }
    } catch (e) {
        console.log('   ❌ 失敗:', e.message);
    }

    console.log('\n✅ 測試結束');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
