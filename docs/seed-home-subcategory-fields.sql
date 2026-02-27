-- ========================================
-- 為「居家」所有子分類設定預設填寫欄位（3個必問問題）
-- 依據 docs/home-subcategory-form-fields.json
-- ========================================

-- 1. 清潔服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施作坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
  {"name":"clean_type","label":"清潔類型","type":"select","required":true,"options":["日常清潔","空屋細清","裝潢後粗清","辦公室清潔"]},
  {"name":"floor_elevator","label":"樓層與電梯","type":"text","required":true,"placeholder":"例：3樓，有電梯"}
]'::jsonb
WHERE key = 'home__清潔服務';

-- 2. 家電 燈具
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"appliance_type","label":"設備類型","type":"text","required":true,"placeholder":"例：冷氣、冰箱、燈具"},
  {"name":"quantity","label":"數量","type":"number","unit":"個","required":true},
  {"name":"location","label":"安裝位置","type":"text","required":true,"placeholder":"例：客廳、主臥"}
]'::jsonb
WHERE key = 'home__家電_燈具';

-- 3. 廚房
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"廚房坪數","type":"number","unit":"坪","required":true},
  {"name":"kitchen_type","label":"廚具類型","type":"select","required":true,"options":["系統廚具","訂製廚具","更換零件","全套更新"]},
  {"name":"budget","label":"預算範圍","type":"text","required":true,"placeholder":"例：20-30萬"}
]'::jsonb
WHERE key = 'home__廚房';

-- 4. 門片 拉門
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"quantity","label":"門片數量","type":"number","unit":"片","required":true},
  {"name":"material","label":"材質偏好","type":"select","required":true,"options":["木製","玻璃","金屬","複合材質"]},
  {"name":"size","label":"尺寸規格","type":"text","required":true,"placeholder":"例：寬 90cm × 高 210cm"}
]'::jsonb
WHERE key = 'home__門片_拉門';

-- 5. 木工 油漆 壁紙
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施工坪數","type":"number","unit":"坪","required":true},
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["木工","油漆","壁紙","木工+油漆","綜合裝修"]},
  {"name":"current_status","label":"現況描述","type":"textarea","required":true,"placeholder":"請描述目前空間狀況與施工需求"}
]'::jsonb
WHERE key = 'home__木工_油漆_壁紙';

-- 6. 泥作 圍藝
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施工坪數","type":"number","unit":"坪","required":true},
  {"name":"work_item","label":"工程項目","type":"text","required":true,"placeholder":"例：砌磚牆、粉刷、圍牆修復"},
  {"name":"location","label":"施工位置","type":"text","required":true,"placeholder":"例：後院、陽台、外牆"}
]'::jsonb
WHERE key = 'home__泥作_圍藝';

-- 7. 家事服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["鐘點管家","煮飯服務","照護服務","綜合家事"]},
  {"name":"frequency","label":"服務頻率","type":"select","required":true,"options":["單次","每週一次","每週兩次","每週三次以上","每月一次"]},
  {"name":"time_slot","label":"服務時段","type":"text","required":true,"placeholder":"例：週一至週五 09:00-17:00"}
]'::jsonb
WHERE key = 'home__家事服務';

-- 8. 搬家 回收
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"items","label":"物品數量","type":"text","required":true,"placeholder":"例：2房1廳家具、約50箱雜物"},
  {"name":"floors","label":"搬運樓層","type":"text","required":true,"placeholder":"例：舊家5樓到新家2樓"},
  {"name":"elevator","label":"電梯狀況","type":"select","required":true,"options":["雙邊有電梯","起點有/終點無","起點無/終點有","雙邊無電梯"]}
]'::jsonb
WHERE key = 'home__搬家_回收';

-- 9. 抓漏防水
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"leak_location","label":"漏水位置","type":"text","required":true,"placeholder":"例：浴室天花板、外牆窗邊"},
  {"name":"severity","label":"漏水程度","type":"select","required":true,"options":["輕微滲水","明顯漏水","嚴重滲漏"]},
  {"name":"house_type","label":"房屋類型","type":"select","required":true,"options":["公寓","透天厝","大樓","別墅"]}
]'::jsonb
WHERE key = 'home__抓漏防水';

-- 10. 櫥櫃 家具
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"furniture_type","label":"家具類型","type":"text","required":true,"placeholder":"例：系統櫃、書櫃、衣櫃"},
  {"name":"quantity","label":"數量","type":"number","unit":"組","required":true},
  {"name":"material","label":"材質偏好","type":"select","required":true,"options":["實木","系統板材","金屬","玻璃","不指定"]}
]'::jsonb
WHERE key = 'home__櫥櫃_家具';

