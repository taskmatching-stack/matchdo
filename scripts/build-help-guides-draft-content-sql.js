'use strict';

/**
 * 產生 docs/add-help-guides-draft-content.sql
 * 每篇拆成獨立文字區塊（用途／操作／注意），只更新未發佈草稿。
 * 英文欄位刻意留空：中文修正後再翻譯。
 */
const fs = require('fs');
const path = require('path');

function blocks() {
    const out = [];
    for (var i = 0; i < arguments.length; i += 2) {
        var zh = arguments[i];
        if (!zh) continue;
        out.push({ type: 'text', sort: out.length, text: String(zh || ''), text_en: '' });
    }
    return out;
}

const pages = [
    // —— 開始使用 ——
    ['getting-started', 'overview',
        '同一個 Email 帳號，沒有訂製者／製造商／供應商角色切換。',
        'One account; no role switch between designer, manufacturer, and supplier.',
        blocks(
            '## 這是做什麼\nMatchDO 用**同一個登入帳號**完成設計、找廠商、上架素材。選單裡的 ① 訂製／設計、② 製造商、③ 產業供應商只是「我的功能」分區標題，方便找入口，**不是**三種身分、也不用切換角色。',
            '## What this is for\nOne MatchDO login covers design, finding makers, and listing materials. ① ② ③ in **My features** are section headings only — not roles, and there is no role switch.',
            '## 怎麼操作\n1. 用 Google 或 Email 密碼登入（可並存在同一帳號）。\n2. 頂部「客製產品」進設計稿、版型、行銷影像與輔助工具。\n3. 「我的功能」看 ①②③ 全部入口（資格不足時頁面會說明，選單不會藏起來）。\n4. 方案與點數在「方案與定價」「我的點數」。',
            '## How to use it\n1. Sign in with Google or email-password (both can stay on the same account).\n2. Use **Custom products** for drafts, styles, marketing images, and helper tools.\n3. **My features** always shows ①②③; the page explains limits — links are not hidden.\n4. Plans and credits: **Pricing** and **My credits**.',
            '## 注意\n全站只有兩項業務限制：免費帳號不能上傳**產品／素材**（展示案例除外）；沒有至少 1 件**展示中**作品，不能匯入產業供應商目錄。管理員與測試員不受限。\n\n相關：[/help/getting-started/login](/help/getting-started/login)、[/help/membership/free-limits](/help/membership/free-limits)',
            '## Notes\nOnly two business limits: free accounts cannot upload products or assets (portfolio cases excepted); importing a supplier catalog needs at least one public portfolio case. Admins and testers are exempt.\n\nSee [/help/getting-started/login](/help/getting-started/login), [/help/membership/free-limits](/help/membership/free-limits)'
        )],
    ['getting-started', 'login',
        'Google 與 Email 密碼可並存在同一帳號；可設定密碼與忘記密碼。',
        'Google and email-password can both be used on the same account.',
        blocks(
            '## 這是做什麼\n同一個 Email 可以同時用 **Google 登入** 和 **Email＋密碼**。之後用哪一種都能進同一個帳號、同一份點數與作品，不必另開身分。',
            '## What this is for\nThe same email can use **Google** and **email + password**. Either method opens the same account, credits, and work.',
            '## 用 Google 登入\n1. 點「使用 Google 登入」。\n2. 選要綁定的 Google 帳號。\n3. 第一次會建立 MatchDO 帳號；之後同一 Google 即登入。',
            '## Sign in with Google\n1. Choose **Continue with Google**.\n2. Pick the Google account.\n3. The first time creates a MatchDO account; later visits sign you in.',
            '## 用 Email 與密碼\n1. 輸入 Email 與密碼註冊或登入。\n2. 若此 Email 已用 Google 註冊，可在帳號設定裡**再設一組密碼**，兩種方式並存。\n3. 忘記密碼：登入頁「忘記密碼」→ 收信重設。',
            '## Email and password\n1. Register or sign in with email and password.\n2. If the email already used Google, add a password in account settings so both methods work.\n3. Forgot password: use the sign-in link and reset from email.',
            '## 注意\n請用你收得到信的 Email。重設連結有時效。登入後點數、設計稿、廠商資料都掛在這個帳號上。',
            '## Notes\nUse an email you can open. Reset links expire. Credits, drafts, and vendor data stay on this account.'
        )],
    ['getting-started', 'first-visit',
        '建議先看設計稿或商攝，再決定要不要建立廠商資料。',
        'Suggested first path: design draft or promo camera.',
        blocks(
            '## 這是做什麼\n第一次進來不必一次把所有功能學完。依你現在要做的事選一條路即可。',
            '## What this is for\nYou do not need every tool on day one. Pick one path for what you want now.',
            '## 想先出設計圖\n到「客製產品 → 設計稿」（`/custom-product.html`）。選分類、寫描述或帶入版型後生圖，再存到我的數位資產。\n\n詳細：[/help/design-draft/](/help/design-draft/)',
            '## Start with a design\nOpen **Custom products → Design draft** (`/custom-product.html`). Pick a category, write a prompt or bring in a style, generate, then save to My assets.\n\nSee [/help/design-draft/](/help/design-draft/)',
            '## 想先做行銷影像\n- 場景合成：情境圖 `/promo-image/` → [/help/promo-image/](/help/promo-image/)\n- 拍攝模擬：商攝導演 `/promo-camera`（產品／空間／人像）→ [/help/promo-camera/](/help/promo-camera/)',
            '## Start with marketing images\n- Scene composite: `/promo-image/` → [/help/promo-image/](/help/promo-image/)\n- Shoot simulation: `/promo-camera` (product / space / portrait) → [/help/promo-camera/](/help/promo-camera/)',
            '## 想被設計者找到\n同一帳號即可。先建立廠商資料，再上傳至少 1 件**展示中**作品，然後在素材管理上傳版型（付費方案才能上傳產品／素材）。\n\n詳細：[/help/vendor-start/](/help/vendor-start/)',
            '## Be found as a maker\nSame account. Create a manufacturer profile, publish at least one portfolio case, then upload styles (paid plan required for products and assets).\n\nSee [/help/vendor-start/](/help/vendor-start/)'
        )],

    // —— 設計稿 ——
    ['design-draft', 'overview',
        '同一工作區兩種進法：無樣版（只靠描述／分類）與有樣版（帶入廠商或官方版型）。',
        'Same workspace: no template, or with a vendor / official template.',
        blocks(
            '## 這是做什麼\n設計稿是訂製產品的**生圖工作區**：選分類、寫你要的成品，必要時加上參考圖或版型，再生成設計圖。列表與目錄不在這一頁。',
            '## What this is for\nThe design draft is the **image workspace**: category, description, optional references or a style, then generate. Catalogs live on their own list pages.',
            '## 無樣版怎麼做\n1. 開啟 `/custom-product.html`。\n2. 選主分類（必選）；有子分類時再選子分類。\n3. 用文字描述造型、材質、顏色、結構。\n4. 可加本機參考圖（見參考圖篇）。\n5. 按生成；點數以頁面上的數字為準。',
            '## Without a template\n1. Open `/custom-product.html`.\n2. Pick a main category (required) and a subcategory when shown.\n3. Describe shape, material, color, and structure.\n4. Optionally add local reference images.\n5. Generate. Credits follow the number on the page.',
            '## 有樣版怎麼做\n從「廠商版型」或「官方版型」列表點「用此款進行設計」，會帶著該版型進入同一工作區，再改描述或加參考圖後生圖。\n\n列表：[/help/design-draft/vendor-styles](/help/design-draft/vendor-styles)、[/help/design-draft/official-templates](/help/design-draft/official-templates)',
            '## With a template\nFrom vendor or official lists, use **Design with this style**. You stay in the same workspace with that style loaded.\n\nSee [/help/design-draft/vendor-styles](/help/design-draft/vendor-styles), [/help/design-draft/official-templates](/help/design-draft/official-templates)',
            '## 注意\n設計稿只負責建立／編輯與生圖，不是官方版型或廠商版型的總目錄。生成後可存到我的數位資產，並選擇要不要出現在首頁靈感牆。',
            '## Notes\nThis page is the workspace, not the public catalog. After generate, save to My assets and choose whether it appears on the media wall.'
        )],
    ['design-draft', 'references',
        '本機上傳、廠商素材庫、官方版型，三種來源怎麼選。',
        'Local upload, vendor library, or official templates.',
        blocks(
            '## 這是做什麼\n參考圖告訴生圖「長相與材質要朝哪裡靠」。來源有三種：你電腦上的圖、廠商素材庫、官方版型。',
            '## What this is for\nReferences steer look and material. Three sources: files on your computer, the vendor library, and official templates.',
            '## 本機上傳\n在參考圖區按「＋」選檔。適合手繪、實拍、自己的稿。圖會跟著這次設計使用。',
            '## Local upload\nUse **+** in the reference area. Good for sketches, photos, or your own art.',
            '## 從廠商素材庫選擇\n1. **先選好主分類**（沒選分類會對不到廠商上傳的素材）。\n2. 點「從廠商素材庫選擇」。\n3. 點卡片加入參考；卡片上有廠商名稱，之後可連到該廠。\n若該分類尚無公開素材，會顯示尚無圖。',
            '## Vendor library\n1. **Pick a main category first**.\n2. Open **Choose from vendor library**.\n3. Click a card to add it; the vendor name is on the card.\nEmpty category = no public assets yet.',
            '## 官方版型\n到獨立列表 `/official-templates/` 瀏覽後「用此款進行設計」，或在設計稿走官方版型入口。官方版型是平台共用範例，顯示名固定為「官方版型」。',
            '## Official templates\nBrowse `/official-templates/` then **Design with this style**, or use the official entry in the workspace. Display name is always Official templates.',
            '## 注意\n廠商庫沒圖時，先確認主分類是否與廠商上傳時相同。相關：[/help/faq](/help/faq)',
            '## Notes\nIf the library is empty, check the main category matches what vendors uploaded. See [/help/faq](/help/faq)'
        )],
    ['design-draft', 'vendor-styles',
        '公開列表瀏覽廠商版型，再用此版型進入設計稿。',
        'Browse public vendor styles, then design with one.',
        blocks(
            '## 這是做什麼\n廠商把數位原型公開後，你可在獨立列表挑選「用此款進行設計」。這是**真列表頁**，不是設計稿裡的分頁。',
            '## What this is for\nPublic vendor prototypes live on their own list. Pick one and jump into the design workspace. This is a real list page, not a tab on the design tool.',
            '## 怎麼瀏覽\n1. 打開 `/vendor-styles/`。\n2. 用主分類／子分類（與搜尋）縮小範圍。\n3. 卡片可看圖、廠商與「看可搭配」（有關聯材料／配件時）。',
            '## How to browse\n1. Open `/vendor-styles/`.\n2. Filter by category, subcategory, or search.\n3. Cards show images, the vendor, and **See matches** when materials or parts are linked.',
            '## 用此版型設計\n點「用此款進行設計」會進入設計稿並帶入該版型。之後仍可改描述、加參考圖再生成。',
            '## Design with this style\n**Design with this style** opens the draft with that prototype. You can still edit the prompt and add references.',
            '## 注意\n也可改逛 [/help/design-draft/official-templates](/help/design-draft/official-templates)。廠商要出現在此列表，需在素材管理上傳並公開、且選對主分類。',
            '## Notes\nYou can also browse official templates. Vendors appear here after they upload a public prototype with the correct main category.'
        )],
    ['design-draft', 'official-templates',
        '公開列表瀏覽官方版型，再用此版型進入設計稿。',
        'Browse official templates, then design with one.',
        blocks(
            '## 這是做什麼\n官方版型是平台提供的共用數位原型／材料／配件範例，方便還沒有指定廠商時先設計。列表在獨立網址，不是設計稿分頁。',
            '## What this is for\nOfficial templates are platform-shared prototypes, materials, and parts so you can design before choosing a vendor. They have their own URL.',
            '## 怎麼瀏覽\n1. 打開 `/official-templates/`。\n2. 選分類與素材類型（預設看數位原型；也可切材料／配件或全部）。\n3. 有關聯時可「看可搭配」看產品樹。',
            '## How to browse\n1. Open `/official-templates/`.\n2. Filter by category and type (prototypes by default; materials, parts, or all).\n3. Use **See matches** when a product tree exists.',
            '## 用此版型設計\n原型按「用此款進行設計」；材料／配件多為「加入參考圖」。都會深鏈進設計稿並帶上分類。',
            '## Design with this template\nPrototypes: **Design with this style**. Materials and parts: **Add as reference**. Both open the draft with category filled in.',
            '## 注意\n前台顯示名固定「官方版型」。管理員上傳在後台官方版型庫，一般設計者不進該後台。',
            '## Notes\nThe public name is always Official templates. Admins upload in the official library; designers do not use that admin page.'
        )],
    ['design-draft', 'generate-and-save',
        '生圖、存到我的數位資產，以及要不要出現在媒體牆。',
        'Generate, save to My assets, and media-wall visibility.',
        blocks(
            '## 這是做什麼\n把目前工作區的描述、分類與參考圖送給生圖，完成後可存成你的數位資產，之後再設計、商攝或找廠商。',
            '## What this is for\nSend the current prompt, category, and references to generate. Save the result to My assets for later design, promo shots, or finding a maker.',
            '## 怎麼生成\n1. 確認分類與描述（有樣版時先看版型是否已帶入）。\n2. 看按鈕旁的點數（無參考／有參考可能不同，**以當頁顯示為準**）。\n3. 點生成，等結果預覽。\n4. 不滿意可改描述或參考圖再生成。',
            '## How to generate\n1. Check category and prompt (and that a style loaded if you came from a list).\n2. Read the credit cost on the button (with/without references may differ — **trust the page**).\n3. Generate and wait for preview.\n4. Edit and generate again if needed.',
            '## 存到我的數位資產\n生成後按儲存（或頁面上同等按鈕）。之後在 `/client/my-custom-products.html` 可再開來改、當參考、做情境圖或商攝。',
            '## Save to My assets\nSave after generate. Reopen from `/client/my-custom-products.html` to edit, reuse as a reference, or send to scene / promo camera.',
            '## 不上媒體牆\n儲存或公開時可選擇不要出現在首頁靈感牆。不上牆的作品仍在我的數位資產。\n\n見 [/help/membership/hide-from-wall](/help/membership/hide-from-wall)',
            '## Hide from the media wall\nYou can keep a piece off the homepage wall. It remains in My assets.\n\nSee [/help/membership/hide-from-wall](/help/membership/hide-from-wall)'
        )],

    // —— 以風格／行銷／輔助 ——
    ['materials', 'overview',
        '材料組合：用雙色或三色配比生成材料／色卡參考，再帶回設計稿。',
        'Material combinations: dual- or tri-color palettes as references for design.',
        blocks(
            '## 這是做什麼\n材料組合用來做出**材料表面／配色參考圖**（雙色或三色、可套配色範例），不是整件產品的結構設計。做好後可存進我的數位資產，再匯入設計稿當材料參考。',
            '## What this is for\nBuild a **surface / color-combo reference** (two or three colors, optional palette examples). It is not the full product structure. Save it, then import it as a material reference in the design draft.',
            '## 怎麼操作\n1. 打開 `/client/material-dual-color.html`（客製產品 → 材料組合）。\n2. 選雙色或三色，調整主色／輔色與比重。\n3. 可開「配色範例」套用官方或你存過的組合。\n4. 生成（需登入與點數，以頁面為準）。\n5. 結果出現在「我的數位資產」的材料組合分頁。',
            '## How to use it\n1. Open `/client/material-dual-color.html`.\n2. Choose two or three colors and adjust ratios.\n3. Optionally apply a palette example.\n4. Generate (sign-in and credits; see the page).\n5. Find the result under **Material combinations** in My assets.',
            '## 注意\n任何登入＋點數即可生成，不必先有廠商資料。設計稿可從資產庫把材料組合圖拉進材料槽。\n\n相關：[/help/my-assets/](/help/my-assets/)、[/help/design-draft/references](/help/design-draft/references)',
            '## Notes\nAny signed-in user with credits can generate — no manufacturer profile required. Import the image into the material slot on the design draft.\n\nSee [/help/my-assets/](/help/my-assets/), [/help/design-draft/references](/help/design-draft/references)'
        )],
    ['print-asset', 'overview',
        '印花：做出可印在產品表面的圖樣／印花稿。',
        'Print assets: artwork meant to sit on a product surface.',
        blocks(
            '## 這是做什麼\n印花工具產出**表面圖樣／印花稿**，之後可當設計稿的表面印刷參考，而不是整件產品建模。',
            '## What this is for\nCreate **surface graphic / print artwork**, then use it as a print reference on a design draft — not a full 3D product.',
            '## 怎麼操作\n1. 打開 `/client/print-asset.html`。\n2. 依頁面說明準備圖或描述。\n3. 生成後存到我的數位資產（印花分頁）。\n4. 回到設計稿，從資產庫或參考圖帶入。',
            '## How to use it\n1. Open `/client/print-asset.html`.\n2. Follow the page for image or prompt.\n3. Save to My assets (Print tab).\n4. Bring it into the design draft as a reference.',
            '## 注意\n點數與可下載格式以該頁顯示為準。請使用你有權使用的圖樣，避免侵權素材。',
            '## Notes\nCredits and download options follow the page. Use artwork you have the right to use.'
        )],
    ['promo-image', 'overview',
        '情境圖：把產品放進場景的行銷圖。',
        'Scene images for marketing.',
        blocks(
            '## 這是做什麼\n情境圖把**已有的產品圖**放進使用場景（生活、陳列、空間），做出行銷用圖。偏「場景合成」，不是商攝導演那種拍攝參數模擬。',
            '## What this is for\nPlace an **existing product image** into a lifestyle or display scene. This is scene compositing, not promo-camera shoot simulation.',
            '## 怎麼操作\n1. 打開 `/promo-image/`。\n2. 選或上傳產品圖（可從數位資產帶入）。\n3. 選場景／情境後生成。\n4. 結果可進我的數位資產「情境圖」分頁。',
            '## How to use it\n1. Open `/promo-image/`.\n2. Choose or upload a product image (including from My assets).\n3. Pick a scene and generate.\n4. Results appear under **Scene images** in My assets.',
            '## 與商攝導演的差別\n- **情境圖**：現成產品圖 × 場景。\n- **商攝導演**：產品／空間／人像的拍攝模擬（燈光、鏡頭、空間地圖等）。\n\n商攝說明：[/help/promo-camera/](/help/promo-camera/)',
            '## vs promo camera\n- **Scene images**: product photo × setting.\n- **Promo camera**: product / space / portrait shoot simulation (light, lens, space map).\n\nSee [/help/promo-camera/](/help/promo-camera/)'
        )],

    ['promo-camera', 'overview',
        '商攝導演三種模式：產品、空間、人像。官網與手機 App 共用帳號與點數。',
        'Three modes: product, space, portrait. Same account and credits on web and app.',
        blocks(
            '## 這是做什麼\n商攝導演用來**模擬商業攝影**：先選模式，再調拍攝條件後出圖。適合已有產品或空間概念、要行銷視覺時。',
            '## What this is for\nSimulate a **commercial shoot**: pick a mode, set the brief, generate. Use it when you already have a product or space idea and need marketing stills.',
            '## 三種模式\n- 產品攝影：單件或一組產品的棚拍／情境拍 → [/help/promo-camera/product](/help/promo-camera/product)\n- 空間攝影：平面配置 → 空間地圖 → 標記 → 平視 → [/help/promo-camera/space](/help/promo-camera/space)\n- 人像攝影：人物與服裝／場景 → [/help/promo-camera/portrait](/help/promo-camera/portrait)',
            '## Three modes\n- Product → [/help/promo-camera/product](/help/promo-camera/product)\n- Space (plan → map → markers → eye-level) → [/help/promo-camera/space](/help/promo-camera/space)\n- Portrait → [/help/promo-camera/portrait](/help/promo-camera/portrait)',
            '## 怎麼進入\n- 官網：`/promo-camera`（選單與頭像也可進）\n- 手機網頁 App：`/promo-camera-app`（同一帳號、同一點數）→ [/help/promo-camera/pwa-app](/help/promo-camera/pwa-app)\n- 設計稿也可嵌入商攝（手機與桌面入口不同，功能同一套點數）',
            '## Where to open it\n- Web: `/promo-camera`\n- Mobile PWA: `/promo-camera-app` (same account and credits) → [/help/promo-camera/pwa-app](/help/promo-camera/pwa-app)\n- The design draft can embed promo camera; credits are the same.',
            '## 注意\n點數與解析度（含 2K／4K）一律以**當頁顯示**為準。生成前看預扣點數。',
            '## Notes\nCredits and resolution (including 2K / 4K) follow **the number on the page**. Check the preview cost before you generate.'
        )],
    ['promo-camera', 'product',
        '商攝導演：產品攝影模式。',
        'Promo camera: product mode.',
        blocks(
            '## 這是做什麼\n產品模式用來拍「商品照」：白底、情境、多角度等，適合已有產品外觀、要上架或社群圖時。',
            '## What this is for\nProduct mode makes catalog-style shots (white background, lifestyle, angles) when you already have a product look.',
            '## 怎麼操作\n1. 打開 `/promo-camera`，切到**產品**。\n2. 上傳或選產品圖（可從設計稿／資產帶入）。\n3. 調場景、光線、鏡頭等規格（左欄可收折）。\n4. 看點數後按生成。\n5. 結果可下載或留在商攝紀錄，再帶進其他工具。',
            '## How to use it\n1. Open `/promo-camera` → **Product**.\n2. Upload or pick a product image (including from a draft or assets).\n3. Set scene, light, and lens (the left spec panel can collapse).\n4. Check credits, then generate.\n5. Download or keep the shot for later tools.',
            '## 注意\n解析度與點數以頁面為準。產品圖越清楚、裁切越乾淨，通常越穩。',
            '## Notes\nResolution and credits follow the page. A clear, well-cropped product image is usually more stable.'
        )],
    ['promo-camera', 'space',
        '平面配置 → 空間地圖 → 地圖標記 → 平視攝影。',
        'Floor plan → space map → markers → eye-level shot.',
        blocks(
            '## 這是做什麼\n空間模式從**平面配置**做出空間感，再在地圖上標記要拍的位置，最後出平視照片。適合展場、店舖、室內陳列。',
            '## What this is for\nSpace mode turns a **floor plan** into a mapped interior, then an eye-level shot from marked spots. Use it for stores, booths, and interiors.',
            '## 平面配置與空間地圖\n1. 切到**空間**模式。\n2. 上傳或描述平面／格局。\n3. 生成或確認**空間地圖**（俯視配置）。\n4. 地圖上用 A–Z 標記要強調的位置。',
            '## Plan and map\n1. Switch to **Space**.\n2. Upload or describe the layout.\n3. Create or confirm the **space map** (top-down).\n4. Drop A–Z markers on spots you care about.',
            '## 平視攝影\n標記完成後，選要拍的區域或視角，再出**平視**圖。右側相機會保留，用來理解鏡頭方向。點數（含 2K／4K）以頁面為準。',
            '## Eye-level\nAfter markers, pick zones or a viewpoint and generate an **eye-level** still. The camera shell stays visible so you can read direction. 2K / 4K credits follow the page.',
            '## 注意\n請依頁面上的步驟走完「地圖 → 標記 → 平視」，不要跳過標記就期待對到特定角落。',
            '## Notes\nFollow map → markers → eye-level. Skipping markers makes it harder to hit a specific corner.'
        )],
    ['promo-camera', 'portrait',
        '商攝導演：人像攝影模式。',
        'Promo camera: portrait mode.',
        blocks(
            '## 這是做什麼\n人像模式模擬人物在場景中的商業人像／穿戴照，適合服裝、配件上身、形象圖。',
            '## What this is for\nPortrait mode simulates a person in a commercial scene — apparel, accessories on-body, or lifestyle portraits.',
            '## 怎麼操作\n1. `/promo-camera` 切到**人像**。\n2. 上傳人物參考（體型／臉部依頁面欄位）。\n3. 補場景、服裝或產品說明。\n4. 看點數後生成。',
            '## How to use it\n1. `/promo-camera` → **Portrait**.\n2. Upload a person reference (body / face fields as shown).\n3. Add scene, outfit, or product notes.\n4. Check credits and generate.',
            '## 注意\n請使用你有權使用的人像。解析度與點數以頁面為準。',
            '## Notes\nOnly use likenesses you have the right to use. Resolution and credits follow the page.'
        )],
    ['promo-camera', 'pwa-app',
        '線上 PWA 與官網同一帳號、同一點數。',
        'PWA uses the same MatchDO account and credits.',
        blocks(
            '## 這是做什麼\n`/promo-camera-app` 是商攝的**手機網頁 App**：同一套登入與點數，介面依手機操作調整，不是整站搬進手機。',
            '## What this is for\n`/promo-camera-app` is the **mobile web app** for promo camera. Same login and credits; the shell is phone-first, not the whole site.',
            '## 與官網的關係\n- 帳號、點數、生成紀錄與官網 `/promo-camera` 共用。\n- 三種模式（產品／空間／人像）都在。\n- 設計稿在手機嵌入商攝時，也可能走這個 App 殼。',
            '## Relation to the website\n- Account, credits, and history are shared with `/promo-camera`.\n- Product, space, and portrait are all available.\n- The design draft on a phone may embed this app shell.',
            '## 如何加到手機主畫面\n用手機瀏覽器打開 `/promo-camera-app`。\n- **iPhone**：用 Safari → 分享 → 加入主畫面。其他瀏覽器請改用 Safari。\n- **Android**：若出現安裝提示就加入；或用瀏覽器選單「加到主畫面」。',
            '## Add to the home screen\nOpen `/promo-camera-app` on your phone.\n- **iPhone**: Safari → Share → Add to Home Screen. Use Safari, not another browser.\n- **Android**: accept the install prompt, or use the browser menu **Add to Home screen**.',
            '## 注意\n這是瀏覽器 App，不是另一個帳號。請用同一個 MatchDO 登入。',
            '## Notes\nThis is a browser app, not a second account. Sign in with the same MatchDO login.'
        )],

    ['pattern-extract', 'overview',
        '圖樣提取：從數位資產選圖提取圖樣（避免侵權，不從任意上傳圖）。',
        'Extract a pattern from a digital asset (not arbitrary uploads).',
        blocks(
            '## 這是做什麼\n從**你已經存在數位資產裡的圖**抽出可重複的圖樣（花紋、印花單元），再拿去印花或當參考。不能從任意網圖直接抽，以降低侵權風險。',
            '## What this is for\nPull a repeatable pattern from an image **already in My assets**. Arbitrary web uploads are not the source, to reduce infringement risk.',
            '## 怎麼操作\n1. 打開 `/pattern-extract/`。\n2. 從數位資產選一張圖（沒有資產請先在設計稿或印花產出並儲存）。\n3. 依頁面設定範圍／解析度後提取。\n4. 結果可下載或回到資產／設計使用。',
            '## How to use it\n1. Open `/pattern-extract/`.\n2. Pick an image from My assets (generate and save first if the library is empty).\n3. Set crop / resolution on the page, then extract.\n4. Download or reuse in assets / design.',
            '## 注意\n點數與輸出尺寸以該頁為準。請只提取你有權使用的圖案。',
            '## Notes\nCredits and output size follow the page. Only extract patterns you have rights to.'
        )],
    ['design-to-physical', 'overview',
        '寫實化：把設計稿或圖稿轉成更接近實物拍攝的影像。',
        'Photorealize a design or artwork so it looks closer to a physical product photo.',
        blocks(
            '## 這是做什麼\n寫實化把**產品圖稿／示意圖**變成較接近實拍的成品照。適合草圖、平面設計已定、要給客戶看「實物感」時。',
            '## What this is for\nPhotorealize turns a **product sketch or flat** into a more photographic still — useful when the design is set and you need a physical look.',
            '## 怎麼操作\n1. 打開 `/design-to-physical/`，或在設計區切「寫實化」。\n2. 選本機圖或數位資產裡的圖。\n3. 可加簡短說明後執行。\n4. 廠商素材庫的原型／配件也可在編輯圖庫做寫實化（點數可能不同，以頁面為準）。',
            '## How to use it\n1. Open `/design-to-physical/` or the Photorealize tab in the design area.\n2. Pick a local file or an asset.\n3. Add a short note if needed, then run.\n4. Vendor prototypes / parts can also photorealize from the gallery (credit cost may differ).',
            '## 注意\n**本機原稿再跑一次，通常比對已上架、已壓縮的圖再跑效果好。** 不要對寫實化結果反覆再寫實化。點數以頁面為準（設計區與廠商圖庫可能不同）。',
            '## Notes\n**Re-uploading the original file usually beats running again on a compressed stored image.** Do not stack photorealize on its own output. Credits follow the page.'
        )],
    ['scene-sim', 'overview',
        '實境模擬：把設計放到真實場景或人物環境。',
        'Place a design into a real scene or on a person.',
        blocks(
            '## 這是做什麼\n實境模擬把**產品圖**套進你提供的環境或人物照片，看實際配色與比例。和情境圖不同：這裡通常由你指定真實參考場景。',
            '## What this is for\nPlace a **product image** into a scene or on a person you provide. Unlike scene images, you usually supply the real reference photo.',
            '## 怎麼操作\n1. 打開 `/scene-sim/`。\n2. 選產品圖（常從數位資產）。\n3. 上傳環境或人物參考。\n4. 生成；點數以頁面為準。\n5. 若未下載／未另存，有些結果不會進數位資產（以該頁說明為準）。',
            '## How to use it\n1. Open `/scene-sim/`.\n2. Pick a product image (often from My assets).\n3. Upload a scene or person reference.\n4. Generate; credits follow the page.\n5. Some results are not stored unless you download or save — follow the page copy.',
            '## 與情境圖的差別\n情境圖偏平台場景模板；實境模擬偏「我這張現場／這個人」。行銷場景合成見 [/help/promo-image/](/help/promo-image/)。',
            '## vs scene images\nScene images lean on platform scene templates; scene simulation uses **your** photo. See [/help/promo-image/](/help/promo-image/).'
        )],
    ['my-assets', 'overview',
        '我的數位資產：設計稿與生成結果的收藏處。',
        'My digital assets: saved drafts and generations.',
        blocks(
            '## 這是做什麼\n這裡集中你存過的設計圖、材料組合、印花、情境圖等，方便再開、當參考、做商攝或找廠商。',
            '## What this is for\nA library of saved designs, material combos, prints, and scene images — reopen, reuse as references, shoot, or find a maker.',
            '## 怎麼操作\n1. 打開 `/client/my-custom-products.html`。\n2. 用分頁切設計圖／材料組合／情境圖等。\n3. 點卡片可再設計、看履歷、或帶去其他工具。\n4. 設計風向結果也可切「設計風向」檢視。',
            '## How to use it\n1. Open `/client/my-custom-products.html`.\n2. Switch tabs (designs, material combos, scene images, …).\n3. Open a card to redesign, view history, or send to another tool.\n4. Design-direction results have their own view.',
            '## 注意\n不上媒體牆的作品仍會列在這裡。刪除前請確認沒有還要再用的衍生圖。',
            '## Notes\nItems hidden from the media wall still appear here. Check derived images before you delete.'
        )],
    ['gallery', 'overview',
        '圖庫找廠商：從作品／圖庫找到製作方。',
        'Find makers from the gallery.',
        blocks(
            '## 這是做什麼\n從公開作品、對照圖、系列圖瀏覽，點進廠商公開頁或繼續設計。適合「先看成品再決定找誰做」。',
            '## What this is for\nBrowse public work (designs, comparisons, series), then open a vendor page or keep designing. Start from finished work, then pick a maker.',
            '## 怎麼操作\n1. 打開 `/custom/gallery.html` 或首頁靈感牆。\n2. 用分類或類型篩選。\n3. 點作品看大圖；有廠商則進公開首頁。\n4. 可再從廠商頁「用此廠商版型設計」回設計稿。',
            '## How to use it\n1. Open `/custom/gallery.html` or the homepage wall.\n2. Filter by category or type.\n3. Open a piece; follow the vendor homepage when shown.\n4. From the vendor page you can design with their styles.',
            '## 注意\n靈感牆是公開內容；你自己不上牆的作品不會出現在這裡。',
            '## Notes\nThe wall is public. Pieces you hid from the wall do not appear here.'
        )],

    ['design-direction', 'overview',
        '設計風向（測試中）：意圖分析、我的設計風向、找製作方。',
        'Design direction (beta): intent, my directions, find makers.',
        blocks(
            '## 這是做什麼\n設計風向把「我想做什麼」整理成可保存的方向，再拿去找製作方。此區標示**測試中**，介面可能再調整。',
            '## What this is for\nTurn “what I want to make” into a saved direction, then find makers. This area is **beta** and may still change.',
            '## 入口\n頂部「設計風向」：\n- 設計意圖分析 → [/help/design-direction/intent](/help/design-direction/intent)\n- 我的設計風向 → [/help/design-direction/my-direction](/help/design-direction/my-direction)\n- 找製作方 → [/help/design-direction/find-makers](/help/design-direction/find-makers)',
            '## Where to start\nTop nav **Design direction**:\n- Intent → [/help/design-direction/intent](/help/design-direction/intent)\n- My directions → [/help/design-direction/my-direction](/help/design-direction/my-direction)\n- Find makers → [/help/design-direction/find-makers](/help/design-direction/find-makers)',
            '## 注意\n測試中功能以頁面實際按鈕為準。一般設計生圖仍走設計稿。',
            '## Notes\nTrust the buttons on the page while this is in beta. Everyday generation still uses the design draft.'
        )],
    ['design-direction', 'intent',
        '描述或上傳後分析設計意圖。',
        'Analyze design intent.',
        blocks(
            '## 這是做什麼\n用文字或圖，讓系統整理這次設計的品類、風格與重點，方便之後對照或找製作方。',
            '## What this is for\nDescribe or upload a reference so the system summarizes category, style, and focus — for later review or finding a maker.',
            '## 怎麼操作\n1. 打開設計意圖分析頁（設計風向選單）。\n2. 填描述或上傳參考。\n3. 送出後閱讀分析結果。\n4. 可存成「我的設計風向」。',
            '## How to use it\n1. Open Intent analysis from the Design direction menu.\n2. Enter a description or upload a reference.\n3. Read the analysis.\n4. Save it under My directions.',
            '## 注意\n結果是分析摘要，不會自動變成一張設計稿。要生圖請到設計稿。',
            '## Notes\nThis is a summary, not a generated product image. Use the design draft to generate.'
        )],
    ['design-direction', 'my-direction',
        '已存的設計風向結果。',
        'Saved design-direction results.',
        blocks(
            '## 這是做什麼\n查看你存過的設計風向，避免每次重填意圖。',
            '## What this is for\nReopen saved directions so you do not rewrite intent every time.',
            '## 怎麼操作\n從設計風向選單進「我的設計風向」，或在我的數位資產切到設計風向檢視。點一筆可再看內容或接著找製作方。',
            '## How to use it\nOpen **My directions**, or switch the Design direction view in My assets. Open an item to review or find makers.',
            '## 注意\n與一般設計圖分頁不同，這裡存的是「方向」不是每一張生圖。',
            '## Notes\nThis stores directions, not every generated still.'
        )],
    ['design-direction', 'find-makers',
        '依設計風向找製作方。',
        'Find makers from a design direction.',
        blocks(
            '## 這是做什麼\n帶著已整理的設計方向，瀏覽可能接單的製作方。',
            '## What this is for\nBrowse makers who may fit a saved design direction.',
            '## 怎麼操作\n1. 打開 `/client/find-makers.html`。\n2. 選一筆設計風向或依頁面篩選。\n3. 點進廠商公開頁或留下詢價（依該頁按鈕）。',
            '## How to use it\n1. Open `/client/find-makers.html`.\n2. Pick a direction or use the filters.\n3. Open a vendor page or send an inquiry if the page offers it.',
            '## 注意\n沒有風向也可以先逛圖庫找廠商：[/help/gallery/](/help/gallery/)',
            '## Notes\nYou can also browse the gallery without a saved direction: [/help/gallery/](/help/gallery/)'
        )],

    // —— 廠商 ——
    ['vendor-start', 'overview',
        '建立廠商資料、進入控制台。同一帳號即可，不必另開角色。',
        'Create a manufacturer profile and open the dashboard.',
        blocks(
            '## 這是做什麼\n把同一帳號補上**製造商資料**後，就能上傳展示案例、素材，並有公開首頁給設計者看。不是換成另一種帳號。',
            '## What this is for\nAdd a **manufacturer profile** to the same login so you can upload portfolio and materials and have a public homepage. You do not create a second account type.',
            '## 怎麼操作\n1. 「我的功能 → ②」進廠商控制台 `/client/manufacturer-dashboard.html`。\n2. 依提示建立或補齊廠商名稱、介紹、聯絡與 LOGO。\n3. 控制台可進：展示案例、素材管理、詢價、公開首頁預覽。',
            '## How to use it\n1. **My features → ②** → `/client/manufacturer-dashboard.html`.\n2. Create or complete name, intro, contact, and logo.\n3. From the dashboard: portfolio, materials, inquiries, public page preview.',
            '## 免費帳號能做什麼\n展示案例可以上傳。**產品／素材**（版型、材料、零件、供應商目錄）上傳需要付費方案。\n\n見 [/help/membership/free-limits](/help/membership/free-limits)',
            '## On the free plan\nPortfolio cases are allowed. **Products and assets** (styles, materials, parts, supplier catalog) need a paid plan.\n\nSee [/help/membership/free-limits](/help/membership/free-limits)'
        )],
    ['vendor-portfolio', 'overview',
        '展示案例：系列圖與對照圖。同一頁兩種作品形態。',
        'Portfolio: series images and before/after comparisons.',
        blocks(
            '## 這是做什麼\n展示案例是給設計者看的**實績**，也是解鎖「匯入產業供應商目錄」的條件（至少 1 件展示中）。免費帳號也可以傳。',
            '## What this is for\nPortfolio cases are public **proof of work**, and you need at least one **public** case to import a supplier catalog. Free accounts may upload cases.',
            '## 系列圖\n同一作品多張圖（不同角度或細節）。在 `/client/manufacturer-portfolio.html` 新增作品，選系列圖並填名稱、分類、亮點。',
            '## Series\nSeveral photos of one piece. On `/client/manufacturer-portfolio.html`, add a work as a series and fill title, category, and highlight.',
            '## 對照圖\n改前／改後或設計／成品對照。同一頁選擇對照形態上傳兩側圖片。',
            '## Comparison\nBefore/after or design vs finished. Same page, comparison type, both sides.',
            '## 注意\n請把要給外人看的案例設為**展示中／公開**。未展示的不算「至少 1 件」門檻。',
            '## Notes\nSet cases you want found to **public / on display**. Hidden cases do not count toward the import requirement.'
        )],
    ['vendor-materials', 'overview',
        '素材管理：產品版型、材料版型、零件版型。同一頁不同類型。',
        'Materials: product, material, and part styles in one page.',
        blocks(
            '## 這是做什麼\n上傳設計者在設計稿「廠商素材庫」會看到的**數位原型、材料、配件**。選對主分類，對方選同一分類才看得到。',
            '## What this is for\nUpload **prototypes, materials, and parts** designers see in the vendor library. The main category must match what they pick in the draft.',
            '## 產品版型（數位原型）\n結構／造型主體。建議選子分類、補標題與圖（封面＋圖庫）。可關聯材料與配件，讓設計者「看可搭配」。',
            '## Product styles (prototypes)\nThe main form. Add subcategory, title, and images. Link materials and parts so designers can **See matches**.',
            '## 材料與零件版型\n材料：表面、色、質感參考。零件：五金、提把等可搭配件。同一頁切類型上傳。',
            '## Materials and parts\nMaterials: surface, color, texture. Parts: hardware, handles, add-ons. Switch type on the same page.',
            '## 怎麼操作\n1. `/client/manufacturer-materials.html`\n2. 選類型 → **主分類必選** → 標題與圖片。\n3. 公開後，設計者在設計稿選相同主分類即可在庫裡看到。',
            '## How to use it\n1. `/client/manufacturer-materials.html`\n2. Pick type → **main category required** → title and images.\n3. Once public, designers who pick the same category see you in the library.',
            '## 注意\n免費方案不能上傳素材。見 [/help/membership/free-limits](/help/membership/free-limits)。這頁不是供應商目錄上架（那是 ③）。',
            '## Notes\nFree plans cannot upload assets. See [/help/membership/free-limits](/help/membership/free-limits). This is not the supplier catalog (that is ③).'
        )],
    ['vendor-embed', 'overview',
        '把模擬／選版型嵌到外站。',
        'Embed the simulator on another site.',
        blocks(
            '## 這是做什麼\n用 iframe 把 MatchDO 的選版型／模擬放進你自己的官網，訪客不必先學會整站。這不是設計稿的一個分頁。',
            '## What this is for\nEmbed style picking / simulation on your own site via iframe. Visitors do not need the full MatchDO UI. This is not a tab on the design page.',
            '## 怎麼操作\n1. 在廠商相關設定或 Embed 說明頁取得嵌入碼（含 embed id）。\n2. 把 iframe 貼到外站。\n3. 可用主題／外框參數（若頁面有提供）。\n4. 訪客操作紀錄可在站內 Embed 設計紀錄查看（若已開）。',
            '## How to use it\n1. Copy the embed snippet (with embed id) from vendor embed settings.\n2. Paste the iframe on your site.\n3. Optional theme / chrome query params if documented on that page.\n4. Visitor runs may appear under embed design records when enabled.',
            '## 注意\n嵌入頁與官網設計稿網址不同，請複製後台提供的網址，不要自己改成 `custom-product.html?tab=`。',
            '## Notes\nThe embed URL is not the design-tool tab. Use the URL from admin / vendor settings; do not invent `custom-product.html?tab=`.'
        )],
    ['vendor-inquiries', 'overview',
        '查看設計者傳來的詢價。',
        'View incoming inquiries.',
        blocks(
            '## 這是做什麼\n設計者對你的作品或版型留下詢價後，在這裡集中看需求與聯絡。',
            '## What this is for\nWhen someone inquires about your work or styles, the threads land here.',
            '## 怎麼操作\n1. 廠商控制台 → 詢價，或「我的功能 → ②」詢價列表。\n2. 點一筆看需求說明與對方聯絡方式。\n3. 依頁面上的回覆或站外聯絡方式處理。',
            '## How to use it\n1. Dashboard → Inquiries, or **My features → ②**.\n2. Open a thread for the brief and contact.\n3. Reply in-page or off-site as the page allows.',
            '## 注意\n公開首頁與素材越完整，詢價越容易對到正確品類。',
            '## Notes\nA complete public page and categorized assets make inquiries easier to match.'
        )],
    ['vendor-profile', 'overview',
        '廠商公開首頁（可被搜尋），不是後台控制台。',
        'Public vendor homepage (indexable), not the private dashboard.',
        blocks(
            '## 這是做什麼\n`/vendor-profile.html?id=…` 是給設計者與搜尋引擎看的**公開店面**。控制台只有你登入後看得到。',
            '## What this is for\n`/vendor-profile.html?id=…` is the **public storefront**. The dashboard is private.',
            '## 公開頁與後台的差別\n- 公開頁：介紹、作品、可引用的版型入口。\n- 控制台：上傳、詢價、設定、未公開內容。',
            '## Public vs dashboard\n- Public: intro, work, styles visitors may use.\n- Dashboard: uploads, inquiries, settings, unpublished items.',
            '## 如何分享\n在控制台或「我的功能 → 我的廠商公開首頁」複製連結。可放在名片、IG 或詢價回覆。',
            '## How to share\nCopy the link from the dashboard or **My vendor homepage**. Use it on cards, social, or inquiry replies.',
            '## 注意\n公開頁可被收錄；後台 `/client/manufacturer-dashboard.html` 不會當公開店面。',
            '## Notes\nThe public page can be indexed. The dashboard URL is not your storefront.'
        )],
    ['vendor-sourcing', 'overview',
        '上游採購（B 線）：瀏覽產業供應商目錄並匯入到自己的素材庫。',
        'Browse supplier catalogs and import into your library.',
        blocks(
            '## 這是做什麼\n製造商向**產業供應商目錄**引用產品／材料，匯入後出現在你可管理的庫裡，再視需要轉成給設計者看的素材。這是 B 線，不是你自己拍的展示案例。',
            '## What this is for\nManufacturers **import** items from industry supplier catalogs into their own library (B-line). It is not your portfolio shoot.',
            '## 匯入條件\n同一帳號須已有至少 **1 件展示中作品**。選單上仍看得到入口；條件不足時頁面會說明。',
            '## Import requirement\nYou need at least **one public portfolio case**. The menu link stays visible; the page explains if you do not qualify.',
            '## 怎麼操作\n1. 我的功能 → ② → 上游採購／產業供應商目錄。\n2. 瀏覽供應商與品項。\n3. 匯入到已匯入上游品項。\n4. 再依你的流程整理或上架給設計者（若產品要求另一步）。',
            '## How to use it\n1. **My features → ②** → upstream / supplier catalog.\n2. Browse suppliers and items.\n3. Import into your imported list.\n4. Then tidy or list them for designers if your workflow needs that extra step.',
            '## 注意\n免費不能上傳自己的素材，但匯入還看展示案例門檻。種子／平台代管廠商另有規則。',
            '## Notes\nFree plans still cannot upload their own assets; import also needs a public case. Seed / platform-managed vendors follow extra rules.'
        )],

    ['supplier-catalog', 'overview',
        '產業供應商上架數位產品庫（產品／材料）。與廠商素材管理是不同頁。',
        'Industry suppliers list catalog items. Different from manufacturer materials.',
        blocks(
            '## 這是做什麼\n③ **產業供應商**把可被製造商匯入的產品／材料目錄上架。這不是 ② 素材管理（那是製造商給設計者的版型庫）。',
            '## What this is for\n③ **Industry suppliers** list products / materials manufacturers can import. This is not ② vendor materials (styles for designers).',
            '## 怎麼上架\n1. 我的功能 → ③ → 上架數位產品庫。\n2. 新增產品或材料，補名稱、圖、規格（依表單）。\n3. 儲存後，製造商可在上游採購看到（其須符合展示案例條件）。',
            '## How to list\n1. **My features → ③** → supplier catalog.\n2. Add a product or material (name, images, specs as on the form).\n3. Manufacturers can then import it if they meet the portfolio rule.',
            '## 注意\n免費帳號不能上傳目錄品項。見 [/help/membership/free-limits](/help/membership/free-limits)',
            '## Notes\nFree accounts cannot upload catalog items. See [/help/membership/free-limits](/help/membership/free-limits)'
        )],
    ['supplier-profile', 'overview',
        '供應商公開頁，以及製造商引用紀錄。',
        'Public supplier page and manufacturer import history.',
        blocks(
            '## 這是做什麼\n供應商也有公開頁，讓製造商認識你的目錄；「製造商引用紀錄」看誰匯入過你的品項。',
            '## What this is for\nA public supplier page for manufacturers, plus a log of who imported your items.',
            '## 公開頁\n從我的功能 → ③ → 供應商公開首頁進入或複製連結。內容來自你上架的目錄與基本資料。',
            '## Public page\n**My features → ③ → My supplier homepage**. Content comes from your catalog and profile.',
            '## 製造商引用紀錄\n同一區查看哪些製造商匯入了哪些品項，方便後續業務聯絡。',
            '## Import history\nSee which manufacturers imported which items so you can follow up.',
            '## 注意\n公開頁與後台上架頁不同；不要把後台網址當成對外名片。',
            '## Notes\nThe public URL is not the admin catalog form. Do not share the back-office link as your card.'
        )],

    ['membership', 'overview',
        '訂閱方案的每月點數，與單次儲值不同。',
        'Monthly subscription credits vs one-time top-up.',
        blocks(
            '## 這是做什麼\n付費訂閱每月給一包點數，用來生圖、商攝、寫實化等。單次儲值是另外買點，不取代訂閱的方案權益（例如上傳素材）。',
            '## What this is for\nA paid plan grants credits each period for generate, promo camera, photorealize, and more. One-time top-up buys extra credits; it does not replace plan perks such as asset upload.',
            '## 怎麼看方案\n1. `/subscription-plans.html` 看各方案。\n2. `/credits.html` 看餘額、到期與儲值。\n3. 各工具按鈕旁的數字是**該次**預扣，以當頁為準。',
            '## How to check\n1. `/subscription-plans.html` for plans.\n2. `/credits.html` for balance, expiry, and top-up.\n3. The number next to each Generate button is **that action** — trust the page.',
            '## 相關\n- 儲值：[/help/membership/top-up](/help/membership/top-up)\n- 免費限制：[/help/membership/free-limits](/help/membership/free-limits)\n- 點數 FAQ：[/help/faq](/help/faq)',
            '## Related\n- Top-up: [/help/membership/top-up](/help/membership/top-up)\n- Free limits: [/help/membership/free-limits](/help/membership/free-limits)\n- Credits FAQ: [/help/faq](/help/faq)'
        )],
    ['membership', 'top-up',
        '單次儲值點數，與訂閱每月贈點分開看。',
        'One-time credit packs, separate from monthly plan grants.',
        blocks(
            '## 這是做什麼\n點數不夠、或不想改方案時，在「我的點數」一次買入點數。這與訂閱每月發放是分開的兩本帳。',
            '## What this is for\nBuy a credit pack on **My credits** when you need more without changing plan. Separate from the monthly grant.',
            '## 怎麼操作\n1. 打開 `/credits.html`。\n2. 選儲值點數（快捷金額以頁面為準）。\n3. 依結帳方式完成付款。\n4. 成功後餘額更新，即可回工具繼續生成。',
            '## How to use it\n1. Open `/credits.html`.\n2. Pick a pack (amounts on the page).\n3. Complete checkout.\n4. When the balance updates, return to the tool.',
            '## 和訂閱的差別\n訂閱：每月給點，並可能包含上傳產品／素材等權益。儲值：只加點，**不會**把免費帳號變成可上傳素材。',
            '## vs subscription\nA plan grants credits and may allow asset upload. Top-up only adds credits — it does **not** lift free-plan upload limits.'
        )],
    ['membership', 'hide-from-wall',
        '生成或公開時選擇不要出現在首頁靈感牆。',
        'Keep a work off the public media wall.',
        blocks(
            '## 這是做什麼\n不想讓這張設計出現在首頁靈感牆或公開圖庫時，在儲存／公開選項勾「不上媒體牆」。',
            '## What this is for\nKeep a piece off the homepage wall and public gallery when you save or publish.',
            '## 怎麼操作\n在設計稿儲存（或該工具同等的公開選項）取消展示／勾不上牆。之後仍可在我的數位資產找到。',
            '## How to use it\nWhen saving a design (or the equivalent publish control), turn off wall / public display. The file stays in My assets.',
            '## 不上牆還會在哪裡\n我的數位資產、你自己的登入狀態。其他人在靈感牆看不到。',
            '## Where it still appears\nMy assets, while you are signed in. Others will not see it on the wall.'
        )],
    ['membership', 'free-limits',
        '免費不可上傳產品與素材；展示案例仍可上傳。',
        'Free plans cannot upload products or assets; portfolio cases are allowed.',
        blocks(
            '## 不能上傳什麼\n- 製造商**素材**（數位原型／材料／配件，`vendor_assets`）\n- 供應商**目錄品項**（`supplier_catalog_items`）\n頁面上傳鈕會停用，API 會說明原因。',
            '## What you cannot upload\n- Manufacturer **assets** (prototypes / materials / parts)\n- Supplier **catalog items**\nButtons disable and the API explains why.',
            '## 仍可以做什麼\n- 上傳**展示案例**（也是之後匯入供應商目錄的條件）\n- 用點數做設計稿、商攝、情境圖等（有點就能做）\n- 瀏覽說明、版型列表、圖庫',
            '## What you can still do\n- Upload **portfolio cases** (also required later to import catalogs)\n- Generate with credits (drafts, promo camera, scene images)\n- Read guides and browse lists',
            '## 管理員／測試員\n不受這兩項限制。一般會員請改訂閱方案後再上傳產品與素材。',
            '## Admins and testers\nExempt. Everyone else needs a paid plan to upload products and assets.'
        )],

    ['faq', 'overview',
        '點數、素材庫沒圖、如何讓設計者看到素材。',
        'Credits, empty vendor library, and how designers see your assets.',
        blocks(
            '## 點數怎麼算？\n每個生成按鈕旁會寫本次要扣多少。設計稿「無參考／有參考」、商攝解析度、寫實化入口（設計區或廠商圖庫）可能不同。**請以該頁數字為準**，不要背舊表。餘額在 `/credits.html`，方案在 `/subscription-plans.html`。',
            '## How are credits counted?\nEach Generate control shows its cost. Draft with/without references, promo-camera resolution, and photorealize entry points can differ. **Trust the page.** Balance: `/credits.html`. Plans: `/subscription-plans.html`.',
            '## 從廠商素材庫選擇時沒有圖？\n1. 設計稿是否已選**主分類**。\n2. 該分類是否有廠商公開上傳。\n3. 廠商上傳時的主分類是否與你現在選的相同（分類搬家後，舊資料可能還掛在舊分類）。\n沒有素材時會提示尚無圖，可改分類或改用本機圖／官方版型。',
            '## Empty vendor library?\n1. Did you pick a **main category**?\n2. Has anyone published in that category?\n3. Does it match the category the vendor used (moved catalogs may still sit on the old key)?\nIf empty, change category or use a local file / official template.',
            '## 廠商如何讓設計者看到我的素材？\n在素材管理上傳，**主分類必選**，並設為公開。設計者在設計稿選相同主分類，打開「從廠商素材庫選擇」即可看到。免費帳號需先訂閱才能上傳素材。',
            '## How do designers see my assets?\nUpload in vendor materials with a **required main category**, and make them public. Designers pick the same category, then **Choose from vendor library**. Free accounts must subscribe before uploading assets.',
            '## 還有問題\n聯絡我們：`/contact.html`。操作介紹目錄：[/help/](/help/)',
            '## Still stuck?\nContact: `/contact.html`. Guide index: [/help/](/help/)'
        )]
];

