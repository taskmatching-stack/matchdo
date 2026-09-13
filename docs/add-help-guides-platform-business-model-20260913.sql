-- 操作介紹：平台介紹／商業模式（D2B2C、Embed、角色鏈）
-- 可重複執行。文案避免 ASCII 分號，以免後台 migration 以 ; 切句時被截斷。

INSERT INTO public.help_guide_folders (slug, title, title_en, sort_order, is_published)
VALUES ('platform', '平台介紹', 'Platform', 5, true)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    title_en = EXCLUDED.title_en,
    sort_order = EXCLUDED.sort_order,
    is_published = EXCLUDED.is_published,
    updated_at = now();

INSERT INTO public.help_guide_pages (
    folder_id, slug, title, title_en, summary, summary_en, blocks_json, sort_order, is_published
)
SELECT
    f.id,
    'business-model',
    '平台如何運作',
    'How MatchDO works',
    'MatchDO 連結訂製需求與製造商。D2B2C 模式：需求方用 AI 產出設計稿並媒合廠商，廠商可 Embed 工具到自家官網服務客戶。',
    'MatchDO connects custom design demand with manufacturers. D2B2C: designers create with AI and match makers, who can embed the tool on their own site.',
    '[]'::jsonb,
    0,
    true
FROM public.help_guide_folders f
WHERE f.slug = 'platform'
  AND NOT EXISTS (
      SELECT 1 FROM public.help_guide_pages p
      WHERE p.folder_id = f.id AND p.slug = 'business-model'
  );

