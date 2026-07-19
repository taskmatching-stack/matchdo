# 產品推廣圖生成功能規劃

> **規劃日期**：2026-07-19  
> **需求**：讓設計者與廠商都能基於產品圖生成推廣圖，支援自訂尺寸、封裝提示詞、攝影參數  
> **生圖模型**：與全站一致，走 **BFL FLUX 2（預設 `flux-2-pro`）**；管理區可獨立設定推廣圖用模型槽。  
> **硬性約束（必守）**：**不得影響任何現有功能**——僅「新增」TAB／API／模型槽／點數鍵；禁止改寫既有生圖、寫實化、材料、重繪、計價、選單邏輯。

---

## 0. 模型與管理區（必守・已定案）

### 0.0 隔離原則（嚴格・優先於一切實作細節）

| 規則 | 說明 |
|------|------|
| **只加不改** | 新 TAB、新 panel、新 API、新 `payment_config` key、新 DB 表。既有按鈕／流程／文案／計價**預設不動**。 |
| **獨立模型槽** | 只用 `bfl_flux_model_promo_image`；**禁止**改 `bfl_flux_model_generate`／寫實化／產品重繪／實境等既有槽的預設或行為。 |
| **獨立點數鍵** | 只用 `points_promo_image_base`／`points_promo_image_per_extra_mp`；**禁止**改寫實化 20／廠商寫實化 10／圖樣提取等現有點數。 |
| **獨立提示組裝** | 推廣圖 prompt 組裝函式獨立；**禁止**動 `composeGeneratePromptWithReferences`、材料 optimize、寫實化 prompt 管線。 |
| **TAB 只追加** | 廠商：材料/顏色**右方追加**；設計頁：寫實化**右方追加**。不重排、不改名、不改既有 TAB 的 `data-kind`／`id`／panel 行為。 |
| **選圖可重用、不可改壞** | 設計頁可**呼叫**既有數位資產 picker；禁止改寫實化／實境模擬的選圖狀態機與副作用。 |
| **CSS 限定範圍** | 新樣式只掛在 `#tab-promo`／`#panel-promo-image`（或同等 id）下；禁止改全域 `.nav-tabs`／`.pending-*` 等共用樣式。 |
| **回歸底線** | 上線前手動確認：產品設計生圖、寫實化、圖樣提取、實境模擬、廠商三 kind 上傳／編輯／重繪／放大／寫實化，行為與改前一致。 |

**違反上述任何一條＝實作不合格，須還原後再做。**

### 0.1 用哪個模型

| 項目 | 定案 |
|------|------|
| 預設 model id | **`flux-2-pro`**（與現有 `BFL_FLUX_MODEL_CONFIG` 一致） |
| 呼叫方式 | 既有 `bflPlaygroundImageEdit`（FLUX 2 image editing，`input_image` + `width`/`height`） |
| 端點解析 | `getBflFluxEndpointForConfigKey('bfl_flux_model_promo_image')` |
| ❌ 不要用 | 舊版 FLUX 1.1 / Pro 1.1 / Ultra / Redux 等過時說法 |

### 0.2 管理區獨立模型槽

與寫實化同一套做法：在 **`public/admin/ai-settings.html`**「FLUX 生圖模型」區塊新增一欄，**不與**設計頁／產品重繪／寫實化共用。

| 項目 | 值 |
|------|-----|
| `payment_config` key | `bfl_flux_model_promo_image` |
| 程式預設 | `flux-2-pro` |
| UI 標籤 | 產品推廣圖 |
| 說明 | 設計者／廠商「產品圖 → 推廣圖」專用；可手填 `flux-2-pro`、`flux-2-max` 等 |

**實作清單（管理區）：**

