# 空間風格 — 獨立工具頁規劃

> **更新**：2026-08-11  
> **狀態**：規劃定案，**待實作**（P0a 商攝空間 ISO 後端已就緒，本頁為**設計工作區**落地）  
> **前置**：`docs/PLAN-promo-camera-shoot-modes.md` §3.5 layout_plan、`lib/promo-space-gemini.js`  
> **必守**：**禁止**在 `custom-product.html` 新增 `?tab=space-style`（`.cursor/rules/seo-no-stuff-design-page.mdc`）

---

## 1. 產品定位（與設計稿、商攝導演分工）

| 表面 | URL | 角色 | 使用者心智 |
|------|-----|------|------------|
| **設計稿** | `/custom-product.html` | 產品 FLUX 生圖、分類、媒合 | 「做一個產品長什麼樣」 |
| **空間風格**（本頁） | `/client/space-style.html` | 平面 → ISO 空間地圖；可匯入風格／家具參考 | 「這個空間配置 + 風格長什麼樣」 |
| **商攝導演** | `/promo-camera` | 產品／空間／人像**攝影**（相機、點數、商攝 workflow） | 「用攝影語言拍成廣告圖」 |

**共用**：Gemini `layout_plan` 生圖引擎、點數 key、`product_promo_generations` 入庫語意。  
**不共用 UI**：空間風格頁**不要**相機控制台；商攝空間 Tab **不要**變成設計工作區。

深鏈建議：

- 空間風格結果 → 「用商攝導演切換視角」→ `/promo-camera?mode=space&layout_ref={generation_id}`（P1）
- 商攝空間 Tab 可加小字連結「需要編輯平面／風格？→ 空間風格」

---

## 2. URL、SEO、選單

### 2.1 URL（對齊材料組合／印花）

| 項目 | 值 |
|------|-----|
| **正式頁** | `/client/space-style.html` |
| **可選短網址**（P1） | `/space-style/` → 302/同檔（比照 `/promo-image/` 不必急） |
| **robots** | `index, follow` |
| **sitemap** | `routes/sitemap.js` → `sitemap-pages` 一筆 |
| **canonical** | `https://matchdo.cc/client/space-style.html` |

**禁止**：`custom-product.html?tab=space-style`、把空間列表塞進設計頁 tab。

### 2.2 選單（設計稿正下方）

修改 **`public/js/site-header.js`** `buildNavCpMenuInnerHtml` + **`lib/nav-cp-menu-html.js`**（須同步）：

```
[ 設計稿 ]          ← 現有 nav-cp-link--design
[ 空間風格 ]        ← 新增，icon bi-house-door 或 bi-map
── 以結構 ──
…
```

- i18n：`nav.spaceStyle` / `Space layout`（`public/locales/*.json`）
- ①②③ 全開，**不用** capabilities 隱藏（`account-one-login-capabilities.mdc`）
- 桌面 dropdown「客製產品」區塊：設計稿下一項插入同連結

---

## 3. UI 草圖（盡量對齊設計稿／材料組合）

**共用 CSS**：`design-workspace-tabs.css`、`morandi-global.css`、`digital-asset-picker.css`（同 `material-dual-color.html`）。

**版面**（左輸入 → 右結果，與設計稿「參考 + 描述 + 生成」同序）：

```
┌─────────────────────────────────────────────────────────────┐
│ 空間風格                                    [我的數位資產] │
├──────────────────────────┬──────────────────────────────────┤
│ ① 平面配置圖 *           │  結果預覽（ISO 2048²）          │
│   [上傳] [從資產選]       │  [下載] [儲存到資產庫]           │
│   縮圖 + 移除             │  生圖履歷 / 展示在媒體牆         │
│                          │                                  │
│ ② 風格（二選一）          │                                  │
│   ○ 文字  ○ 參考圖        │                                  │
│   [風格描述 textarea]     │                                  │
│   或 [上傳風格圖]         │                                  │
│                          │                                  │
│ ③ 家具／軟裝參考（選填）   │  ← P1 多張；P0 可隱藏或 0～3 張 │
│   [+ 匯入家具圖]          │                                  │
│                          │                                  │
│ 空間用途 [ 住家 ▼ ]       │                                  │
│ 補充描述（選填）          │                                  │
│                          │                                  │
│ [ 生成 ISO 空間地圖 ] 30點│                                  │
└──────────────────────────┴──────────────────────────────────┘
```

**與設計稿一致的操作**：

- 數位資產 Modal（`MatchdoDigitalAssetPicker`）
- `show-on-homepage-control.js` 媒體牆開關
- 生成中 spinner、402 點數不足、結果區 lightbox
- 頁尾 build tag 便於部署確認

**P0 刻意不做**：相機參數、theme/scene、FLUX 比例 MP 選單（固定 2048×2048）。

---

## 4. 前端檔案（新建，不動 promo-camera L3）

| 檔案 | 說明 |
|------|------|
| `public/client/space-style.html` | 頁殼 + meta + script 列表 |
| `public/js/space-style/state.js` | 平面／風格／家具／space_use_type |
| `public/js/space-style/api.js` | options、points-preview、generate |
| `public/js/space-style/index.js` | DOM、與材料組合同等級複雜度 |
| `public/css/space-style.css` | 僅空間頁特有 spacing（其餘靠共用） |

