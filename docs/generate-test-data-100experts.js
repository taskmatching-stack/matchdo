// ============================================
// 測試數據生成腳本 - 100位專家版本（募資影片專用）
// 用途：為媒合功能提供完整測試數據
// 執行：node scripts/generate-test-data.js
// ============================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 使用 SERVICE_ROLE_KEY 繞過 RLS（若無則使用 SUPABASE_KEY）
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(
    process.env.SUPABASE_URL,
    SUPABASE_KEY
);

// ==================== 台灣縣市 ====================
const taiwanCities = [
    '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
    '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
    '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
    '台東縣', '澎湖縣', '金門縣', '連江縣'
];

// ==================== 生成專家函數 ====================
function generateExperts() {
    const experts = [];
    let expertId = 1;
    const VERSION = 'v2'; // 版本號，避免與軟刪除的帳號衝突

    // ========================================
    // 第一部分：居家裝潢類 (30位)
    // ========================================
    
    // 室內設計師 (8位) - 價格為「單價/坪」
    const interiorDesigners = [
        { city: '台北市', name: '陳設計師', style: '現代簡約', unitPrice: [2500, 3500], tags: ['室內設計', '現代風格', '北歐風格', '3D圖面', '施工監造', '全室規劃'] },
        { city: '新北市', name: '王設計', style: '小坪數', unitPrice: [2200, 3000], tags: ['室內設計', '小坪數', '空間規劃', '收納', '機能性', '3D圖面'] },
        { city: '台中市', name: '江設計師', style: '日式無印', unitPrice: [2400, 3200], tags: ['室內設計', '日式風格', '無印風格', '自然材質', '光線', '簡約'] },
        { city: '台南市', name: '李設計', style: '工業風', unitPrice: [2300, 3100], tags: ['室內設計', '工業風', 'loft', '老屋改造', '舊元素', '再利用'] },
        { city: '高雄市', name: '張設計', style: '現代奢華', unitPrice: [3000, 4500], tags: ['室內設計', '現代奢華', '大理石', '精品', '高級材料', '豪宅'] },
        { city: '桃園市', name: '劉設計', style: '鄉村風', unitPrice: [2100, 2900], tags: ['室內設計', '鄉村風', '溫馨', '木質', '自然', '舒適'] },
        { city: '新竹市', name: '林設計', style: '極簡風', unitPrice: [2600, 3400], tags: ['室內設計', '極簡', '簡約', '俐落', '線條', '現代'] },
        { city: '台北市', name: '馬統包', style: '高端統包', unitPrice: [4000, 6000], tags: ['統包', '高端設計', '豪宅', '一條龍', '施工監造', '高級材料'] }
    ];

    interiorDesigners.forEach((d, i) => {
        experts.push({
            email: `expert.interior${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: d.name,
            specialty: 'home',
            experience_years: 5 + Math.floor(Math.random() * 10),
            description: `專業室內設計師，擅長${d.style}設計，提供 3D 圖面及施工監造`,
            service_areas: [d.city],
            listings: [{
                title: `${d.style}室內設計`,
                category: 'home',
                subcategory: 'home__interior_design',
                price_min: d.unitPrice[0],
                price_max: d.unitPrice[1],
                unit: '坪',
                delivery_days: 25 + Math.floor(Math.random() * 15),
                description: `專長${d.style}設計，注重細節與品質。提供完整設計圖面與施工監造服務。【單價 $${d.unitPrice[0]}-${d.unitPrice[1]}/坪】`,
                service_location: [d.city],
                is_remote: false,
                tags: d.tags
            }]
        });
    });

    // 木工師傅 (6位)
    const carpenters = [
        { city: '新北市', specialty: '系統櫃', price: [30000, 150000] },
        { city: '台中市', specialty: '實木家具', price: [40000, 200000] },
        { city: '高雄市', specialty: '木作裝潢', price: [35000, 180000] },
        { city: '桃園市', specialty: '客製化家具', price: [32000, 160000] },
        { city: '台北市', specialty: '系統櫃', price: [35000, 170000] },
        { city: '台南市', specialty: '木地板', price: [25000, 120000] }
    ];

    carpenters.forEach((c, i) => {
        experts.push({
            email: `expert.carpenter${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `林木工${i + 1}`,
            specialty: 'home',
            experience_years: 5 + Math.floor(Math.random() * 8),
            description: `專業木工師傅，擅長${c.specialty}，經驗豐富`,
            service_areas: [c.city],
            listings: [{
                title: `${c.specialty}服務`,
                category: 'home',
                subcategory: 'home__carpentry',
                price_min: c.price[0],
                price_max: c.price[1],
                unit: '次',
                delivery_days: 10 + Math.floor(Math.random() * 10),
                description: `提供專業${c.specialty}服務，品質保證，免費丈量估價。`,
                service_location: [c.city],
                is_remote: false,
                tags: ['木工', c.specialty, '訂製', '客製化', '施工', '丈量']
            }]
        });
    });

    // 油漆工程 (4位)
    const painters = [
        { city: '台北市', price: [20000, 80000] },
        { city: '台中市', price: [25000, 100000] },
        { city: '高雄市', price: [18000, 75000] },
        { city: '新北市', price: [22000, 85000] }
    ];

    painters.forEach((p, i) => {
        experts.push({
            email: `expert.painter${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `黃油漆${i + 1}`,
            specialty: 'home',
            experience_years: 3 + Math.floor(Math.random() * 7),
            description: '專業油漆工程，提供多種塗料選擇，使用環保材料',
            service_areas: [p.city],
            listings: [{
                title: '全室油漆工程',
                category: 'home',
                subcategory: 'home__painting',
                price_min: p.price[0],
                price_max: p.price[1],
                unit: '坪',
                delivery_days: 5 + Math.floor(Math.random() * 5),
                description: '全室油漆、牆面修補、特殊塗料施工。使用環保塗料，無毒無味。',
                service_location: [p.city],
                is_remote: false,
                tags: ['油漆', '牆面', '修補', '環保塗料', '全室', '特殊塗料']
            }]
        });
    });

    // 水電工程 (5位)
    const electricians = [
        { city: '台北市', price: [5000, 50000] },
        { city: '台中市', price: [4500, 45000] },
        { city: '高雄市', price: [4000, 48000] },
        { city: '新北市', price: [5500, 52000] },
        { city: '桃園市', price: [4800, 47000] }
    ];

    electricians.forEach((e, i) => {
        experts.push({
            email: `expert.electrician${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `趙水電${i + 1}`,
            specialty: 'home',
            experience_years: 8 + Math.floor(Math.random() * 7),
            description: '專業水電工程，持有合格證照，經驗豐富',
            service_areas: [e.city],
            listings: [{
                title: '水電工程服務',
                category: 'home',
                subcategory: 'home__electrical',
                price_min: e.price[0],
                price_max: e.price[1],
                unit: '次',
                delivery_days: 2 + Math.floor(Math.random() * 3),
                description: '水電配置、管線更新、電路檢修、漏水處理。持合格證照。',
                service_location: [e.city],
                is_remote: true,
                tags: ['水電', '管線', '電路', '漏水', '技師證照', '檢修']
            }]
        });
    });

    // 其他居家服務 (7位)
    const homeServices = [
        { type: '清潔', name: '劉清潔', price: [2000, 5000], cities: taiwanCities.slice(0, 6), tags: ['清潔', '居家', '裝潢後', '定期清潔', '環保清潔劑', '深層清潔'], subcat: 'home__cleaning' },
        { type: '地板', name: '鄭地板', price: [15000, 100000], cities: ['台北市', '新北市', '桃園市'], tags: ['地板', '木地板', '塑膠地板', '磁磚', '超耐磨', '施工'], subcat: 'home__flooring' },
        { type: '窗簾', name: '吳窗簾', price: [8000, 50000], cities: ['台北市', '新北市'], tags: ['窗簾', '窗飾', '布簾', '捲簾', '百葉窗', '調光簾'], subcat: 'home__curtain' },
        { type: '冷氣', name: '許冷氣', price: [3000, 40000], cities: ['台北市', '新北市', '基隆市'], tags: ['冷氣', '空調', '安裝', '維修', '保養', '移機'], subcat: 'home__air_conditioning' },
        { type: '防水', name: '劉防水', price: [8000, 60000], cities: ['台南市', '高雄市'], tags: ['防水', '抓漏', '屋頂', '外牆', '浴室', '保固'], subcat: 'home__waterproofing' },
        { type: '庭園', name: '張園藝', price: [20000, 150000], cities: ['桃園市', '新竹縣'], tags: ['庭園', '景觀', '綠化', '植栽', '陽台', '灑水系統'], subcat: 'home__garden' }
    ];

    homeServices.forEach((s, i) => {
        const emailType = ['cleaning', 'flooring', 'curtain', 'ac', 'waterproof', 'garden'][i];
        experts.push({
            email: `expert.${emailType}${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: s.name,
            specialty: 'home',
            experience_years: 3 + Math.floor(Math.random() * 8),
            description: `專業${s.type}服務，經驗豐富，品質保證`,
            service_areas: s.cities,
            listings: [{
                title: `${s.type}專業服務`,
                category: 'home',
                subcategory: s.subcat,
                price_min: s.price[0],
                price_max: s.price[1],
                unit: s.type === '清潔' ? '次' : (s.type === '地板' ? '坪' : (s.type === '窗簾' ? '組' : '次')),
                delivery_days: s.type === '清潔' ? 1 : 7 + Math.floor(Math.random() * 7),
                description: `提供專業${s.type}服務，使用優質材料，工法專業。`,
                service_location: s.cities,
                is_remote: false,
                tags: s.tags
            }]
        });
    });
    
    // 統包師傅 (3位) - 每位有多筆報價（可接設計、木工、油漆、水電等全包）
    const contractors = [
        { name: '楊統包', city: '高雄市' },
        { name: '孫工程', city: '台北市' },
        { name: '郭師傅', city: '台中市' }
    ];
    
    contractors.forEach((c, i) => {
        const contractorListings = [
            {
                title: '全室裝潢統包',
                category: 'home',
                subcategory: 'home__general_contractor',
                price_min: 150000,
                price_max: 800000,
                unit: '次',
                delivery_days: 60,
                description: '提供設計、拆除、泥作、水電、木工、油漆一條龍統包服務。經驗豐富，工班穩定。',
                service_location: [c.city],
                is_remote: false,
                tags: ['統包', '裝潢', '一條龍', '拆除', '泥作', '全包', '工程管理']
            },
            {
                title: '室內設計服務',
                category: 'home',
                subcategory: 'home__interior_design',
                price_min: 50000,
                price_max: 200000,
                unit: '次',
                delivery_days: 30,
                description: '提供室內設計規劃、3D圖面、施工圖繪製。可搭配統包施工。',
                service_location: [c.city],
                is_remote: false,
                tags: ['室內設計', '3D圖面', '施工圖', '規劃', '設計']
            },
            {
                title: '木工工程',
                category: 'home',
                subcategory: 'home__carpentry',
                price_min: 30000,
                price_max: 180000,
                unit: '次',
                delivery_days: 14,
                description: '系統櫃、木作天花板、木地板施工。自有工班，品質保證。',
                service_location: [c.city],
                is_remote: false,
                tags: ['木工', '系統櫃', '天花板', '木地板', '施工']
            },
            {
                title: '油漆工程',
                category: 'home',
                subcategory: 'home__painting',
                price_min: 20000,
                price_max: 100000,
                unit: '坪',
                delivery_days: 7,
                description: '全室油漆、牆面處理、特殊塗料。使用環保材料。',
                service_location: [c.city],
                is_remote: false,
                tags: ['油漆', '牆面', '塗料', '環保', '施工']
            },
            {
                title: '水電工程',
                category: 'home',
                subcategory: 'home__electrical',
                price_min: 8000,
                price_max: 60000,
                unit: '次',
                delivery_days: 5,
                description: '水電配置、管線更新、電路規劃。持證照施工。',
                service_location: [c.city],
                is_remote: false,
                tags: ['水電', '管線', '電路', '配置', '技師']
            }
        ];
        
        experts.push({
            email: `expert.contractor${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: c.name,
            specialty: 'home',
            experience_years: 10 + Math.floor(Math.random() * 8),
            description: '資深統包師傅，自有工班，可承接全室裝潢統包或單項工程，經驗豐富。',
            service_areas: [c.city],
            listings: contractorListings
        });
    });

    // ========================================
    // 第二部分：數位資產/科技類 (50位)
    // ========================================

    // 影片製作 (10位)
    const videoProducers = [
        { specialty: '商業廣告', price: [50000, 300000], tags: ['影片製作', '商業廣告', '品牌影片', '廣告片', '腳本', '拍攝'], subcat: 'video__commercial' },
        { specialty: '企業形象', price: [40000, 250000], tags: ['影片製作', '企業形象', '公司介紹', '品牌故事', '專業拍攝', '後製'], subcat: 'video__corporate' },
        { specialty: '活動紀錄', price: [20000, 100000], tags: ['影片製作', '活動紀錄', '婚禮', '記錄片', '現場拍攝', '剪輯'], subcat: 'video__event' },
        { specialty: '動畫製作', price: [60000, 400000], tags: ['動畫製作', '2D動畫', '3D動畫', 'Motion Graphics', '特效', '動態圖像'], subcat: 'video__animation' },
        { specialty: '產品展示', price: [30000, 150000], tags: ['影片製作', '產品拍攝', '商品攝影', '開箱影片', '展示', '電商'], subcat: 'video__product' },
        { specialty: 'YouTube頻道', price: [15000, 80000], tags: ['影片製作', 'YouTube', '頻道經營', '剪輯', '字幕', '封面設計'], subcat: 'video__youtube' },
        { specialty: '微電影', price: [80000, 500000], tags: ['微電影', '劇情片', '腳本創作', '演員', '專業團隊', '後製'], subcat: 'video__short_film' },
        { specialty: '空拍攝影', price: [25000, 120000], tags: ['空拍', '航拍', '無人機', '鳥瞰', '風景', '建案'], subcat: 'video__aerial' },
        { specialty: '直播服務', price: [10000, 60000], tags: ['直播', '線上活動', '多機位', '轉播', '串流', '即時'], subcat: 'video__livestream' },
        { specialty: '影片剪輯', price: [8000, 50000], tags: ['影片剪輯', '後製', '調色', '配樂', '字幕', '特效'], subcat: 'video__editing' }
    ];

    videoProducers.forEach((v, i) => {
        experts.push({
            email: `expert.video${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `${['陳', '林', '王', '張', '李', '黃', '周', '吳', '徐', '孫'][i]}影師`,
            specialty: 'video',
            experience_years: 3 + Math.floor(Math.random() * 10),
            description: `專業${v.specialty}服務，擁有專業設備與團隊，作品豐富`,
            service_areas: [],
            listing: {
                title: v.specialty + '服務',
                category: 'video',
                subcategory: v.subcat,
                price_min: v.price[0],
                price_max: v.price[1],
                unit: '支',
                delivery_days: v.specialty === '直播服務' ? 1 : (v.specialty === '微電影' ? 45 : 14 + Math.floor(Math.random() * 14)),
                description: `提供專業${v.specialty}服務，從企劃、拍攝到後製一條龍服務。使用專業設備，經驗豐富。`,
                service_location: [],
                is_remote: true,
                tags: v.tags
            }
        });
    });

    // 網站開發 (12位)
    const webDevelopers = [
        { specialty: '企業形象網站', tech: 'WordPress', price: [30000, 150000], tags: ['網站開發', '企業網站', 'WordPress', 'RWD', 'SEO', '形象網站'], subcat: 'web__corporate' },
        { specialty: '電商網站', tech: 'Shopify', price: [50000, 300000], tags: ['電商開發', 'Shopify', '購物車', '金流', '物流', '會員系統'], subcat: 'web__ecommerce' },
        { specialty: '客製化網站', tech: 'React', price: [80000, 500000], tags: ['客製化開發', 'React', 'Next.js', '前端開發', 'API整合', '後台系統'], subcat: 'web__custom' },
        { specialty: '一頁式網站', tech: 'Landing Page', price: [15000, 80000], tags: ['一頁式', 'Landing Page', '轉換優化', '行銷頁面', 'RWD', 'SEO'], subcat: 'web__landing' },
        { specialty: '論壇/社群網站', tech: 'Node.js', price: [100000, 600000], tags: ['社群開發', 'Node.js', '會員系統', '即時通訊', '論壇', '社群'], subcat: 'web__community' },
        { specialty: '預約系統', tech: 'Vue.js', price: [60000, 350000], tags: ['預約系統', 'Vue.js', '線上訂位', '排程', '通知', '日曆'], subcat: 'web__booking' },
        { specialty: '部落格/媒體網站', tech: 'Ghost', price: [25000, 120000], tags: ['部落格', 'Ghost', '內容管理', 'SEO', '訂閱', '媒體'], subcat: 'web__blog' },
        { specialty: '後台管理系統', tech: 'Laravel', price: [70000, 400000], tags: ['後台系統', 'Laravel', 'PHP', '資料管理', 'CRUD', 'API'], subcat: 'web__admin' },
        { specialty: '網站維護/優化', tech: '全端', price: [20000, 100000], tags: ['網站維護', '效能優化', '安全更新', 'SEO優化', '速度優化', '維護'], subcat: 'web__maintenance' },
        { specialty: 'RWD網頁設計', tech: 'Bootstrap', price: [35000, 180000], tags: ['RWD', '響應式', 'Bootstrap', '網頁設計', '手機版', '平板'], subcat: 'web__responsive' },
        { specialty: 'API開發整合', tech: 'Node.js', price: [50000, 300000], tags: ['API開發', 'RESTful', 'Node.js', '第三方整合', '後端', '接口'], subcat: 'web__api' },
        { specialty: '電商金流串接', tech: '全端', price: [40000, 200000], tags: ['金流串接', '藍新', '綠界', '支付', '電商', '交易'], subcat: 'web__payment' }
    ];

    webDevelopers.forEach((w, i) => {
        experts.push({
            email: `expert.web${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `${['陳', '林', '王', '張', '李', '黃', '周', '吳', '徐', '孫', '鄭', '謝'][i]}工程師`,
            specialty: 'web',
            experience_years: 2 + Math.floor(Math.random() * 10),
            description: `專業${w.specialty}開發，精通${w.tech}，提供完整解決方案`,
            service_areas: [],
            listing: {
                title: w.specialty,
                category: 'web',
                subcategory: w.subcat,
                price_min: w.price[0],
                price_max: w.price[1],
                unit: '個',
                delivery_days: w.specialty === '網站維護/優化' ? 7 : (w.specialty.includes('客製化') ? 60 : 30 + Math.floor(Math.random() * 30)),
                description: `提供專業${w.specialty}服務，使用${w.tech}技術，從規劃、開發到上線全程服務。`,
                service_location: [],
                is_remote: true,
                tags: w.tags
            }
        });
    });

    // APP 開發 (10位)
    const appDevelopers = [
        { specialty: 'iOS APP', tech: 'Swift', price: [100000, 800000], tags: ['iOS開發', 'Swift', 'iPhone', 'iPad', 'App Store', '原生開發'], subcat: 'app__ios' },
        { specialty: 'Android APP', tech: 'Kotlin', price: [100000, 800000], tags: ['Android開發', 'Kotlin', 'Google Play', '原生開發', '手機應用', 'APP'], subcat: 'app__android' },
        { specialty: '跨平台APP', tech: 'Flutter', price: [120000, 1000000], tags: ['跨平台開發', 'Flutter', 'iOS+Android', '雙平台', 'APP開發', '手機應用'], subcat: 'app__cross_platform' },
        { specialty: 'React Native APP', tech: 'React Native', price: [110000, 900000], tags: ['React Native', '跨平台', 'JavaScript', 'APP開發', 'iOS', 'Android'], subcat: 'app__react_native' },
        { specialty: '電商APP', tech: 'Flutter', price: [150000, 1200000], tags: ['電商APP', '購物', '金流', '物流', '會員', '推播'], subcat: 'app__ecommerce' },
        { specialty: '社群APP', tech: 'Firebase', price: [180000, 1500000], tags: ['社群APP', '即時通訊', 'Firebase', '聊天', '動態', '社交'], subcat: 'app__social' },
        { specialty: '直播APP', tech: 'WebRTC', price: [200000, 1800000], tags: ['直播APP', 'WebRTC', '串流', '即時', '互動', '影音'], subcat: 'app__livestream' },
        { specialty: 'O2O服務APP', tech: 'Google Maps', price: [160000, 1300000], tags: ['O2O', '服務APP', '地圖', 'GPS', '配對', '預約'], subcat: 'app__o2o' },
        { specialty: 'APP UI/UX設計', tech: 'Figma', price: [50000, 300000], tags: ['APP設計', 'UI設計', 'UX設計', 'Figma', '原型', '介面'], subcat: 'app__design' },
        { specialty: 'APP維護更新', tech: '全端', price: [30000, 150000], tags: ['APP維護', '更新', '修Bug', '優化', '版本更新', '維運'], subcat: 'app__maintenance' }
    ];

    appDevelopers.forEach((a, i) => {
        experts.push({
            email: `expert.app${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `${['劉', '陳', '林', '王', '張', '李', '黃', '周', '吳', '徐'][i]}開發師`,
            specialty: 'app',
            experience_years: 3 + Math.floor(Math.random() * 8),
            description: `專業${a.specialty}開發，精通${a.tech}，已上架多款APP`,
            service_areas: [],
            listing: {
                title: a.specialty + '開發',
                category: 'app',
                subcategory: a.subcat,
                price_min: a.price[0],
                price_max: a.price[1],
                unit: '個',
                delivery_days: a.specialty.includes('維護') ? 30 : (a.specialty.includes('設計') ? 21 : 60 + Math.floor(Math.random() * 60)),
                description: `提供專業${a.specialty}開發服務，使用${a.tech}技術，從需求分析到上架全程協助。`,
                service_location: [],
                is_remote: true,
                tags: a.tags
            }
        });
    });

    // AI 導入/數據分析 (8位)
    const aiExperts = [
        { specialty: 'AI 導入顧問', price: [80000, 500000], tags: ['AI導入', 'AI顧問', '數位轉型', '流程優化', '自動化', '顧問服務'], subcat: 'ai__consulting' },
        { specialty: '機器學習開發', price: [150000, 1000000], tags: ['機器學習', 'ML', 'Python', '模型訓練', '演算法', '預測'], subcat: 'ai__machine_learning' },
        { specialty: 'ChatGPT 整合', price: [60000, 400000], tags: ['ChatGPT', 'GPT-4', 'AI對話', '自動回覆', '客服機器人', 'OpenAI'], subcat: 'ai__chatgpt' },
        { specialty: '資料分析', price: [50000, 300000], tags: ['資料分析', 'Data Analysis', 'Python', '視覺化', '報表', '洞察'], subcat: 'ai__data_analysis' },
        { specialty: 'AI 客服機器人', price: [70000, 450000], tags: ['AI客服', 'Chatbot', '自動化', '對話系統', 'NLP', '客服'], subcat: 'ai__chatbot' },
        { specialty: '電商AI推薦', price: [100000, 600000], tags: ['推薦系統', 'AI推薦', '個人化', '電商', '機器學習', '演算法'], subcat: 'ai__recommendation' },
        { specialty: '影像辨識', price: [120000, 800000], tags: ['影像辨識', '電腦視覺', 'CV', 'AI', '深度學習', '辨識'], subcat: 'ai__computer_vision' },
        { specialty: 'RPA 流程自動化', price: [80000, 500000], tags: ['RPA', '流程自動化', '機器人', '自動化', '效率', '數位轉型'], subcat: 'ai__rpa' }
    ];

    aiExperts.forEach((ai, i) => {
        experts.push({
            email: `expert.ai${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `${['張', '王', '李', '陳', '劉', '黃', '林', '周'][i]} AI 顧問`,
            specialty: 'ai',
            experience_years: 2 + Math.floor(Math.random() * 8),
            description: `專業${ai.specialty}服務，協助企業數位轉型與AI應用`,
            service_areas: [],
            listing: {
                title: ai.specialty + '服務',
                category: 'ai',
                subcategory: ai.subcat,
                price_min: ai.price[0],
                price_max: ai.price[1],
                unit: '案',
                delivery_days: 30 + Math.floor(Math.random() * 60),
                description: `提供專業${ai.specialty}，從需求分析、解決方案設計到實際導入，協助企業運用AI提升效率。`,
                service_location: [],
                is_remote: true,
                tags: ai.tags
            }
        });
    });

    // 數位行銷 (10位)
    const marketingExperts = [
        { specialty: 'SEO 優化', price: [20000, 150000], tags: ['SEO', '搜尋優化', 'Google', '排名', '關鍵字', '流量'], subcat: 'marketing__seo' },
        { specialty: 'Google 廣告', price: [30000, 200000], tags: ['Google Ads', 'PPC', '關鍵字廣告', 'GDN', 'YouTube廣告', '廣告投放'], subcat: 'marketing__google_ads' },
        { specialty: 'Facebook 廣告', price: [25000, 180000], tags: ['Facebook廣告', 'Meta廣告', 'Instagram廣告', '社群廣告', '受眾', '投放'], subcat: 'marketing__facebook_ads' },
        { specialty: '社群經營', price: [15000, 100000], tags: ['社群經營', 'Facebook', 'Instagram', '貼文', '互動', '粉絲'], subcat: 'marketing__social_media' },
        { specialty: '內容行銷', price: [20000, 120000], tags: ['內容行銷', '文案', '部落格', 'Content', 'SEO文章', '行銷'], subcat: 'marketing__content' },
        { specialty: 'Email 行銷', price: [10000, 80000], tags: ['Email行銷', 'EDM', '電子報', '自動化', '轉換', '行銷'], subcat: 'marketing__email' },
        { specialty: 'LINE 行銷', price: [18000, 120000], tags: ['LINE行銷', 'LINE@', '官方帳號', '訊息推播', '自動回覆', '行銷'], subcat: 'marketing__line' },
        { specialty: '網紅合作', price: [30000, 300000], tags: ['網紅行銷', 'KOL', '業配', '合作', '曝光', '社群'], subcat: 'marketing__influencer' },
        { specialty: '直播電商', price: [25000, 150000], tags: ['直播電商', '電商直播', 'Live', '帶貨', '互動', '銷售'], subcat: 'marketing__livestream' },
        { specialty: '數據分析GA4', price: [15000, 100000], tags: ['GA4', 'Google Analytics', '數據分析', '追蹤', '轉換', '報表'], subcat: 'marketing__analytics' }
    ];

    marketingExperts.forEach((m, i) => {
        experts.push({
            email: `expert.marketing${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `${['李', '王', '張', '陳', '林', '黃', '劉', '吳', '周', '徐'][i]}行銷師`,
            specialty: 'marketing',
            experience_years: 2 + Math.floor(Math.random() * 8),
            description: `專業${m.specialty}服務，協助企業提升品牌曝光與業績成長`,
            service_areas: [],
            listing: {
                title: m.specialty + '服務',
                category: 'marketing',
                subcategory: m.subcat,
                price_min: m.price[0],
                price_max: m.price[1],
                unit: '月',
                delivery_days: 30,
                description: `提供專業${m.specialty}，透過數據分析與策略規劃，協助您的品牌在數位時代脫穎而出。`,
                service_location: [],
                is_remote: true,
                tags: m.tags
            }
        });
    });

    // ========================================
    // 第三部分：平面設計類 (20位)
    // ========================================

    const designers = [
        { specialty: 'LOGO 設計', price: [8000, 50000], tags: ['LOGO', 'Logo設計', '品牌識別', '商標', 'CI', 'VI'], subcat: 'design__logo' },
        { specialty: '品牌識別設計', price: [30000, 200000], tags: ['品牌設計', 'VI設計', 'CI', '識別系統', '企業形象', '品牌'], subcat: 'design__branding' },
        { specialty: '名片設計', price: [2000, 10000], tags: ['名片', '商務名片', '印刷', '設計', '識別', '個人品牌'], subcat: 'design__business_card' },
        { specialty: 'DM/傳單設計', price: [3000, 20000], tags: ['DM', '傳單', '宣傳', '印刷品', '行銷', '平面設計'], subcat: 'design__flyer' },
        { specialty: '海報設計', price: [5000, 30000], tags: ['海報', 'Poster', '視覺設計', '活動', '宣傳', '印刷'], subcat: 'design__poster' },
        { specialty: '包裝設計', price: [15000, 150000], tags: ['包裝設計', '產品包裝', '盒型', '印刷', '品牌', '商品'], subcat: 'design__packaging' },
        { specialty: '型錄/手冊', price: [10000, 80000], tags: ['型錄', '手冊', 'Catalog', '產品目錄', '企業簡介', '印刷'], subcat: 'design__catalog' },
        { specialty: '菜單設計', price: [5000, 30000], tags: ['菜單', 'Menu', '餐廳', '飲料', '設計', '印刷'], subcat: 'design__menu' },
        { specialty: '插畫設計', price: [8000, 60000], tags: ['插畫', 'Illustration', '繪圖', '原創', '角色設計', '視覺'], subcat: 'design__illustration' },
        { specialty: '吉祥物設計', price: [20000, 150000], tags: ['吉祥物', 'Mascot', '角色', 'IP', '品牌角色', '設計'], subcat: 'design__mascot' },
        { specialty: '社群素材設計', price: [8000, 50000], tags: ['社群素材', 'FB貼圖', 'IG限動', '社群', '視覺', '設計'], subcat: 'design__social_media' },
        { specialty: 'Banner 廣告', price: [3000, 20000], tags: ['Banner', '橫幅廣告', '網路廣告', 'GDN', '視覺', '設計'], subcat: 'design__banner' },
        { specialty: '簡報設計', price: [5000, 40000], tags: ['簡報', 'PPT', 'Keynote', '提案', '視覺化', '設計'], subcat: 'design__presentation' },
        { specialty: '網頁視覺設計', price: [15000, 100000], tags: ['網頁設計', 'Web Design', 'UI', 'Layout', '視覺', '版面'], subcat: 'design__web' },
        { specialty: 'UI/UX 設計', price: [25000, 150000], tags: ['UI設計', 'UX設計', '使用者介面', '體驗設計', 'Figma', '原型'], subcat: 'design__ui_ux' },
        { specialty: 'APP介面設計', price: [30000, 180000], tags: ['APP設計', '介面設計', 'Mobile UI', 'UX', 'Figma', '原型'], subcat: 'design__app' },
        { specialty: '電商視覺設計', price: [10000, 80000], tags: ['電商設計', '商品頁', 'Banner', '視覺', 'EDM', '購物'], subcat: 'design__ecommerce' },
        { specialty: 'LINE 貼圖', price: [15000, 100000], tags: ['LINE貼圖', '貼圖設計', '表情符號', 'Sticker', '原創', '上架'], subcat: 'design__line_sticker' },
        { specialty: '書籍封面設計', price: [8000, 50000], tags: ['封面設計', '書籍', 'Book Cover', '出版', '視覺', '設計'], subcat: 'design__book_cover' },
        { specialty: '展場設計', price: [20000, 200000], tags: ['展場設計', '展覽', '攤位', '視覺', 'Event', '活動'], subcat: 'design__exhibition' }
    ];

    designers.forEach((d, i) => {
        experts.push({
            email: `expert.design${i + 1}.${VERSION}@matchdo.test`,
            password: 'Test1234!',
            full_name: `${['吳', '范', '蔡', '鄭', '謝', '許', '曾', '彭', '游', '賴', '何', '呂', '施', '羅', '高', '葉', '孫', '丁', '馬', '余'][i]}設計師`,
            specialty: 'design',
            experience_years: 2 + Math.floor(Math.random() * 10),
            description: `專業${d.specialty}，風格多元，提供修改至滿意`,
            service_areas: [],
            listing: {
                title: d.specialty,
                category: 'design',
                subcategory: d.subcat,
                price_min: d.price[0],
                price_max: d.price[1],
                unit: '件',
                delivery_days: d.specialty.includes('LOGO') || d.specialty.includes('名片') ? 5 : (d.specialty.includes('品牌') ? 30 : 7 + Math.floor(Math.random() * 7)),
                description: `提供專業${d.specialty}服務，從概念發想到完稿，提供多次修改確保滿意。`,
                service_location: [],
                is_remote: true,
                tags: d.tags
            }
        });
    });

    return experts;
}

// ==================== 建立測試專家 ====================
async function createTestExperts() {
    const experts = generateExperts();
    const expertIds = [];
    
    console.log(`準備建立 ${experts.length} 位測試專家...`);
    
    for (const expert of experts) {
        try {
            // 1. 使用 Supabase Auth 註冊
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: expert.email,
                password: expert.password,
                email_confirm: true
            });
            
            if (authError) {
                console.log(`   ❌ ${expert.full_name}: ${authError.message}`);
                continue;
            }
            
            if (!authData || !authData.user) {
                console.log(`   ❌ ${expert.full_name}: authData 或 user 為空`);
                continue;
            }
            
            const userId = authData.user.id;
            expertIds.push({ userId, data: expert });
            
            // 2. 建立 users 記錄
            await supabase.from('users').insert({
                id: userId,
                email: expert.email,
                full_name: expert.full_name
            });
            
            // 3. 建立 experts_profile 記錄
            await supabase.from('experts_profile').insert({
                user_id: userId,
                specialty: expert.specialty,
                experience_years: expert.experience_years,
                description: expert.description,
                service_areas: expert.service_areas,
                verification_status: 'verified'
            });
            
            // 4. 建立 contact_info 記錄
            await supabase.from('contact_info').insert({
                user_id: userId,
                phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
                email: expert.email,
                line_id: `line_${expert.full_name}`,
                phone_visible: true,
                email_visible: true,
                line_visible: true
            });
            
            const firstListing = expert.listings ? expert.listings[0] : expert.listing;
            console.log(`   ✅ ${expert.full_name} (${firstListing.title})`);
            
        } catch (error) {
            console.log(`   ❌ ${expert.full_name}: ${error.message}`);
        }
    }
    
    return expertIds;
}

// ==================== 建立專家報價 ====================
async function createListings(expertIds) {
    let totalListings = 0;
    
    for (const expert of expertIds) {
        try {
            const listingsData = expert.data.listings || [expert.data.listing]; // 支援舊格式
            
            for (const listingData of listingsData) {
                const { error } = await supabase.from('listings').insert({
                    expert_id: expert.userId,
                    title: listingData.title,
                    category: listingData.category,
                    subcategory: listingData.subcategory,
                    description: listingData.description,
                    price_min: listingData.price_min,
                    price_max: listingData.price_max,
                    unit: listingData.unit,
                    delivery_days: listingData.delivery_days,
                    service_location: listingData.service_location,
                    is_remote: listingData.is_remote,
                    status: 'active',
                    tags: listingData.tags,
                    images: []
                });
                
                if (error) {
                    console.log(`   ❌ ${expert.data.full_name} - ${listingData.title}: ${error.message}`);
                } else {
                    console.log(`   ✅ ${listingData.title} (${expert.data.full_name})`);
                    totalListings++;
                }
            }
            
        } catch (error) {
            console.log(`   ❌ ${expert.data.full_name}: ${error.message}`);
        }
    }
    
    return totalListings;
}

// ==================== 主程式 ====================
async function main() {
    console.log('🚀 開始生成 100 位專家測試數據（募資影片專用）...\n');
    
    // 檢查參數
    const args = process.argv.slice(2);
    if (args.includes('--clean')) {
        console.log('🗑️  清除模式：刪除所有測試數據...\n');
        await cleanTestData();
        console.log('\n✅ 測試數據清除完成！');
        return;
    }
    
    // 步驟 1：建立測試專家
    console.log('📋 步驟 1/2：建立 100 位測試專家帳號...');
    const expertIds = await createTestExperts();
    
    // 步驟 2：建立專家報價
    console.log('\n📋 步驟 2/2：建立專家報價...');
    const totalListings = await createListings(expertIds);
    
    console.log('\n✅ 測試數據生成完成！');
    console.log('\n📊 數據統計：');
    console.log('   - 總專家數：100 位');
    console.log('   - 總報價數：' + totalListings + ' 筆');
    console.log('\n   分類明細：');
    console.log('   - 居家裝潢類：30 位專家（含 3 位統包師傅，每位 5 筆報價）');
    console.log('   - 影片製作：10 位專家');
    console.log('   - 網站開發：12 位專家');
    console.log('   - APP 開發：10 位專家');
    console.log('   - AI 導入：8 位專家');
    console.log('   - 數位行銷：10 位專家');
    console.log('   - 平面設計：20 位專家');
    
    console.log('\n💡 提示：');
    console.log('   - 這些數據專為募資影片設計，涵蓋完整的服務類別');
    console.log('   - 價格範圍真實，從 2,000 到 2,000,000');
    console.log('   - 每筆報價都有豐富的 tags 標籤用於媒合測試');
    console.log('   - 清除測試數據：node scripts/generate-test-data.js --clean');
}

// ==================== 清除測試數據 ====================
async function cleanTestData() {
    // 查詢所有測試帳號
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUsers = users?.users?.filter(u => u.email?.includes('@matchdo.test')) || [];
    
    console.log(`準備清除 ${testUsers.length} 個測試帳號的數據...\n`);
    
    for (const user of testUsers) {
        try {
            const { error } = await supabase.auth.admin.deleteUser(user.id);
            if (error) {
                console.log(`   ❌ ${user.email}: ${error.message}`);
            } else {
                console.log(`   ✅ ${user.email}`);
            }
        } catch (error) {
            console.log(`   ❌ ${user.email}: ${error.message}`);
        }
    }
}

// ==================== 執行 ====================
main().catch(console.error);
