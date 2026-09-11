-- 若 20260912 已跑過：補上「證件主題不鎖原圖姿勢」文案（可重複執行）

UPDATE public.help_guide_pages p
SET
    blocks_json = $hg$[
        {"type":"text","sort":0,"text":"## 這是做什麼\n人像攝影可選三種**生成風格**（清晰／氛圍／混合）。同一套主題、場景、攝影參數與衣著模式下，流程與成品質感不同。\n\n總覽：[/help/promo-camera/portrait](/help/promo-camera/portrait)","text_en":"## What this is\nPortrait photography has three **render styles** (clear / mood / hybrid). Theme, scene, camera settings, and outfit mode stay the same; the pipeline and look change.\n\nOverview: [/help/promo-camera/portrait](/help/promo-camera/portrait)"},
        {"type":"text","sort":1,"text":"## 人像通用生圖原則\n下列原則適用**整個人像模式**：三種生成風格、三種衣著（依原圖／依場景／依描述）、有沒有填描述、含證件／正式主題都一樣。選證件主題時姿勢依該主題（正面正式），不鎖原圖姿勢。\n\n- **忽略原圖姿勢**，**姿勢依場景**（可站可坐可倚靠；正式主題則依證件規格）\n- **不要情色感**（構圖預設商用生活人像）\n- 依原圖：只複製人物與衣著；依場景／依描述：只複製人物，衣服另依場景或描述\n\n畫面說明不會送給生圖模型；原則是後端寫進提示詞的。","text_en":"## Portrait-wide generation principles\nThese apply to **all of portrait mode**: every render style, every outfit mode (reference / scene / description), with or without a written description, including formal ID. Choosing the ID theme means pose follows that brief (front-facing, formal)—not the uploaded pose.\n\n- **Ignore the original pose**; **pose follows the scene** (standing, sitting, or leaning; formal ID follows ID specs)\n- **No erotic mood** (commercial lifestyle framing)\n- Reference outfit: copy person and garment only; scene / description outfit: copy the person only\n\nOn-screen hints are not sent to the image model; the backend writes these into the prompt."},
        {"type":"text","sort":2,"text":"## 清晰\n- **流程**：一次出圖。\n- **適合**：要快、要穩、參考圖與描述已清楚。","text_en":"## Clear\n- **Pipeline**: one image pass.\n- **Best for**: speed and a clear reference plus description."},
        {"type":"text","sort":3,"text":"## 氛圍\n- **流程**：草稿（人與場景一起畫）→ 氛圍重拍（統一光影與質感）。\n- **適合**：要商業攝影感、人與場景融合較自然。\n- **管理員**：可對照「草稿繪製」與「氛圍圖」（一般使用者只看成品）。","text_en":"## Mood\n- **Pipeline**: draft (person and scene together) → look restyle (unified light and texture).\n- **Best for**: a commercial still, with the person blended into the scene.\n- **Admins**: can compare draft vs look (everyone else sees the final still)."},
        {"type":"text","sort":4,"text":"## 混合（BETA）\n- **流程**：文生空景（沒有人）→ 放入人物 → 氛圍重拍。\n- **適合**：想先鎖定空景構圖與光線，再把人融進去。\n- **管理員**：可對照「場景底圖」與「成品」。混合仍在優化，請與氛圍對照挑選。","text_en":"## Hybrid (BETA)\n- **Pipeline**: empty scene → place the person → look restyle.\n- **Best for**: locking environment and light first, then integrating the person.\n- **Admins**: can compare empty scene vs final still. Hybrid is still being refined; compare with mood."},
        {"type":"text","sort":5,"text":"## 衣著模式\n- **依原圖**：臉、身材與服裝都跟參考圖。\n- **依場景**：服裝依主題／場景決定。\n- **依描述**：服裝寫在描述欄（必填）。\n\n三種衣著都遵守上一節的通用原則。**衣著本身就是產品**（內衣、泳裝等）時，建議：人像參考用較保守的身份照、另傳**產品圖**、衣著選「依描述」並寫商業目錄語。","text_en":"## Outfit modes\n- **From reference**: face, body, and garment follow the upload.\n- **From scene**: clothing follows theme and scene.\n- **From description**: clothing is written in the prompt (required).\n\nAll three still use the portrait-wide principles above. When **the garment is the product** (lingerie, swimwear), prefer a conservative identity photo, a separate **product image**, outfit = from description, and catalog wording."},
        {"type":"text","sort":6,"text":"## 描述審核與外部擋圖\n- 帳號可開「描述審核自動改寫」（個人帳號設定），只潤飾**你打的描述**；時裝／脫外套這類商業用語預設不改寫。硬擋與節流規則不變。\n- 外部生圖 API 另有圖像審核。被擋時頁面會寫「外部生圖審核未通過」。\n- **不會**自動改提示詞再送、也不會自動改成依場景。請自行換參考圖、衣著模式或描述後再試。\n\n相關：[/help/faq](/help/faq)","text_en":"## Description review and external blocks\n- Account setting “auto-polish descriptions” only rewrites **your typed prompt**. Commercial fashion copy (including removing a coat) is usually left unchanged. Hard blocks and rate limits stay the same.\n- The image API has a separate visual review. Blocks show as an external image-generation failure.\n- The app **does not** retry with a changed prompt and **does not** auto-switch to scene outfit. Change the photo, outfit mode, or description and try again.\n\nSee also: [/help/faq](/help/faq)"}
    ]$hg$::jsonb,
    updated_at = now()