function sqlQuote(s) {
    return '$hg$' + String(s == null ? '' : s) + '$hg$';
}

const lines = [];
lines.push('-- 操作介紹草稿內文：每篇拆成「用途／操作／注意」等文字區塊');
lines.push('-- 英文欄位（title_en／summary_en／text_en）刻意留空，中文修正後再翻譯');
lines.push('-- 只更新尚未發佈的文章（不覆蓋你已公開或已改寫後發佈的內容）');
lines.push('-- 可重複執行。資料夾／篇 slug 須已存在（見 add-help-guides-draft-tree.sql）');
lines.push('-- 前台在發佈前仍不會出現；請到 /admin/operation-guides.html 檢視區塊後再公開');
lines.push('');
lines.push("UPDATE public.help_guide_folders SET title_en = '', updated_at = now() WHERE is_published = false;");
lines.push('');
lines.push('UPDATE public.help_guide_pages p');
lines.push('SET');
lines.push("    title_en = '',");
lines.push('    summary = v.summary,');
lines.push("    summary_en = '',");
lines.push('    blocks_json = v.blocks,');
lines.push('    updated_at = now()');
lines.push('FROM (');
lines.push('    VALUES');

pages.forEach(function (row, i) {
    var folder = row[0];
    var slug = row[1];
    var summary = row[2];
    var bl = row[4];
    var comma = i === pages.length - 1 ? '' : ',';
    lines.push(
        '    (' +
        sqlQuote(folder) + ', ' +
        sqlQuote(slug) + ', ' +
        sqlQuote(summary) + ', ' +
        sqlQuote(JSON.stringify(bl)) + '::jsonb)' + comma
    );
});

lines.push(') AS v(folder_slug, slug, summary, blocks)');
lines.push('JOIN public.help_guide_folders f ON f.slug = v.folder_slug');
lines.push('WHERE p.folder_id = f.id');
lines.push('  AND p.slug = v.slug');
lines.push('  AND p.is_published = false;');
lines.push('');
lines.push("INSERT INTO public.payment_config (key, value, updated_at)");
lines.push("VALUES ('help_guides_draft_content_20260903', '1', now())");
lines.push('ON CONFLICT (key) DO NOTHING;');
lines.push('');

const outPath = path.join(__dirname, '..', 'docs', 'add-help-guides-draft-content.sql');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Wrote', outPath, 'pages=', pages.length);