-- 11. 消毒除蟲
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施作坪數","type":"number","unit":"坪","required":true},
  {"name":"pest_type","label":"蟲害類型","type":"select","required":true,"options":["蟑螂","老鼠","白蟻","跳蚤","蚊蟲","其他"]},
  {"name":"severity","label":"嚴重程度","type":"select","required":true,"options":["輕微偶見","中等常見","嚴重氾濫"]}
]'::jsonb
WHERE key = 'home__消毒除蟲';

-- 12. 地板 地毯 磁磚
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施工坪數","type":"number","unit":"坪","required":true},
  {"name":"material","label":"材質類型","type":"select","required":true,"options":["超耐磨地板","實木地板","磁磚","地毯","SPC地板","石塑地板"]},
  {"name":"remove_old","label":"拆除舊地板","type":"select","required":true,"options":["需要拆除","不需拆除","部分拆除"]}
]'::jsonb
WHERE key = 'home__地板_地毯_磁磚';

-- 13. 鐵作 採光罩
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_type","label":"施工類型","type":"text","required":true,"placeholder":"例：鐵窗、採光罩、樓梯扶手、防盜窗"},
  {"name":"area","label":"施工面積","type":"number","unit":"坪","required":true},
  {"name":"design_needs","label":"設計需求","type":"textarea","required":true,"placeholder":"請描述樣式、顏色、功能需求"}
]'::jsonb
WHERE key = 'home__鐵作_採光罩';

-- 14. 寵物
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"pet_type","label":"寵物類型","type":"select","required":true,"options":["狗","貓","兔子","鳥類","爬蟲","其他"]},
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["美容洗澡","訓練課程","寄養照顧","醫療諮詢","用品購買"]},
  {"name":"pet_count","label":"寵物數量","type":"number","unit":"隻","required":true}
]'::jsonb
WHERE key = 'home__寵物';

-- 15. 水電工程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["水電維修","管路更新","配電工程","衛浴安裝","綜合工程"]},
  {"name":"location","label":"施作位置","type":"text","required":true,"placeholder":"例：廚房、浴室、客廳"},
  {"name":"urgency","label":"緊急程度","type":"select","required":true,"options":["一般（可預約）","緊急（3天內）","非常緊急（當天）"]}
]'::jsonb
WHERE key = 'home__水電工程';

-- 16. 衛浴
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_item","label":"施工項目","type":"select","required":true,"options":["馬桶","浴缸","淋浴間","洗手台","全套更新"]},
  {"name":"count","label":"衛浴數量","type":"number","unit":"間","required":true},
  {"name":"budget","label":"預算範圍","type":"text","required":true,"placeholder":"例：10-15萬/間"}
]'::jsonb
WHERE key = 'home__衛浴';

-- 17. 窗戶 窗簾
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"window_count","label":"窗戶數量","type":"number","unit":"扇","required":true},
  {"name":"window_type","label":"窗型","type":"select","required":true,"options":["落地窗","橫拉窗","推開窗","氣密窗","天窗"]},
  {"name":"curtain","label":"窗簾需求","type":"select","required":true,"options":["布簾","百葉簾","捲簾","調光簾","不需要"]}
]'::jsonb
WHERE key = 'home__窗戶_窗簾';

-- 18. 室內設計與裝潢
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"house_area","label":"房屋坪數","type":"number","unit":"坪","required":true},
  {"name":"layout","label":"格局需求","type":"text","required":true,"placeholder":"例：3房2廳2衛"},
  {"name":"style","label":"設計風格","type":"select","required":true,"options":["現代簡約","北歐風","工業風","日式無印","古典奢華","不限風格"]}
]'::jsonb
WHERE key = 'home__室內設計與裝潢';

-- 19. 其他裝修工程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_item","label":"工程項目","type":"text","required":true,"placeholder":"請說明需要的工程項目"},
  {"name":"scope","label":"施工範圍","type":"text","required":true,"placeholder":"例：全室、客廳、特定區域"},
  {"name":"budget","label":"預算範圍","type":"text","required":true,"placeholder":"例：5-10萬"}
]'::jsonb
WHERE key = 'home__其他裝修工程';

-- 20. 保全防盜
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"equipment_type","label":"設備類型","type":"select","required":true,"options":["監視器","防盜門窗","保全系統","智能門鎖","感應器"]},
  {"name":"quantity","label":"安裝數量","type":"number","unit":"組","required":true},
  {"name":"monitor_range","label":"監控範圍","type":"text","required":true,"placeholder":"例：大門、後院、車庫、室內"}
]'::jsonb
WHERE key = 'home__保全防盜';

-- 驗證
SELECT 
    name AS "子分類",
    jsonb_array_length(form_config) AS "欄位數",
    form_config->0->'label' AS "第1個欄位"
FROM public.ai_subcategories
WHERE category_key = 'home'
ORDER BY name;