1. `server.js` → `BFL_FLUX_MODEL_CONFIG` 加 `bfl_flux_model_promo_image: 'flux-2-pro'`
2. `GET`/`PATCH /api/admin/ai-config` 已依 `Object.keys(BFL_FLUX_MODEL_CONFIG)` 讀寫 → **加 key 即自動通**
3. `ai-settings.html`：新增 input `#bflFluxModelPromoImage`、載入／儲存／hint 文案一併帶上
4. 生圖 API 只准用此 key，**禁止**硬編 `flux-2-pro` 或誤用 `bfl_flux_model_generate`

---

## 1. 產品定位

### 1.1 雙入口＝兩個既有頁各加一個 TAB（不另開獨立頁、不塞卡片按鈕）

介面已過載，**禁止**在每張卡片再加「生成推廣圖」按鈕。改為頁面級 TAB，選圖後再生成。

| 入口 | 頁面 | TAB 位置 | 外觀 | 可帶入的來源圖 |
|------|------|----------|------|----------------|
| **廠商** | `public/client/manufacturer-materials.html` | `#asset-kind-tabs`：**材料/顏色右方**新增一 TAB | **用不同顏色**（與原型／配件／材料區隔，例：warning／紫系） | 需生推廣圖的**產品卡片內所有圖片**（`vendor_assets` 的封面 + `gallery_images`／`image_items`） |
| **設計者** | `public/custom-product.html` | `#designTabs`：**寫實化右方**新增一 TAB | **不改顏色**（與產品設計／寫實化等同款 nav-link） | **已設計好的圖**，或**數位資產庫**的圖（對齊寫實化「本機／從數位資產」選圖習慣） |

```
廠商素材庫 TAB 列（示意）
[數位原型] [配件／零件] [材料/顏色] [推廣圖 ← 異色]

產品設計頁 TAB 列（示意）
[產品設計] [廠商版型] [實境模擬] [圖樣提取] [寫實化] [推廣圖 ← 同色]
```

### 1.2 核心價值

- **不擠爆既有卡片 UI**：獨立 TAB 承載選圖＋情境＋尺寸＋攝影參數
- **快速出圖**：選產品／設計圖 → 套模板 → 生成推廣素材
- **尺寸彈性**：社群貼文（1:1）、限動（9:16）、橫幅（16:9）等；基礎約 1MP，往上加點
- **專業感**：封裝情境提示 + 可選攝影參數組

---

## 2. 資料庫設計

### 2.1 新表：`product_promo_generations`

```sql
CREATE TABLE IF NOT EXISTS public.product_promo_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 生成者資訊
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('custom_product', 'vendor_asset')),
    source_id UUID NOT NULL,  -- custom_products.id 或 vendor_assets.id
    source_image_url TEXT NOT NULL,
    
    -- 生成參數
    aspect_ratio TEXT NOT NULL,  -- '1:1', '4:3', '3:4', '16:9', '9:16' 等
    width INT NOT NULL,
    height INT NOT NULL,
    megapixels NUMERIC(4,2) NOT NULL,  -- 實際 MP
    
    -- 提示詞組成
    base_prompt TEXT NOT NULL,  -- 封裝基礎提示（情境類型）
    user_prompt TEXT,  -- 使用者額外輸入
    photography_set_id UUID REFERENCES public.photography_prompt_sets(id) ON DELETE SET NULL,
    final_prompt TEXT NOT NULL,  -- 最終送 FLUX 的完整 prompt
    
    -- 生成結果
    result_image_url TEXT,  -- 成功時的圖片 URL
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
    error_message TEXT,
    bfl_request_id TEXT,
    
    -- 扣點
    points_charged INT NOT NULL DEFAULT 0,
    
    -- 時間戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- 索引用
    CONSTRAINT fk_source CHECK (
        (source_type = 'custom_product') OR 
        (source_type = 'vendor_asset')
    )
);

CREATE INDEX idx_promo_gen_user_created ON public.product_promo_generations (user_id, created_at DESC);
CREATE INDEX idx_promo_gen_source ON public.product_promo_generations (source_type, source_id);
CREATE INDEX idx_promo_gen_status ON public.product_promo_generations (status, created_at);

COMMENT ON TABLE public.product_promo_generations IS '產品推廣圖生成紀錄（設計者/廠商）';
COMMENT ON COLUMN public.product_promo_generations.megapixels IS '實際像素÷1M，用於階梯計價';
COMMENT ON COLUMN public.product_promo_generations.base_prompt IS '封裝情境提示（如「生活場景」「展示桌面」）';
```