UPDATE public.help_guide_pages p
SET
    title = '平台如何運作',
    title_en = 'How MatchDO works',
    summary = 'MatchDO 連結訂製需求與製造商。D2B2C 模式：需求方用 AI 產出設計稿並媒合廠商，廠商可 Embed 工具到自家官網服務客戶。',
    summary_en = 'MatchDO connects custom design demand with manufacturers. D2B2C: designers create with AI and match makers, who can embed the tool on their own site.',
    is_published = true,
    blocks_json = $hg$[
        {"type":"text","sort":0,"text":"## 一句話\nMatchDO 合做連結**想訂製的人**與**能接單的製造商**。你用 AI 把想法變成可跟廠商溝通的設計稿，再依產品分類找到合適的廠商。製造商也可以把試做工具嵌進自己的官網，讓自己的客戶在官網裡直接體驗。","text_en":"## In short\nMatchDO connects **people who want something made** with **manufacturers who can make it**. You turn an idea into a design brief with AI, then browse makers by product category. Makers can also embed the try-out tool on their own website so their customers can experience it there."},
        {"type":"text","sort":1,"text":"## 商業模式\n平台採 **D2B2C**（Direct-to-Business-to-Consumer）：\n\n- **需求方**在 MatchDO 用 AI 視覺化工具產出訂製設計與需求，對接合適的生產廠商\n- **製造商**透過公開首頁與素材庫被找到，也可把 **Embed**（嵌入式試做工具，亦稱 MatchDO Engine）放到自家官網\n- **終端消費者**在廠商官網的 Embed 裡試做、留資或詢價，關係留在廠商端\n\n同一帳號可同時使用設計、廠商與供應商功能，沒有「角色切換」。詳見 [/help/getting-started/overview](/help/getting-started/overview)。","text_en":"## Business model\nMatchDO uses **D2B2C** (Direct-to-Business-to-Consumer):\n\n- **Demand side**: create custom designs and requirements with AI visualization tools, then connect with suitable manufacturers\n- **Manufacturers**: get discovered via a public profile and asset library, and can place **Embed** (embedded try-out tool, also called MatchDO Engine) on their own website\n- **End consumers**: try designs inside the maker's embed on the maker's site, then inquire or leave contact details—the relationship stays with the maker\n\nOne account can use design, maker, and supplier tools without a separate \"role switch\". See [/help/getting-started/overview](/help/getting-started/overview)."},
        {"type":"text","sort":2,"text":"## 誰會用到\n| 角色 | 典型情境 |\n|------|----------|\n| 訂製者／設計者 | 有訂製想法，要快速打樣、找能做的廠商 |\n| 製造商／工作室 | 展示作品與素材，接詢價，可選 Embed 到官網 |\n| 終端消費者 | 在廠商官網的 Embed 裡試做，再向該廠商詢價 |\n| 產業供應商 | 提供上游目錄，供製造商匯入材料與原型（B 線） |\n\n服務媒合（發包案）與訂製品設計是並行能力，但平台主軸是**訂製視覺化 + 製造商媒合 + 官網嵌入**。","text_en":"## Who uses it\n| Role | Typical use |\n|------|-------------|\n| Designer / demand side | Has a custom idea, needs quick mockups and a maker |\n| Manufacturer / studio | Shows portfolio and assets, takes inquiries, optional embed on own site |\n| End consumer | Tries designs in the maker's embed, then inquires with that maker |\n| Industry supplier | Offers upstream catalog for makers to import materials and prototypes (B-line) |\n\nService matching (project posting) runs in parallel, but the core story is **custom visualization + manufacturer matching + website embed**."},
        {"type":"text","sort":3,"text":"## 平台提供什麼\n- **訂製設計工作區**：選分類、寫描述、引用廠商或官方版型，生成設計稿（[/custom-product.html](/custom-product.html)）\n- **廠商公開首頁與素材庫**：設計者依分類瀏覽、引用（[/vendors.html](/vendors.html)）\n- **Embed**：廠商把試做工具嵌到外站（[/help/vendor-embed/overview](/help/vendor-embed/overview)）\n- **行銷影像**：情境圖、商攝導演等，供社群與廣告使用（與訂製主線並行）\n\n點數用於上傳、生圖、重繪等，依方案計價。見 [/help/membership](/help/membership) 或 [/subscription-plans.html](/subscription-plans.html)。","text_en":"## What the platform offers\n- **Custom design workspace**: pick a category, describe, reference vendor or official templates, generate drafts ([/custom-product.html](/custom-product.html))\n- **Public maker profiles and asset libraries**: browse and reference by category ([/vendors.html](/vendors.html))\n- **Embed**: makers embed the try-out tool on external sites ([/help/vendor-embed/overview](/help/vendor-embed/overview))\n- **Marketing images**: scene shots, promo camera, etc., for social and ads (parallel to the custom line)\n\nCredits apply to uploads, generation, redraw, and more by plan. See [/help/membership](/help/membership) or [/subscription-plans.html](/subscription-plans.html)."},
        {"type":"text","sort":4,"text":"## 常見訂製品類\n家具與家飾、皮件與箱包、服飾配件、禮品與文創、手機殼與周邊等——凡需要「先看效果、再找廠商做」的訂製品，都適合從設計稿工作區開始。實際可媒合的廠商依各分類與廠商上架內容而定。","text_en":"## Typical custom categories\nFurniture and decor, leather goods and bags, apparel accessories, gifts and merch, phone cases and peripherals—anything where you want to **see it first, then find a maker**. Which makers appear depends on category and what each maker has published."},
        {"type":"text","sort":5,"text":"## MatchDO 不是什麼\n- **不是**純 B2C 商城：成交與品牌關係在廠商端，MatchDO 提供工具與媒合\n- **不是**相片濾鏡 App：商攝與情境圖是行銷工具，不是平台唯一定位\n- **不是**只能接案的外包平台：服務媒合存在，但訂製視覺化與 Embed 是更核心的差異\n\n更短的人話版介紹見 [/about.html](/about.html)。","text_en":"## What MatchDO is not\n- **Not** a pure B2C store: transactions and brand relationships stay with makers—MatchDO provides tools and matching\n- **Not** a photo-filter app: promo and scene tools are for marketing, not the whole story\n- **Not** only a freelance marketplace: service matching exists, but custom visualization and embed are the sharper difference\n\nA shorter, human-friendly intro: [/about.html](/about.html)."}
    ]$hg$::jsonb,
    updated_at = now()
FROM public.help_guide_folders f
WHERE p.folder_id = f.id
  AND f.slug = 'platform'
  AND p.slug = 'business-model';

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('help_guides_platform_business_model_20260913', '1', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