**不修改**（Store 隔離）：`promo-camera-app.html`、`app-shell.js`。  
**可選**：商攝原站 `/promo-camera` 空間 Tab 加連結 outward only。

---

## 5. API 設計

### 5.1 P0 — 複用商攝空間 layout（最小 diff）

**方案 A（建議 P0）**：`POST /api/space-style/generate` 內部呼叫既有 `resolvePromoSpaceLayoutReferences` + `generatePromoSpaceLayoutImageWithGemini`，payload 與商攝相同，僅多：

```json
{
  "client_channel": "space_style",
  "shoot_mode": "space",
  "space_output_type": "layout_plan",
  "floor_plan": "data:image/...",
  "space_style_source": "prompt|image",
  "style_image": "...",
  "user_prompt": "莫蘭迪配色",
  "space_use_type": "residential",
  "width": 2048,
  "height": 2048
}
```

`GET /api/space-style/options` → 代理 `space_use_types`、`points_space_layout`（或合併一支 `/api/space-style/bootstrap`）。

**方案 B（P1 家具）**：擴充 payload

```json
{
  "furniture_images": ["data:...", "..."],
  "furniture_mode": "reference_only"
}
```

Prompt 擴充（`lib/promo-space-gemini.js`）：  
「第 2～N 張為家具／軟裝參考，擺位須符合平面配置圖，款式依參考圖。」

**eye_level**：仍走商攝 `/api/promo-camera/generate` 或 P1 後 `POST /api/space-style/eye-level`；空間風格頁 P0 **不做**平視。

### 5.2 入庫與資產分類

沿用 `product_promo_generations`：

| 欄位 | 值 |
|------|-----|
| `generation_mode` | `camera_advanced` 或新值 `space_style`（建議 **`space_style`** 以便與商攝產品區分） |
| `generation_meta_json` | `shoot_mode: space`, `space_output_type: layout_plan`, `source_page: space_style`, `client_channel: space_style` |
| `asset_kind`（API 衍生） | `space_style_layout`（擴充 `resolvePromoGenerationAssetKind`） |

**我的數位資產**（P1 可拆 Tab，P0 先用標籤）：

- 情境圖 Tab 顯示 badge **空間風格** vs **商攝・空間 ISO**
- 或新增 Tab「空間風格」filter `asset_kind=space_style_layout`

列表 API：擴充 `GET /api/promo-image/generations?kind=space_style` 或新 `GET /api/space-style/generations`。

---

## 6. 分期

| 期 | 內容 | 驗收 |
|----|------|------|
| **P0** | 獨立頁 + 選單 + 平面 + 風格文/圖 → ISO + 入庫 + 30 點 | 與商攝空間同質輸出；UI 像設計稿 |
| **P0b** | 資產庫獨立 Tab 或篩選；sitemap + i18n | 我的數位資產可只看空間風格 |
| **P1** | 家具圖 1～N 張、Gemini 多圖 prompt | 平面 + 風格 + 沙發參考 → ISO |
| **P1b** | 從本頁結果一鍵進商攝 eye_level | 深鏈 + layout_generation_id |
| **P2** | 專案表 `space_style_projects`（可選）、歷史版本 | 同一平面多版風格對比 |

**P0 不做**：人像、商攝相機、multipart 上傳（仍 JSON base64 15mb）、官方 DB 家具庫。

---

## 7. 實作順序（P0）

1. `docs/PLAN-space-style-page.md`（本檔）+ 更新 `docs/PLAN-promo-camera-shoot-modes.md` 交叉連結  
2. `space-style.html` 靜態殼（共用 header/footer、picker modal）  
3. `state.js` / `api.js` / `index.js` — 對齊 P0a payload  
4. `server.js`：`POST/GET /api/space-style/*`（thin wrapper）  
5. `resolvePromoGenerationAssetKind` 加 `space_style` / `source_page`  
6. `site-header.js` + `lib/nav-cp-menu-html.js` + locales  
7. `routes/sitemap.js` 一筆  
8. 手動：本機 `/client/space-style.html` 端到端  

---

## 8. 與現網 P0a 的關係

| 已有（商攝 P0a） | 空間風格頁 P0 |
|------------------|---------------|
| `lib/promo-space-gemini.js` | 直接複用 prompt |
| `handlePromoCameraSpaceGenerate` 邏輯 | 抽 `runSpaceLayoutPlanGenerate()` 共用 |
| `/promo-camera` 空間 Tab | **保留**；給已習慣商攝入口的人 |
| 管理後台模型／點數 | 共用 key，無需第二套 |

使用者路徑：

- **要設計空間、像做設計稿** → **空間風格**（新頁）  
- **要攝影師 workflow、之後 eye_level** → **商攝導演**

---

## 9. 風險與禁止

| 禁止 | 原因 |
|------|------|
| 設計頁新 tab | SEO 第六次重演 |
| 把空間風格做進 promo-camera-app（L3 凍結） | 隔離規則 |
| 家具 prompt 查表硬編 | `flux-gemini-prompt-policy` |
| 對使用者顯示 Gemini 模型名 | 規劃 §3.13 |

---

## 10. 待你測完 P0a 後確認的決策

1. **generation_mode** 用新值 `space_style` 還是沿用 `camera_advanced` + meta？（建議新值，資產庫較清晰）  
2. **家具 P1** 上限幾張？（建議 3，Gemini 多圖上限）  
3. **短網址** `/space-style/` 是否 P0 就要？（可 P1）
