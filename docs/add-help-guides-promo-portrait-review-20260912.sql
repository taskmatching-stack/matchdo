-- 把擋下／審核說明寫進既有 /help/promo-camera/portrait-modes（不另開頁）
-- 可重複執行。文案避免 ASCII 分號，以免後台 migration 以 ; 切句時被截斷。

UPDATE public.help_guide_pages p
SET
    blocks_json = sub.blocks,
    updated_at = now()
FROM public.help_guide_folders f,
LATERAL (
    SELECT jsonb_agg(x.elem ORDER BY x.ord) AS blocks
    FROM (
        SELECT
            CASE
                WHEN COALESCE(e.elem->>'sort', '') = '6'
                    THEN $blk${"type":"text","sort":6,"text":"## 描述審核與外部擋圖\n人像生成會經過兩道審核。被擋時系統**不會改提示詞再送**，也不會自動改成依場景。\n\n**描述審核（站內）**\n- 帳號可開「描述審核自動改寫」（個人帳號設定），只潤飾**你打的描述**。時裝／脫外套這類商業用語預設不改寫。硬擋與節流規則不變。\n- 頁面若寫「描述未通過安全審核」，就是這一關。\n\n**外部生圖審核**\n- 生圖服務會看**參考圖＋場景＋描述**整包。頁面出現「外部生圖審核未通過」就是這一關。\n- 同一張參考圖在客廳／戶外常可過、**臥室**被擋，是外部規則，不是站內又擋一次。\n- 可改：場景改客廳、戶外、棚拍。參考圖改站姿或坐姿。衣著改「依場景」或「依描述」。內衣／泳裝當產品時，身份照保守、另傳產品圖。\n\n外部規範（英文）：[Google 生成式 AI 禁止用途](https://policies.google.com/terms/generative-ai)、[Gemini 生圖說明](https://ai.google.dev/gemini-api/docs/image-generation)、[Vertex Imagen 責任使用](https://cloud.google.com/vertex-ai/generative-ai/docs/image/responsible-ai-imagen)、[FLUX 使用政策](https://bfl.ai/legal/usage-policy)","text_en":"## Description review and external blocks\nPortrait generation goes through two reviews. A block is **not** retried with a changed prompt and does not auto-switch to scene outfit.\n\n**On-site description review**\n- Account setting “auto-polish descriptions” only rewrites **your typed prompt**. Commercial fashion copy (including removing a coat) is usually left unchanged. Hard blocks and rate limits stay the same.\n- If the page says the description failed safety review, that is this step.\n\n**External image review**\n- The image API reviews the **photo + scene + description** together. “External image generation review failed” is this step.\n- The same photo may pass in a living room or outdoors and fail in a **bedroom**. That is the external rule, not a second site-side filter.\n- Try a more public scene, a standing or sitting reference, or outfit mode from scene / description. If lingerie or swimwear is the product, use a conservative identity photo plus a separate product image.\n\nExternal policies: [Google Generative AI Prohibited Use](https://policies.google.com/terms/generative-ai), [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation), [Vertex Imagen responsible AI](https://cloud.google.com/vertex-ai/generative-ai/docs/image/responsible-ai-imagen), [FLUX usage policy](https://bfl.ai/legal/usage-policy)"}$blk$::jsonb
                ELSE e.elem
            END AS elem,
            e.ord
        FROM jsonb_array_elements(p.blocks_json) WITH ORDINALITY AS e(elem, ord)
    ) x
) sub
WHERE p.folder_id = f.id
  AND f.slug = 'promo-camera'
  AND p.slug = 'portrait-modes';

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('help_guides_promo_portrait_review_20260912', '1', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
