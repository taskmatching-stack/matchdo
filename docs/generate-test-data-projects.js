// ============================================
// 發包案模擬資料腳本（與專家模擬資料對應）
// 用途：生成多筆發案者與專案＋分包項目，供測試媒合、可媒合專案列表
// 執行：node docs/generate-test-data-projects.js
// 清除：node docs/generate-test-data-projects.js --clean
// ============================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

const TAIWAN_CITIES = ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'];

// 發案者＋專案定義（每組：1 個客戶 → 1～2 個專案，每專案多個 project_items）
const CLIENT_PROJECTS = [
    {
        client: { email: 'client.project1@matchdo.test', full_name: '王發案' },
        projects: [
            {
                title: '30坪新家裝潢',
                description: '現代簡約風格，含室內設計、木工、油漆',
                category: 'home',
                project_location: ['台北市'],
                items: [
                    { item_name: '室內設計', item_description: '30坪客餐廳+臥室', category_name: 'home', subcategory: 'home__interior_design', quantity: 30, unit: '坪', budget_min: 70000, budget_max: 100000, tags: ['室內設計', '現代風格'] },
                    { item_name: '系統櫃', item_description: '電視牆+衣櫃', category_name: 'home', subcategory: 'home__carpentry', quantity: 5, unit: '組', budget_min: 40000, budget_max: 70000, tags: ['系統櫃', '收納'] },
                    { item_name: '油漆工程', item_description: '全室粉刷', category_name: 'home', subcategory: 'home__painting', quantity: 120, unit: 'm²', budget_min: 12000, budget_max: 28000, tags: ['油漆'] }
                ],
                publishItems: true
            }
        ]
    },
    {
        client: { email: 'client.project2@matchdo.test', full_name: '李發案' },
        projects: [
            {
                title: '老屋翻新統包',
                description: '20坪老屋，水電與泥作更新',
                category: 'home',
                project_location: ['新北市'],
                items: [
                    { item_name: '水電配置', item_description: '全室管線更新', category_name: 'home', subcategory: 'home__plumbing', quantity: 1, unit: '式', budget_min: 80000, budget_max: 120000, tags: ['水電'] },
                    { item_name: '泥作修補', item_description: '牆面與地坪', category_name: 'home', subcategory: 'home__painting', quantity: 50, unit: 'm²', budget_min: 15000, budget_max: 35000, tags: ['泥作'] }
                ],
                publishItems: true
            }
        ]
    },
    {
        client: { email: 'client.project3@matchdo.test', full_name: '陳發案' },
        projects: [
            {
                title: '辦公室輕裝修',
                description: '約 50 坪辦公室隔間與天花',
                category: 'home',
                project_location: ['台中市'],
                items: [
                    { item_name: '輕隔間', item_description: 'OA 隔間', category_name: 'home', subcategory: 'home__carpentry', quantity: 20, unit: 'm²', budget_min: 60000, budget_max: 100000, tags: ['隔間', '辦公室'] },
                    { item_name: '天花板', item_description: '輕鋼架', category_name: 'home', subcategory: 'home__carpentry', quantity: 50, unit: 'm²', budget_min: 40000, budget_max: 80000, tags: ['天花板'] }
                ],
                publishItems: true
            },
            {
                title: '店面招牌設計',
                description: '一樓店面招牌與燈箱',
                category: 'home',
                project_location: ['台中市'],
                items: [
                    { item_name: '招牌製作', item_description: '含安裝', category_name: 'home', subcategory: 'home__carpentry', quantity: 1, unit: '式', budget_min: 25000, budget_max: 50000, tags: ['招牌'] }
                ],
                publishItems: true
            }
        ]
    },
    {
        client: { email: 'client.project4@matchdo.test', full_name: '林發案' },
        projects: [
            {
                title: '小宅室內設計',
                description: '15坪新成屋，北歐風',
                category: 'home',
                project_location: ['桃園市'],
                items: [
                    { item_name: '室內設計', item_description: '15坪全室', category_name: 'home', subcategory: 'home__interior_design', quantity: 15, unit: '坪', budget_min: 35000, budget_max: 55000, tags: ['室內設計', '北歐'] },
                    { item_name: '木作', item_description: '收納櫃', category_name: 'home', subcategory: 'home__carpentry', quantity: 3, unit: '組', budget_min: 25000, budget_max: 45000, tags: ['木工', '收納'] }
                ],
                publishItems: true
            }
        ]
    },
    {
        client: { email: 'client.project5@matchdo.test', full_name: '張發案' },
        projects: [
            {
                title: '全室油漆翻新',
                description: '約 40 坪，含刮除與防水',
                category: 'home',
                project_location: ['高雄市'],
                items: [
                    { item_name: '牆面油漆', item_description: '全室', category_name: 'home', subcategory: 'home__painting', quantity: 150, unit: 'm²', budget_min: 18000, budget_max: 38000, tags: ['油漆'] }
                ],
                publishItems: true
            }
        ]
    }
];

