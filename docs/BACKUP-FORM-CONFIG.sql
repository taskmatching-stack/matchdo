-- ============================================
-- 備份目前的 form_config
-- 執行此查詢可以看到目前所有子分類的 form_config
-- ============================================

SELECT 
  key,
  name,
  form_config,
  jsonb_array_length(form_config) as 欄位數量
FROM public.ai_subcategories
WHERE category_key IN ('home', 'event', 'learn', 'health', 'beauty', 'business', 'other')
ORDER BY category_key, sort_order;

-- 如果要恢復某個子分類，使用：
-- UPDATE public.ai_subcategories
-- SET form_config = '[原本的內容]'::jsonb
-- WHERE key = '子分類key';