### 2.2 新表：`promo_scene_templates`（封裝情境模板）

```sql
CREATE TABLE IF NOT EXISTS public.promo_scene_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,  -- 中文顯示名
    description TEXT,
    
    -- 提示詞片段
    scene_prompt TEXT NOT NULL,  -- 情境基礎提示
    composition_hint TEXT,  -- 構圖建議
    
    -- 推薦尺寸
    recommended_ratios TEXT[] DEFAULT ARRAY['1:1', '4:3', '16:9'],
    
    -- 分類標籤（方便前端篩選）
    category TEXT,  -- 'lifestyle', 'studio', 'outdoor', 'ecommerce'
    
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promo_scene_sort ON public.promo_scene_templates (sort_order, key);

COMMENT ON TABLE public.promo_scene_templates IS '推廣圖情境模板（封裝基礎提示詞）';

-- 預設模板
INSERT INTO public.promo_scene_templates (key, name, description, scene_prompt, composition_hint, category, sort_order) VALUES
('lifestyle_home', '居家生活', '產品置於溫馨家居環境', 'product placed in a cozy modern home interior, natural window light, warm atmosphere', 'product as focal point, lifestyle context in background', 'lifestyle', 10),
('studio_clean', '專業棚拍', '純淨背景突顯產品細節', 'product on clean white surface, professional studio lighting, minimalist composition', 'centered product, clean background, sharp details', 'studio', 20),
('desktop_mockup', '展示桌面', '辦公桌或工作檯場景', 'product on wooden desk with laptop and coffee, modern workspace setting', 'product integrated naturally, workspace aesthetic', 'lifestyle', 30),
('outdoor_nature', '戶外自然', '自然光下的戶外情境', 'product in outdoor natural setting, soft daylight, organic environment', 'product harmonized with nature, natural lighting', 'outdoor', 40),
('ecommerce_white', '電商白底', '標準電商主圖風格', 'product on pure white background, even lighting, clear product view', 'product fills frame, no shadows, clean cutout style', 'ecommerce', 50)
ON CONFLICT (key) DO NOTHING;
```

### 2.3 點數配置（新增到 `payment_config`）

```sql
-- 推廣圖基礎點數（1MP）
INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('points_promo_image_base', '20', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- 每增加 1MP 追加點數
INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('points_promo_image_per_extra_mp', '10', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMENT ON TABLE public.payment_config IS '...（含推廣圖生成點數：points_promo_image_base, points_promo_image_per_extra_mp）';
```

---

## 3. 後端 API 設計

### 3.1 生成推廣圖（核心 API）

```
POST /api/promo-image/generate
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "source_type": "custom_product" | "vendor_asset",
  "source_id": "uuid",
  "source_image_url": "https://...",  // 前端已知，減少查詢
  
  "aspect_ratio": "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "custom",
  "width": 1024,   // aspect_ratio='custom' 時必填
  "height": 1024,  // aspect_ratio='custom' 時必填
  
  "scene_template_key": "lifestyle_home",  // 對應 promo_scene_templates.key
  "user_prompt": "產品放在沙發旁，溫暖晚間氛圍",  // 選填，使用者額外描述
  "photography_set_id": "uuid"  // 選填，攝影參數組
}

Response (202 Accepted):
{
  "id": "uuid",
  "status": "processing",
  "estimated_points": 25,
  "bfl_request_id": "..."
}
```

**邏輯**：

1. 驗證使用者權限（訂閱會員 or 有足夠點數）
2. 計算目標尺寸 MP，查詢 `points_promo_image_base` + 階梯計價
3. 組裝 final_prompt：
   ```
   {scene_prompt} + {composition_hint} + {user_prompt} + {photography_body_text}
   ```
