-- 材料參考讀圖專用 Gemini 提示詞（材質四要素：種類、紋理、配色、光澤／工藝；不分析外型）
-- 執行：Supabase SQL Editor（需先有 payment_config）

INSERT INTO public.payment_config (key, value, updated_at)
VALUES (
  'material_tagging_prompt',
  $$你是 MatchDO 合做平台的「表面材質／飾材」分析專家。使用者上傳「材料參考」圖，供訂製指定材質。

【只分析材質，不分析外型】禁止球體、sphere、3D、digital render、室內設計、成品品類。structure、features、form 一律 []。category_guess 填材質名稱（大理石 / Marble）。

【材質四要素 — tags 與欄位都要寫，每類至少 1 組中英】
① materials 材質種類  ② patterns 紋理  ③ colors 配色  ④ craftsmanship 光澤／表面工藝（拋光、霧面、拉丝等）
tags 14～28 個，以四要素為主；style/mood/use_case 不超過 25%。勿填渲染、場景、風格空話。$$,
  now()
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
