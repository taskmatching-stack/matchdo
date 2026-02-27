-- 直接更新居家子分類的 form_config
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
  {"name":"quantity","label":"數量","type":"number","unit":"扇","required":true},
  {"name":"door_type","label":"門片類型","type":"select","required":true,"options":["房門","廚房門","浴室門","拉門","摺疊門"]},
  {"name":"material","label":"材質需求","type":"text","required":true,"placeholder":"例：木質、玻璃、鋁合金"}
]'::jsonb
WHERE key = 'home__門片_拉門';

-- 5. 木工 油漆 壁紙
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施作坪數","type":"number","unit":"坪","required":true},
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["木作裝潢","油漆粉刷","壁紙施工","木地板"]},
  {"name":"scope","label":"施作範圍","type":"text","required":true,"placeholder":"例：全室、客廳、主臥"}
]'::jsonb
WHERE key = 'home__木工_油漆_壁紙';

-- 6. 泥作 圍藝
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施作坪數","type":"number","unit":"坪","required":true},
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["泥作隔間","地坪整平","外牆修繕","圍牆施工"]},
  {"name":"location","label":"施作位置","type":"text","required":true,"placeholder":"例：室內、室外、庭院"}
]'::jsonb
WHERE key = 'home__泥作_圍藝';

-- 7. 家事服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["鐘點家事","月嫂保姆","看護照顧","管家服務"]},
  {"name":"frequency","label":"服務頻率","type":"select","required":true,"options":["單次","每週","每月","長期"]},
  {"name":"hours","label":"服務時數","type":"number","unit":"小時","required":true}
]'::jsonb
WHERE key = 'home__家事服務';

-- 8. 搬家 回收
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"move_type","label":"搬運類型","type":"select","required":true,"options":["家庭搬家","辦公室搬遷","垃圾清運","廢棄物回收"]},
  {"name":"from_floor","label":"搬出樓層","type":"text","required":true,"placeholder":"例：3樓，有電梯"},
  {"name":"to_floor","label":"搬入樓層","type":"text","required":true,"placeholder":"例：5樓，無電梯"}
]'::jsonb
WHERE key = 'home__搬家_回收';

-- 9. 抓漏防水
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"leak_location","label":"漏水位置","type":"text","required":true,"placeholder":"例：浴室、外牆、屋頂"},
  {"name":"area","label":"施作面積","type":"number","unit":"坪","required":true},
  {"name":"leak_duration","label":"漏水時間","type":"select","required":true,"options":["新發現","1個月內","3個月內","半年以上"]}
]'::jsonb
WHERE key = 'home__抓漏防水';

-- 10. 櫥櫃 家具
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"furniture_type","label":"家具類型","type":"text","required":true,"placeholder":"例：衣櫃、書櫃、鞋櫃"},
  {"name":"quantity","label":"數量","type":"number","unit":"組","required":true},
  {"name":"size","label":"尺寸需求","type":"text","required":true,"placeholder":"例：寬200cm x 高240cm"}
]'::jsonb
WHERE key = 'home__櫥櫃_家具';

-- 11. 消毒除蟲
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施作坪數","type":"number","unit":"坪","required":true},
  {"name":"pest_type","label":"蟲害類型","type":"select","required":true,"options":["蟑螂","老鼠","白蟻","跳蚤","其他"]},
  {"name":"severity","label":"嚴重程度","type":"select","required":true,"options":["輕微","中等","嚴重"]}
]'::jsonb
WHERE key = 'home__消毒除蟲';

-- 12. 地板 地毯 磁磚
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"施作坪數","type":"number","unit":"坪","required":true},
  {"name":"floor_type","label":"地材類型","type":"select","required":true,"options":["木地板","磁磚","地毯","塑膠地板"]},
  {"name":"room","label":"施作空間","type":"text","required":true,"placeholder":"例：客廳、臥室、全室"}
]'::jsonb
WHERE key = 'home__地板_地毯_磁磚';

-- 13. 鐵作 採光罩
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["鐵窗","鐵門","樓梯扶手","採光罩","遮雨棚"]},
  {"name":"area","label":"施作面積","type":"number","unit":"坪","required":true},
  {"name":"location","label":"施作位置","type":"text","required":true,"placeholder":"例：陽台、頂樓、前院"}
]'::jsonb
WHERE key = 'home__鐵作_採光罩';

-- 14. 寵物
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["寵物美容","寵物訓練","寵物保姆","寵物醫療"]},
  {"name":"pet_type","label":"寵物類型","type":"text","required":true,"placeholder":"例：狗、貓、其他"},
  {"name":"weight","label":"寵物體重","type":"number","unit":"公斤","required":true}
]'::jsonb
WHERE key = 'home__寵物';

-- 15. 水電工程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["水電維修","管線更新","配電箱更換","新增插座迴路"]},
  {"name":"location","label":"施作位置","type":"text","required":true,"placeholder":"例：廚房、浴室、全室"},
  {"name":"urgency","label":"急迫性","type":"select","required":true,"options":["一般","緊急"]}
]'::jsonb
WHERE key = 'home__水電工程';

-- 16. 衛浴
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["衛浴翻新","馬桶更換","淋浴設備","浴缸安裝"]},
  {"name":"area","label":"衛浴坪數","type":"number","unit":"坪","required":true},
  {"name":"budget","label":"預算範圍","type":"text","required":true,"placeholder":"例：10-20萬"}
]'::jsonb
WHERE key = 'home__衛浴';

-- 17. 窗戶 窗簾
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_type","label":"工程類型","type":"select","required":true,"options":["窗簾訂製","窗戶更換","氣密窗","百葉窗"]},
  {"name":"quantity","label":"數量","type":"number","unit":"扇/組","required":true},
  {"name":"size","label":"尺寸","type":"text","required":true,"placeholder":"例：寬150cm x 高200cm"}
]'::jsonb
WHERE key = 'home__窗戶_窗簾';

-- 18. 室內設計與裝潢
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"裝潢坪數","type":"number","unit":"坪","required":true},
  {"name":"design_scope","label":"設計範圍","type":"select","required":true,"options":["全室設計","局部裝修","風格規劃","舊屋翻新"]},
  {"name":"budget","label":"預算範圍","type":"text","required":true,"placeholder":"例：50-100萬"}
]'::jsonb
WHERE key = 'home__室內設計與裝潢';

-- 19. 其他裝修工程
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"work_description","label":"工程描述","type":"textarea","required":true,"placeholder":"請詳細描述您的需求"},
  {"name":"area","label":"施作面積/數量","type":"text","required":true,"placeholder":"例：10坪或5個"},
  {"name":"budget","label":"預算範圍","type":"text","required":true,"placeholder":"例：5-10萬"}
]'::jsonb
WHERE key = 'home__其他裝修工程';

-- 20. 保全防盜
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["監視系統","防盜系統","門禁管理","保全服務"]},
  {"name":"quantity","label":"設備數量","type":"number","unit":"組","required":true},
  {"name":"location","label":"安裝位置","type":"text","required":true,"placeholder":"例：大門、後院、全室"}
]'::jsonb
WHERE key = 'home__保全防盜';

-- 驗證更新結果
SELECT key, name, 
       CASE 
         WHEN form_config IS NULL THEN '空值'
         WHEN jsonb_array_length(form_config) = 0 THEN '空陣列'
         ELSE jsonb_array_length(form_config)::text || ' 個欄位'
       END as 欄位狀態
FROM public.ai_subcategories
WHERE category_key = 'home'
ORDER BY sort_order;