async function createClientsAndProjects() {
    console.log('\n📋 建立發案者與發包案模擬資料...\n');
    let totalProjects = 0;
    let totalItems = 0;

    for (const group of CLIENT_PROJECTS) {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: group.client.email,
            password: 'Test1234!',
            email_confirm: true
        });
        if (authError) {
            console.log(`   ❌ 客戶 ${group.client.full_name}: ${authError.message}`);
            continue;
        }
        const clientId = authData.user.id;

        try {
            await supabase.from('users').upsert({
                id: clientId,
                email: group.client.email,
                full_name: group.client.full_name
            }, { onConflict: 'id' });
        } catch (_) {}

        console.log(`   ✅ 客戶: ${group.client.full_name} (${group.client.email})`);

        for (const proj of group.projects) {
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .insert({
                    owner_id: clientId,
                    title: proj.title,
                    description: proj.description || null,
                    category: proj.category || 'home',
                    project_location: proj.project_location || [],
                    status: 'published'
                })
                .select()
                .single();

            if (projectError) {
                console.log(`      ❌ 專案 ${proj.title}: ${projectError.message}`);
                continue;
            }
            totalProjects++;
            console.log(`      ✅ 專案: ${proj.title}`);

            for (const it of proj.items) {
                const payload = {
                    project_id: projectData.id,
                    item_name: it.item_name,
                    item_description: it.item_description || null,
                    category_name: it.category_name,
                    subcategory: it.subcategory || null,
                    quantity: it.quantity,
                    unit: it.unit,
                    budget_min: it.budget_min,
                    budget_max: it.budget_max,
                    requirements: (it.tags && it.tags.length) ? { tags: it.tags } : {},
                    status: proj.publishItems ? 'published' : 'draft'
                };
                const { error: itemErr } = await supabase.from('project_items').insert(payload);
                if (itemErr) {
                    console.log(`         ❌ ${it.item_name}: ${itemErr.message}`);
                } else {
                    totalItems++;
                    console.log(`         ✅ ${it.item_name} (${it.quantity}${it.unit}, 已發包)`);
                }
            }
        }
    }

    console.log('\n📊 發包案模擬資料統計：');
    console.log(`   - 發案者：${CLIENT_PROJECTS.length} 位`);
    console.log(`   - 專案數：${totalProjects} 筆`);
    console.log(`   - 分包項目：${totalItems} 筆（status=published，會出現在「可媒合專案」）`);
    console.log('\n💡 登入帳號範例：client.project1@matchdo.test / Test1234!');
}

async function clean() {
    console.log('\n🗑️  清除發包案測試帳號...\n');
    const emails = CLIENT_PROJECTS.map(g => g.client.email);
    const { data: users } = await supabase.from('users').select('id, email').in('email', emails);
    if (users && users.length > 0) {
        for (const u of users) {
            try {
                await supabase.auth.admin.deleteUser(u.id);
                console.log(`   ✅ 已刪除: ${u.email}`);
            } catch (e) {
                console.log(`   ❌ ${u.email}: ${e.message}`);
            }
        }
    }
    console.log('\n✅ 清除完成（專案與 project_items 會因 owner 刪除而 CASCADE 或需手動刪除）');
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--clean')) {
        await clean();
        return;
    }
    await createClientsAndProjects();
}

main().catch(console.error);
