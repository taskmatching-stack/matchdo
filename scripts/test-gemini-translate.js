/**
 * 終端機直接測試 Gemini 翻譯 API：送什麼、回什麼
 * 執行：node scripts/test-gemini-translate.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('缺少 .env 的 GEMINI_API_KEY');
  process.exit(1);
}
console.log('GEMINI_API_KEY: 已設定，長度', apiKey.length);

const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
const body = {
  contents: [{ parts: [{ text: 'Translate to English only, one line:\n\n一隻貓在草地上' }] }]
};

console.log('\n--- 送出 ---');
console.log('URL:', url.replace(apiKey, '***'));
console.log('body.contents[0].parts[0].text 前 80 字:', JSON.stringify(body.contents[0].parts[0].text).slice(0, 80) + '...');

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})
  .then(res => {
    console.log('\n--- 回應 ---');
    console.log('status:', res.status, res.statusText);
    return res.json();
  })
  .then(data => {
    if (data.error) {
      console.log('error:', JSON.stringify(data.error, null, 2));
      return;
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('candidates[0].content.parts[0].text:', text ? `"${text}"` : '(無)');
    console.log('完整 data.candidates:', JSON.stringify(data.candidates, null, 2).slice(0, 500));
  })
  .catch(e => console.error('catch:', e.message));
