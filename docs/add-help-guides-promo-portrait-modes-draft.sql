-- 操作介紹：商攝人像「清晰／氛圍／混合」草稿 + 更新人像總覽
-- 可重複執行；只動未發佈文章，不覆蓋你已公開的內容
-- 前台在發佈前不會出現；請到 /admin/operation-guides.html 檢視後再公開

INSERT INTO public.help_guide_pages (
    folder_id, slug, title, title_en, summary, summary_en, blocks_json, sort_order, is_published
)
SELECT
    f.id,
    'portrait-modes',
    '人像三種生成風格',
    '',
    '清晰、氛圍、混合的差別；草稿／場景底圖；衣著與外部 API 審核。',
    '',
    $hg$[
        {"type":"text","sort":0,"text":"## 這是做什麼\n人像攝影可選三種**生成風格**（清晰／氛圍／混合）。同一套主題、場景、攝影參數下，流程與成品質感不同。\n\n總覽：[/help/promo-camera/portrait](/help/promo-camera/portrait)","text_en":""},
        {"type":"text","sort":1,"text":"## 清晰\n- **流程**：一次出圖（Gemini Pro）。\n- **適合**：要快、要穩、參考圖與描述已清楚。\n- **注意**：外部生圖 API 若判定衣著／姿勢過界，可能回 400；系統會**自動重試一次**並在提示中要求依審核規則小幅調整衣著與姿勢。","text_en":""},
        {"type":"text","sort":2,"text":"## 氛圍\n- **流程**：Lite **草稿**（人與場景一起畫）→ FLUX **氛圍重拍**（統一光影與質感）。\n- **適合**：要商業攝影感、人與場景融合較自然。\n- **管理員**：可對照「草稿繪製」與「氛圍圖」兩段結果（一般使用者只看成品）。","text_en":""},
        {"type":"text","sort":3,"text":"## 混合（BETA）\n- **流程**：FLUX **文生空景**（沒有人）→ Lite **放入人物** → FLUX **氛圍重拍**。\n- **適合**：想先鎖定空景構圖與光線，再把人融進去。\n- **管理員**：可對照「場景底圖」與「成品」。混合仍在優化，請與氛圍對照挑選。","text_en":""},
        {"type":"text","sort":4,"text":"## 衣著模式\n- **依參考圖**：臉與身材＋服裝都跟參考圖（尺度大的參考圖較易被外部 API 擋）。\n- **依場景**：服裝依主題／場景決定。\n- **依描述**：服裝寫在描述欄（必填）。\n\n**衣著本身就是產品**（內衣、泳裝等）時，建議：人像參考用較保守的身份照、另傳**產品圖**、衣著選「依描述」並寫商業目錄語（lookbook／e-commerce catalog）。","text_en":""},
        {"type":"text","sort":5,"text":"## 描述審核與 400\n- 帳號可開「描述審核自動改寫」（個人帳號設定），會先潤飾**你打的描述**。\n- 外部 API 另有一套圖像審核；被擋時常見英文：`Image generation blocked…`。\n- 系統遇到此類 400 會用**相同設定重試一次**，並加上「衣著、姿勢請依審核規則適當小幅調整」；仍失敗請改參考圖、衣著模式或描述後再試。\n\n相關：[/help/faq](/help/faq)","text_en":""}
    ]$hg$::jsonb,
    35,
    false
FROM public.help_guide_folders f
WHERE f.slug = 'promo-camera'
  AND NOT EXISTS (
      SELECT 1 FROM public.help_guide_pages p
      WHERE p.folder_id = f.id AND p.slug = 'portrait-modes'
  );

UPDATE public.help_guide_pages p
SET
    summary = '商攝導演：人像攝影模式（清晰／氛圍／混合）。',
    summary_en = '',
    blocks_json = $hg$[
        {"type":"text","sort":0,"text":"## 這是做什麼\n人像模式模擬人物在場景中的商業人像／穿戴照，適合服裝、配件上身、形象圖。","text_en":""},
        {"type":"text","sort":1,"text":"## 怎麼操作\n1. `/promo-camera` 切到**人像**。\n2. 上傳人物參考（臉與身材）。\n3. 選**拍攝主題**與場景；可選產品圖、場景參考圖。\n4. 選**生成風格**：清晰／氛圍／混合（詳見 [/help/promo-camera/portrait-modes](/help/promo-camera/portrait-modes)）。\n5. 選衣著模式（依參考圖／依場景／依描述）。\n6. 看點數後生成。","text_en":""},
        {"type":"text","sort":2,"text":"## 注意\n- 請使用你有權使用的人像。解析度與點數以頁面為準。\n- 尺度較大的參考衣著可能被外部 API 擋下；可開自動改寫、改衣著模式，或見人像三種風格篇。\n- 管理員可查看氛圍「草稿」或混合「場景底圖」對照。","text_en":""}
    ]$hg$::jsonb,
    updated_at = now()
FROM public.help_guide_folders f
WHERE p.folder_id = f.id
  AND f.slug = 'promo-camera'
  AND p.slug = 'portrait'
  AND p.is_published = false;

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('help_guides_promo_portrait_modes_20260911', '1', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
