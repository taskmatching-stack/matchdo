-- ============================================
-- 請立即在 Supabase SQL Editor 執行此文件！
-- 這會更新所有子分類的 form_config
-- ============================================

-- 這個文件是 UPDATE-HOME-FORM-CONFIG.sql 的完整版
-- 請直接執行 UPDATE-HOME-FORM-CONFIG.sql 
-- 或者執行下面這個簡化版（只更新前 3 個居家子分類）

-- 1. 清潔服務
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"area","label":"清潔坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
  {"name":"clean_type","label":"清潔類型","type":"select","required":true,"options":["日常清潔","空屋細清","裝潢後粗清","辦公室清潔"]},
  {"name":"floor_elevator","label":"樓層與電梯","type":"text","required":true,"placeholder":"例：5樓，無電梯"},
  {"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}
]'::jsonb
WHERE key = 'home__清潔服務';

-- 2. 家電 燈具
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"appliance_type","label":"設備類型","type":"text","required":true,"placeholder":"例：冷氣、冰箱、燈具"},
  {"name":"quantity","label":"數量","type":"number","unit":"個","required":true,"placeholder":"請輸入數量"},
  {"name":"service_type","label":"服務類型","type":"select","required":true,"options":["安裝","維修","更換","移機"]},
  {"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}
]'::jsonb
WHERE key = 'home__家電_燈具';

-- 3. 廚房
UPDATE public.ai_subcategories
SET form_config = '[
  {"name":"kitchen_length","label":"廚房長度","type":"number","unit":"尺","required":true,"placeholder":"例：8尺、10尺"},
  {"name":"kitchen_type","label":"廚具類型","type":"select","required":true,"options":["系統廚具","訂製廚具","更換檯面","更換門片","全套更新"]},
  {"name":"has_appliances","label":"是否含電器","type":"select","required":true,"options":["含電器","不含電器","部分含電器"]},
  {"name":"note","label":"補充說明","type":"textarea","required":false,"placeholder":"請補充其他需求或說明"}
]'::jsonb
WHERE key = 'home__廚房';

-- ============================================
-- 驗證更新結果
-- ============================================
SELECT 
  key,
  name,
  CASE
    WHEN form_config IS NULL THEN '❌ NULL'
    WHEN jsonb_typeof(form_config) = 'array' AND jsonb_array_length(form_config) = 4 THEN '✅ 4個欄位'
    WHEN jsonb_typeof(form_config) = 'array' THEN '⚠️ ' || jsonb_array_length(form_config)::text || '個欄位'
    ELSE '❓ 未知'
  END as 狀態
FROM public.ai_subcategories
WHERE key IN ('home__清潔服務', 'home__家電_燈具', 'home__廚房')
ORDER BY key;

-- ============================================
-- 注意事項
-- ============================================
-- 1. 如果要更新所有 86 個子分類，請執行 UPDATE-HOME-FORM-CONFIG.sql
-- 2. 這個文件只更新了 3 個子分類作為測試
-- 3. 執行完後請刷新首頁測試
