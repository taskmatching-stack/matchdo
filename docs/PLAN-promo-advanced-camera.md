# 攝影模擬・相機控制台 — 規劃與實作說明

> **更新**：2026-07-29  
> **狀態**：Phase 1 實作中  
> **原則**：**只加不改** — 獨立頁、獨立 API、獨立 prompt 組裝；**禁止**影響設計頁／廠商區既有情境圖 TAB。

---

## 1. 已定案決策

| # | 決策 |
|---|------|
| 1 | **AI 對話框 + 相機介面**；僅上傳／數位資產匯入產品；FLUX 圖生圖；場景＋解析度與現有情境圖一致 |
| 2 | **獨立入口**，與簡易 TAB **UI 不重疊** |
| 3 | **僅**從情境圖 TAB 內連結進入，不加全站選單 |
| 4 | 相機／底片選項 **純 FLUX 畫質模擬**，不綁任何相機系統生態 |

---

## 2. 檔案與 URL

| 項目 | 路徑 |
|------|------|
| 前台頁 | `public/client/promo-camera.html` → `/client/promo-camera.html` |
| 前端模組 | `public/js/promo-camera/`（api、state、index） |
| 樣式 | `public/css/promo-camera.css`（限定 `#promo-camera-app`） |
| 管理區 | `public/admin/promo-camera-params.html` |
| SQL | `docs/add-promo-camera-params.sql` |
| Build | `window.__MATCHDO_PROMO_CAMERA_BUILD` |

SEO：`noindex`（工作區頁）。

---

## 3. 與現有功能隔離

| 項目 | 做法 |
|------|------|
| 生圖 API | **新** `POST /api/promo-camera/generate`（不修改 `/api/promo-image/generate`） |
| Prompt | **新** `buildPromoCameraAdvancedPrompt()`（不修改 `buildPromoImagePrompt`） |
| 攝影參數組 | 攝影模擬頁**不用** `photography_prompt_sets`（由七維相機參數取代） |
| 紀錄 | 同一表 `product_promo_generations`，`generation_mode = 'camera_advanced'` |
| 模型／點數 | 沿用 `bfl_flux_model_promo_image`、`points_promo_image_*` |

---

## 4. UI 布局

- **左**：聊天（選圖、主題／場景、比例／MP、描述、生成、結果）
- **右**：相機控制台（七維下拉 + LCD 摘要）
- **手機**：上下堆疊（相機區在下方或 Tab）

---

## 5. 相機七維（DB：`promo_camera_param_options`）

**管理區**：`/admin/promo-camera-params.html` — 七類 CRUD，每筆 `prompt_fragment` 可獨立編輯，方便擴充提示詞。

| category | UI |
|----------|-----|
| `camera_brand` | 機身／畫質質感 |
| `film_simulation` | 底片／數位風格 |
| `aperture` | 光圈 |
| `exposure_ev` | EV |
| `focal_length` | 焦段 |
| `lens_type` | 鏡頭類型 |
| `aperture_blades` | 光圈葉片數（光斑／耀光） |

## 5b. 點數與參考圖

### 情境圖 TAB

| 項目 | 定案 |
|------|------|
| 計價 | **固定每張**；一般 **20**／訂閱 **15** |
| 後台 key | `points_promo_image_standard`、`points_promo_image_subscriber` |
| 參考圖 | 最多 **8 張** |

### 攝影模擬

| 項目 | 定案 |
|------|------|
| 計價 | **1 MP 基礎**（一般 20／訂閱 10）**+ 每多 1 MP +10** |
| 後台 key | `points_promo_camera_standard`、`points_promo_camera_subscriber`、`points_promo_camera_per_extra_mp` |
| 參考圖 | **僅 1 張** |

訂閱判定：`hasActivePaidSubscription()`（與全站一致）。

---

## 6. Prompt 組裝順序

1. 情境圖廣告定位底稿（與現有相同語意）
2. 主題 + 場景（`promo_scene_templates`）
3. 相機光學區塊（七維 DB 片段）
4. 使用者描述（聊天輸入）

---

## 7. API

| 方法 | 路徑 |
|------|------|
| GET | `/api/promo-camera/options` |
| POST | `/api/promo-camera/generate` |
| GET/POST/PUT/DELETE | `/api/admin/promo-camera-params` |

---

## 8. APP 延伸性

- Web 為第一個 client；業務邏輯以 API JSON 為準
- 前端 `api.js` / `state.js` 與 DOM 分離，便於原生 APP 重用

---

## 9. 入口

設計頁／廠商素材庫「情境圖 TAB」底部一行：

```html
<a href="/client/promo-camera.html?back=design">攝影模擬 →</a>
```

---

## 10. Phase 1 完成項

- [x] 本文件 + SQL
- [x] 後端 API + prompt 組裝
- [x] 管理區 CRUD
- [x] 獨立頁 + TAB 連結