4. 組裝 final_prompt：
   ```
   {scene_prompt} + {composition_hint} + {user_prompt} + {photography_body_text}
   ```
5. 以 `getBflFluxEndpointForConfigKey('bfl_flux_model_promo_image')` 取端點，呼叫既有 **`bflPlaygroundImageEdit`**（FLUX 2 image editing）
6. 寫入 `product_promo_generations`（status=processing）
7. 回傳 202 + generation_id


### 3.2 查詢生成狀態

```
GET /api/promo-image/generation/:id
Authorization: Bearer <token>

Response:
{
  "id": "uuid",
  "status": "success" | "processing" | "failed",
  "result_image_url": "https://...",
  "points_charged": 25,
  "created_at": "...",
  "completed_at": "..."
}
```

### 3.3 取得情境模板列表

```
GET /api/promo-image/scene-templates
Response:
{
  "templates": [
    {
      "key": "lifestyle_home",
      "name": "居家生活",
      "description": "...",
      "recommended_ratios": ["1:1", "4:3", "16:9"],
      "category": "lifestyle"
    },
    ...
  ]
}
```

### 3.4 取得推廣圖生成紀錄

```
GET /api/promo-image/generations?source_type=custom_product&source_id=uuid
Authorization: Bearer <token>

Response:
{
  "generations": [
    {
      "id": "uuid",
      "aspect_ratio": "1:1",
      "scene_template_name": "居家生活",
      "result_image_url": "...",
      "points_charged": 25,
      "created_at": "..."
    },
    ...
  ]
}
```

---

## 4. 前端 UI 設計

### 4.1 廠商入口 — 素材庫新 TAB（`manufacturer-materials.html`）

**位置**：`#asset-kind-tabs` 在「材料/顏色」**右側**新增：

```html
<li class="nav-item" role="presentation">
  <button class="nav-link text-warning" type="button" data-kind="promo" id="tab-promo" role="tab">
    <i class="bi bi-megaphone me-1"></i>推廣圖
  </button>
</li>
```

（實際色系可定 warning／獨立 CSS class，重點是**與其他 kind TAB 明顯不同色**。）

**面板行為**：

1. 列出可選產品卡片（原型／配件／材料；材料是否納入可再定——預設以**數位原型＋配件**為主，因推廣圖多半是成品）
2. 點一張卡片 → **帶入該卡所有圖片**（封面 + gallery）供多選／單選當來源
3. 選情境模板、尺寸、攝影參數、使用者提示詞 → 生成
4. **不要**在列表卡片上再塞推廣按鈕

### 4.2 設計者入口 — 產品設計頁新 TAB（`custom-product.html`）

**位置**：`#designTabs` 在「寫實化」**右側**新增（**同款 nav-link，不特別換色**）：

```html
<li class="nav-item" role="presentation">
  <button class="nav-link" id="tab-promo-image" data-bs-toggle="tab"
    data-bs-target="#panel-promo-image" type="button" role="tab">推廣圖</button>
</li>
```

**面板行為**（對齊寫實化選圖 UX）：

1. 選來源圖：
   - 本頁剛設計／生成的結果圖
   - 或「從數位資產」選圖（可重用寫實化／實境模擬的 asset picker）
2. 情境／尺寸／攝影參數／補充提示詞 → 生成
3. 結果可下載；是否寫回資產庫另定（MVP 先下載即可）

### 4.3 尺寸與點數計算邏輯（前端）

```javascript
// 預設比例對應解析度（基礎 1MP）
const RATIO_PRESETS = {
  '1:1': { w: 1024, h: 1024 },
  '4:3': { w: 1152, h: 864 },
  '3:4': { w: 864, h: 1152 },
  '16:9': { w: 1344, h: 756 },
  '9:16': { w: 756, h: 1344 }
};

function calculatePoints(width, height, basePoints = 20, extraMpPoints = 10) {
  const mp = (width * height) / (1024 * 1024);
  const extraMp = Math.max(0, Math.ceil(mp) - 1);
  return basePoints + (extraMp * extraMpPoints);
}

// 1:1 1024×1024 → 20 點；2048×2048 (4MP) → 20 + 3×10 = 50 點
```

