/**
 * 廠商作品圖 API 測試腳本
 * 使用方式：先 npm start，再在專案根目錄執行 node docs/test-manufacturer-portfolio-api.js
 */
const BASE = 'http://localhost:3000';

async function get(url) {
    const res = await fetch(url);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (_) { json = text; }
    return { ok: res.ok, status: res.status, data: json };
}

async function main() {
    console.log('=== 1. GET /api/manufacturers（應含 portfolio）===');
    const mfrRes = await get(`${BASE}/api/manufacturers`);
    if (!mfrRes.ok) {
        console.log('失敗:', mfrRes.status, mfrRes.data);
        return;
    }
    const list = mfrRes.data.manufacturers || mfrRes.data || [];
    console.log('廠商數:', list.length);
    if (list.length > 0) {
        const first = list[0];
        console.log('第一筆廠商 id:', first.id, 'name:', first.name);
        console.log('portfolio 筆數:', (first.portfolio || []).length);
    }

    console.log('\n=== 2. GET /api/manufacturer-portfolio（全部）===');
    const allRes = await get(`${BASE}/api/manufacturer-portfolio`);
    if (!allRes.ok) {
        console.log('失敗:', allRes.status, allRes.data);
    } else {
        const items = allRes.data.items || allRes.data || [];
        console.log('作品圖筆數:', items.length);
        if (items.length > 0) console.log('第一筆:', items[0].title || items[0].id, items[0].image_url?.slice(0, 50));
    }

    if (list.length > 0) {
        const id = list[0].id;
        console.log('\n=== 3. GET /api/manufacturer-portfolio?manufacturer_id=' + id + ' ===');
        const oneRes = await get(`${BASE}/api/manufacturer-portfolio?manufacturer_id=${id}`);
        if (oneRes.ok) {
            const oneItems = oneRes.data.items || oneRes.data || [];
            console.log('該廠商作品圖筆數:', oneItems.length);
        }

        console.log('\n=== 4. GET /api/manufacturer-portfolio?category=furniture ===');
        const catRes = await get(`${BASE}/api/manufacturer-portfolio?category=furniture`);
        if (catRes.ok) {
            const catItems = catRes.data.items || catRes.data || [];
            console.log('分類 furniture 作品圖筆數:', catItems.length);
        }
    }

    console.log('\n=== 測試結束 ===');
}

main().catch(e => console.error(e));
