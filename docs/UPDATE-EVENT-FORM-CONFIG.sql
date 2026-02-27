-- ============================================
-- 更新活動子分類的 form_config 欄位
-- 請在 Supabase Dashboard → SQL Editor 中執行此腳本
-- ============================================

-- 1. 婚禮籌備
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"guest_count","label":"賓客人數","type":"number","unit":"人","required":true,"placeholder":"請輸入預估人數"},
  {"name":"wedding_date","label":"婚宴日期","type":"text","required":true,"placeholder":"例：2024/12/25"},
  {"name":"venue_type","label":"場地類型","type":"select","required":true,"options":["飯店宴會廳","婚宴會館","戶外婚禮","餐廳包場","自家或親友場地"]}
]'::jsonb
WHERE key = 'event__婚禮籌備';

-- 2. 場地 餐飲
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"guest_count","label":"活動人數","type":"number","unit":"人","required":true,"placeholder":"請輸入預估人數"},
  {"name":"event_date","label":"活動日期","type":"text","required":true,"placeholder":"例：2024/12/25"},
  {"name":"venue_type","label":"場地類型","type":"select","required":true,"options":["室內場地","戶外場地","餐廳","會議室","其他"]}
]'::jsonb
WHERE key = 'event__場地_餐飲';

-- 3. 設備租賃
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"equipment_type","label":"設備類型","type":"text","required":true,"placeholder":"例：音響、投影機、桌椅、舞台"},
  {"name":"rental_days","label":"租借天數","type":"number","unit":"天","required":true,"placeholder":"請輸入天數"},
  {"name":"event_scale","label":"活動規模","type":"select","required":true,"options":["小型（50人以下）","中型（50-200人）","大型（200-500人）","超大型（500人以上）"]}
]'::jsonb
WHERE key = 'event__設備租賃';

-- 4. 活動協助
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"event_type","label":"活動類型","type":"text","required":true,"placeholder":"例：尾牙、記者會、展覽、派對"},
  {"name":"guest_count","label":"活動人數","type":"number","unit":"人","required":true,"placeholder":"請輸入預估人數"},
  {"name":"service_items","label":"需要服務","type":"text","required":true,"placeholder":"例：主持人、接待人員、場控"}
]'::jsonb
WHERE key = 'event__活動協助';

-- 5. 攝影服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["婚禮攝影","活動紀錄","商業攝影","人像寫真","產品攝影"]},
  {"name":"shooting_hours","label":"拍攝時數","type":"number","unit":"小時","required":true,"placeholder":"請輸入時數"},
  {"name":"deliverables","label":"成品規格","type":"select","required":true,"options":["僅修圖照片","照片+精華影片","全程錄影","照片+婚禮MV","客製化"]}
]'::jsonb
WHERE key = 'event__攝影服務';

-- 6. 娛樂表演
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"performance_type","label":"表演類型","type":"text","required":true,"placeholder":"例：樂團、魔術、舞蹈、樂器演奏"},
  {"name":"performance_duration","label":"表演時長","type":"number","unit":"分鐘","required":true,"placeholder":"請輸入分鐘數"},
  {"name":"guest_count","label":"觀眾人數","type":"number","unit":"人","required":true,"placeholder":"請輸入預估人數"}
]'::jsonb
WHERE key = 'event__娛樂表演';

-- 驗證更新結果
SELECT 
  key, 
  name,
  CASE 
    WHEN form_config IS NULL THEN '❌ NULL'
    WHEN jsonb_typeof(form_config) = 'object' AND form_config::text = '{}' THEN '❌ 空物件 {}'
    WHEN jsonb_typeof(form_config) = 'array' AND jsonb_array_length(form_config) = 0 THEN '⚠️  空陣列 []'
    WHEN jsonb_typeof(form_config) = 'array' THEN '✅ ' || jsonb_array_length(form_config)::text || ' 個欄位'
    ELSE '❓ 未知格式'
  END as form_config_狀態
FROM public.ai_subcategories
WHERE category_key = 'event'
ORDER BY sort_order;