### 4.4 生成後顯示結果

同面板右側／下方顯示結果圖 + 下載 + 再生成（同參數）。

---

## 5. 提示詞組裝邏輯

### 5.1 最終 Prompt 結構

```
[scene_prompt] + [composition_hint] + [user_prompt] + [photography_body_text]
```

**範例**：

```
情境模板: lifestyle_home
  scene_prompt: "product placed in a cozy modern home interior, natural window light, warm atmosphere"
  composition_hint: "product as focal point, lifestyle context in background"

使用者輸入: "產品放在沙發旁，傍晚溫暖光線"

攝影參數組: 自然棚拍光
  body_text: "自然棚拍光，柔和方向光與真實高光／陰影，清晰對焦，寫實質感。"

Final Prompt:
"product placed in a cozy modern home interior, natural window light, warm atmosphere. product as focal point, lifestyle context in background. 產品放在沙發旁，傍晚溫暖光線。自然棚拍光，柔和方向光與真實高光／陰影，清晰對焦，寫實質感。"
```

### 5.2 封裝與開放的平衡

- **封裝**：情境模板（scene + composition）確保基本品質
- **開放**：使用者可補充細節描述（氛圍、時間、特殊元素）
- **專業感**：攝影參數確保光影質感

---

## 6. 階梯計價

| 解析度範圍 | MP | 點數計算 | 範例 |
|-----------|----|---------|----|
| ≤ 1MP | 1 | base (**20**) | 1024×1024 = **20**點 |
| 1～2MP | 2 | base + 1×extra (20+10) | ≈25點 |
| 2～3MP | 3 | base + 2×extra (20+20) | ≈40點 |
| 3～4MP | 4 | base + 3×extra (20+30) | 2048×2048 = **50**點 |

**說明**：
- `points_promo_image_base` = **20**（已定案）
- `points_promo_image_per_extra_mp` = 10
- 前端即時顯示預估點數

---

## 7. 實作階段建議

### Phase 1: 核心 MVP（約 2-3 天）

✅ **資料庫**
- [ ] 建立 `product_promo_generations` 表
- [ ] 建立 `promo_scene_templates` 表並插入 5 個預設模板
- [ ] payment_config 新增點數設定（`points_promo_image_base`、`points_promo_image_per_extra_mp`）

✅ **管理區模型槽**
- [ ] `BFL_FLUX_MODEL_CONFIG` 加 `bfl_flux_model_promo_image: 'flux-2-pro'`
- [ ] `ai-settings.html` 新增「產品推廣圖」手填欄（與寫實化同區）

✅ **後端 API**
- [ ] `POST /api/promo-image/generate` — 走 `bflPlaygroundImageEdit` + 上述獨立槽
- [ ] `GET /api/promo-image/generation/:id` - 查詢狀態
- [ ] `GET /api/promo-image/scene-templates` - 取得模板列表
- [ ] 點數扣除邏輯（可對齊圖樣提取 MP 階梯計價慣例）

✅ **前端（兩個 TAB，不塞卡片按鈕）**
- [ ] 廠商：`manufacturer-materials.html` 材料/顏色右方**異色** TAB「推廣圖」+ 面板（帶入產品卡全部圖）
- [ ] 設計：`custom-product.html` 寫實化右方**同色** TAB「推廣圖」+ 面板（設計圖／數位資產）
- [ ] 即時點數計算（基礎 **20**）
- [ ] 生成狀態 + 結果顯示

### Phase 2: 優化與擴展（選做）

- [ ] 推廣圖歷史紀錄頁（可重新下載）
- [ ] 批次生成（同一產品多種情境）
- [ ] 自訂情境模板（後台管理）
- [ ] A/B 測試不同情境效果

