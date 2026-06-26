// 環境變數驗證
const required = [
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'GEMINI_API_KEY'
];

const optional = [
  'SUPABASE_DB_URL',
  'PORT'
];

function validateEnv() {
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要環境變數:');
    missing.forEach(key => console.error(`   - ${key}`));
    throw new Error('環境變數驗證失敗');
  }

  console.log('✓ 環境變數驗證通過');
  
  // 顯示可選變數狀態
  const optionalStatus = optional.map(key => ({
    key,
    available: !!process.env[key]
  }));
  
  optionalStatus.forEach(({ key, available }) => {
    console.log(`  ${available ? '✓' : '○'} ${key}: ${available ? '已設定' : '未設定（可選）'}`);
  });
}

module.exports = { validateEnv };