FROM public.help_guide_folders f
WHERE p.folder_id = f.id
  AND f.slug = 'promo-camera'
  AND p.slug = 'portrait-modes';

UPDATE public.help_guide_pages p
SET
    blocks_json = $hg$[
        {"type":"text","sort":0,"text":"## 這是做什麼\n人像模式模擬人物在場景中的商業人像／穿戴照，適合服裝、配件上身、形象圖。","text_en":"## What this is\nPortrait mode places a person in a commercial still or wear-shot. Use it for apparel, accessories on-body, and lookbook images."},
        {"type":"text","sort":1,"text":"## 怎麼操作\n1. `/promo-camera` 切到**人像**。\n2. 上傳人物參考。\n3. 選**拍攝主題**與場景；可選產品圖、場景參考圖。\n4. 選**生成風格**：清晰／氛圍／混合（詳見 [/help/promo-camera/portrait-modes](/help/promo-camera/portrait-modes)）。\n5. 選衣著模式（依原圖／依場景／依描述）。\n6. 看點數後生成。","text_en":"## How to use it\n1. Open `/promo-camera` and choose **Portrait**.\n2. Upload a person reference.\n3. Pick a shoot theme and scene; optional product or scene photo.\n4. Pick a **render style**: clear / mood / hybrid (see [/help/promo-camera/portrait-modes](/help/promo-camera/portrait-modes)).\n5. Pick outfit mode (from reference / scene / description).\n6. Check credits and generate."},
        {"type":"text","sort":2,"text":"## 注意\n- 請使用你有權使用的人像。解析度與點數以頁面為準。\n- 人像通用原則（忽略原圖姿勢、姿勢依場景、不要情色感）三種風格與三種衣著都適用，含證件／正式主題。\n- 尺度較大的參考圖可能被外部 API 擋下；不會自動再送。可改參考圖、衣著模式或描述。\n- 管理員可查看氛圍「草稿」或混合「場景底圖」對照。","text_en":"## Notes\n- Use photos you have rights to. Resolution and credits follow the page.\n- Portrait-wide principles (ignore original pose, pose from scene, no erotic mood) apply to every style and outfit mode, including formal ID.\n- A revealing reference may be blocked by the image API; there is no auto-retry. Change the photo, outfit mode, or description.\n- Admins can compare mood drafts or hybrid empty scenes."}
    ]$hg$::jsonb,
    updated_at = now()
FROM public.help_guide_folders f
WHERE p.folder_id = f.id
  AND f.slug = 'promo-camera'
  AND p.slug = 'portrait';

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('help_guides_promo_portrait_id_pose_20260912', '1', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
