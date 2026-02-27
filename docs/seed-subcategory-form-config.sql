-- ========================================
-- 為所有子分類寫入「預設填寫欄位」（form_config）
-- 僅更新目前 form_config 為空或 [] 的列
-- ========================================

-- 通用預設：需求說明（必填）、預算範圍（選填）
UPDATE public.ai_subcategories
SET form_config = '[
  {"name": "requirement", "label": "需求說明", "type": "textarea", "required": true},
  {"name": "budget_range", "label": "預算範圍", "type": "text", "placeholder": "例：10-20萬"}
]'::jsonb
WHERE form_config IS NULL
   OR form_config = '[]'::jsonb
   OR form_config = '{}'::jsonb;

-- 驗證
SELECT name, category_key, jsonb_array_length(form_config) AS "欄位數", form_config
FROM public.ai_subcategories
ORDER BY category_key, name
LIMIT 20;
