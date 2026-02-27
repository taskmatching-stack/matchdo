// 訂製品測試帳號（2 個 Auth 用戶）。執行：node docs/seed-custom-product-test-accounts.js
// 前置、帳密、清除：見 matchdo-todo.md「模擬資料／種子」章節。

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

const PASSWORD = 'Test1234!';

const ACCOUNTS = [
  { email: 'custom.client@matchdo.test', full_name: '訂製者測試', role: '訂製者' },
  { email: 'custom.maker@matchdo.test', full_name: '製作方測試', role: '製作方' }
];

async function main() {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)) {
    console.error('請設定 .env：SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY（或 SUPABASE_KEY）');
    process.exit(1);
  }

  console.log('建立訂製品測試帳號（Auth + public.users）...\n');

  let makerId = null;

  for (const acc of ACCOUNTS) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: PASSWORD,
      email_confirm: true
    });

    if (authError) {
      if (authError.message && authError.message.includes('already been registered')) {
        console.log(`   ⏭ ${acc.email} 已存在，略過建立`);
        const { data: existing } = await supabase.from('users').select('id').eq('email', acc.email).maybeSingle();
        if (existing && acc.role === '製作方') makerId = existing.id;
        continue;
      }
      console.error(`   ❌ ${acc.email}: ${authError.message}`);
      continue;
    }

    const uid = authData.user.id;
    if (acc.role === '製作方') makerId = uid;

    const { error: userError } = await supabase.from('users').upsert(
      { id: uid, email: acc.email, full_name: acc.full_name },
      { onConflict: 'id' }
    );
    if (userError) console.error(`   ❌ users 表寫入 ${acc.email}: ${userError.message}`);
    else console.log(`   ✅ ${acc.role} ${acc.email}`);
  }

  if (makerId) {
    const { data: rows } = await supabase.from('manufacturers').select('id').eq('name', '示範服飾工坊').limit(1);
    if (rows && rows.length > 0) {
      const { error: upErr } = await supabase.from('manufacturers').update({ user_id: makerId }).eq('name', '示範服飾工坊');
      if (upErr) console.error('   綁定示範服飾工坊失敗:', upErr.message);
      else console.log('   ✅ 已將「示範服飾工坊」綁定至製作方帳號（可測聯絡）');
    }
  }

  console.log('\n✅ 完成。帳密與用途見 matchdo-todo.md「訂製品測試帳號」小節。\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
