// ============================================
// 測試數據清除腳本
// 用途：清除所有 @matchdo.test 測試帳號及相關數據
// 執行：node docs/clear-test-data.js
// ============================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 使用 SERVICE_ROLE_KEY 繞過 RLS（若無則使用 SUPABASE_KEY）
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(
    process.env.SUPABASE_URL,
    SUPABASE_KEY
);

// ==================== 清除測試數據 ====================
async function cleanTestData() {
    console.log('🗑️  開始清除測試數據...\n');
    
    // 1. 查詢所有測試帳號
    console.log('📋 步驟 1/2：查詢測試帳號...');
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUsers = users?.users?.filter(u => u.email?.includes('@matchdo.test')) || [];
    
    console.log(`   找到 ${testUsers.length} 個測試帳號\n`);
    
    if (testUsers.length === 0) {
        console.log('✅ 沒有需要清除的測試數據');
        return;
    }
    
    // 2. 刪除測試帳號（會自動級聯刪除相關數據）
    console.log('📋 步驟 2/2：刪除測試帳號...');
    let successCount = 0;
    let failCount = 0;
    
    for (const user of testUsers) {
        try {
            // 強制刪除（shouldSoftDelete: false）
            const { error } = await supabase.auth.admin.deleteUser(user.id, true);
            if (error) {
                console.log(`   ❌ ${user.email}: ${error.message}`);
                failCount++;
            } else {
                console.log(`   ✅ ${user.email}`);
                successCount++;
            }
        } catch (error) {
            console.log(`   ❌ ${user.email}: ${error.message}`);
            failCount++;
        }
    }
    
    // 3. 顯示統計結果
    console.log('\n📊 清除統計：');
    console.log(`   - 成功刪除：${successCount} 個帳號`);
    if (failCount > 0) {
        console.log(`   - 刪除失敗：${failCount} 個帳號`);
    }
    
    console.log('\n✅ 測試數據清除完成！');
    console.log('\n💡 提示：');
    console.log('   - 刪除使用者會自動清除相關的 listings、projects、matches 等數據');
    console.log('   - 若要重新生成測試數據：node docs/generate-test-data-100experts.js');
}

// ==================== 執行 ====================
cleanTestData().catch(error => {
    console.error('\n❌ 發生錯誤：', error.message);
    process.exit(1);
});