---

## 8. 技術細節

### 8.1 使用 BFL FLUX 2（與全站一致）

- **預設**：`flux-2-pro`（管理區可改為 `flux-2-max` 等 `flux-2-*`）
- **獨立槽**：`bfl_flux_model_promo_image`（見 §0）
- **API**：既有 `bflPlaygroundImageEdit(endpointUrl, prompt, [sourceImage], width, height, …)`
- **輸出尺寸**：前端選比例 → 對應 `width`/`height` 傳入（基礎約 1MP，往上加點）
- **對齊參考**：圖樣提取（`bfl_flux_model_scene_pattern` + MP 階梯計價）的計價與尺寸邏輯可複用精神，但模型槽必須獨立

### 8.2 圖片前處理

如果產品圖是去背的（PNG with alpha），建議：
1. 先檢測是否透明背景
2. 若是，合成白底或淡色底再送 FLUX 2
3. 避免 image edit 產生怪異背景融合

### 8.3 失敗重試

- BFL timeout/5xx → 不扣點，status = failed
- 可提供「重新生成」按鈕（同參數）

---

## 9. 預期效果

### 9.1 設計者

- 設計完產品後，一鍵生成社群/廣告素材
- 減少後製成本，快速測試不同情境

### 9.2 廠商

- 產品上架後，批次生成多款行銷圖
- 電商主圖、社群貼文、活動橫幅一次搞定

### 9.3 平台

- 新的點數消耗場景，增加訂閱價值
- 生成結果可作為案例展示（with 使用者同意）

---

## 10. 與現有功能整合

| 現有功能 | 整合點 | 說明 |
|---------|-------|------|
| **FLUX 2 模型槽** | `bfl_flux_model_promo_image` + `ai-settings.html` | 與寫實化同區、獨立可調，預設 `flux-2-pro` |
| **BFL 編輯 API** | `bflPlaygroundImageEdit` | 與產品重繪／寫實化同一套 FLUX 2 路徑 |
| **攝影參數組** | `photography_prompt_sets` | 直接重用，確保推廣圖光影質感 |
| **產品設計頁** | `custom-product.html` `#designTabs` | 寫實化右方同色「推廣圖」TAB |
| **廠商素材庫** | `manufacturer-materials.html` `#asset-kind-tabs` | 材料/顏色右方異色「推廣圖」TAB |
| **點數系統** | `payment_config` + `user_credits` | 基礎 **20** + 每多 1MP +10 |
| **embed simulator** | 概念類似但獨立 | 推廣圖是「產品→行銷素材」；embed 是「訪客試做」 |

---

## 11. 注意事項

### 11.1 版權與使用規範

- 生成的推廣圖**版權歸使用者**
- 平台可要求「允許展示為案例」選項
- 使用者不得生成侵權/不當內容（沿用現有審核機制）

### 11.2 成本控制

- 設定單日生成次數上限（如免費 5 次/日，訂閱 50 次/日）
- 超大尺寸（>4MP）需管理員帳號或特殊權限

### 11.3 品質監控

- 記錄 `bfl_request_id` 方便追查失敗原因
- 定期檢視低評分情境模板並優化

---

## 12. 後續擴展想法

1. **風格遷移**：除了情境，還能選「攝影風格」（復古/現代/極簡）
2. **季節/節慶模板**：聖誕、新年、夏日等主題場景
3. **智能推薦**：根據產品類別自動推薦適合的情境
4. **批次匯出**：一次生成 5 種情境，打包下載
5. **社群直發**：生成後直接發布到 FB/IG（需 OAuth）

---

## 總結

這個功能讓「產品圖」→「推廣素材」走**頁面級 TAB**，不塞爆既有卡片。建議 Phase 1 先做管理區模型槽 + API + 兩個 TAB 骨架與選圖，再補情境模板與計價。

需要我開始實作哪個部分？或是還有哪裡需要調整？
