/**
 * 檢查 custom_products 表 + 比對登入帳號（不花錢、只查 DB）
 * 執行：node scripts/check-custom-products-db.js
 * 可帶參數：node scripts/check-custom-products-db.js liutsaiiu@gmail.com
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const checkEmail = process.argv[2] ? process.argv[2].trim().toLowerCase() : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，請檢查 .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    if (checkEmail) {
        console.log('查詢 Auth 使用者（email 含）：', checkEmail);
        const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (authErr) {
            console.warn('Auth 列表失敗（可能無 admin 權限）:', authErr.message);
        } else {
            const users = authData?.users || [];
            const match = users.find((u) => (u.email || '').toLowerCase() === checkEmail);
            if (match) {
                console.log('  找到：', match.id, '|', match.email);
                console.log('  此帳號在 custom_products 的筆數將依此 owner_id 篩選。\n');
            } else {
                console.log('  未找到此 email 的 Auth 使用者。\n');
            }
        }
    }

    console.log('查詢 custom_products 表…');
    const { data: rows, error } = await supabase
        .from('custom_products')
        .select('id, owner_id, title, created_at, ai_generated_image_url')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('查詢失敗:', error.message);
        process.exit(1);
    }

    const list = rows || [];
    console.log('\n=== custom_products 總筆數（目前表內）:', list.length, '筆（最多顯示 50）\n');
    if (list.length === 0) {
        console.log('表內沒有任何一筆資料。代表從未儲存成功過（自動儲存或手動儲存都未寫入）。');
        return;
    }
    const ownerIds = [...new Set(list.map((r) => r.owner_id))];
    list.forEach((r, i) => {
        const hasImg = r.ai_generated_image_url ? (r.ai_generated_image_url.startsWith('data:') ? 'data URL' : 'URL') : '無';
        console.log(`${i + 1}. id=${r.id} owner_id=${r.owner_id} title=${r.title || '(無)'} created_at=${r.created_at} 圖片=${hasImg}`);
    });
    if (checkEmail && ownerIds.length > 0) {
        console.log('\n表內出現的 owner_id：', ownerIds.join(', '));
        console.log('若你登入帳號的 user id 不在上面，代表那幾筆是別人的／種子，你的帳號底下就是 0 筆。');
    }
}

check().catch((e) => {
    console.error(e);
    process.exit(1);
});
