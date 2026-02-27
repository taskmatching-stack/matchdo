# 我的 AI 編輯區 — 前台與管理區整合規劃

更新日期：2026-02-22

---

## 〇、Prompt 翻譯（Gemini）

- **所有**送給 Stability 的 prompt（草圖轉圖像、結構、風格引導、風格轉換、**內部補繪** 等）會先經 **Gemini** 翻譯成英文再送出，以提升生圖品質。
- 若輸入已是英文或未啟用翻譯（`.env` 設 `ENABLE_PROMPT_TRANSLATION=false`），則直接使用原文。
- 翻譯使用後台「AI 模型」設定的 **Gemini 翻譯模型**（預設 `gemini-2.5-flash-lite`）；金鑰為 `.env` 的 `GEMINI_API_KEY`。
- **對話介面**或任何未來會送 prompt 給 Stability 的介面，皆應在後端先呼叫同一套翻譯再送 API。

---

## 一、定位與原則

- **與設計／製作流程脫鉤**：這些功能不綁定「客製產品／再製／發案／找製作方」流程，純粹提供**使用者方便編輯圖片**的 AI 工具。
- **前台**：登入用戶在「**我的**」底下有一個統一入口「**我的 AI 編輯區**」，進入後在同一區內可選用：放大、編輯（Edit）、控制（Control）等子功能。
- **管理區**：後台有一個統一的「**AI 工具**」區，同樣整合放大與未來的編輯／控制工具，管理員使用**不扣點**。

---

## 二、功能清單（依你提供的 Edit / Control 分類）

| 分類 | 功能 | 說明 | 前台扣點建議 | 實作階段 |
|------|------|------|--------------|----------|
| **已上線** | **AI 圖片放大** | 4x 放大（Stability Fast） | 10 點/次（已接） | ✅ 已有 API + 頁面 |
| **Edit** | Erase Object | 塗掉物件 | 20 點/次（已接） | ✅ 已有 API + 頁面 |
| **Edit** | Inpaint | 內部補繪（mask + prompt 重繪區域） | 20 點/次 | ✅ 已有 API，前台/後台入口同編輯區 |
| **Edit** | Outpaint | 延伸畫面 | 待訂 | 規劃中 |
| **Edit** | Remove Background | 去背 | 待訂 | 規劃中 |
| **Edit** | Search and Recolor | 搜尋並改色 | 待訂 | 規劃中 |
| **Edit** | Search and Replace | 搜尋並替換 | 待訂 | 規劃中 |
| **Edit** | Replace Background & Relight | 換背景與重打光 | 待訂 | 規劃中 |
| **Control** | Sketch | 草圖→成圖 | 待訂 | 規劃中 |
| **Control** | Structure | 結構控制成圖 | 待訂 | 規劃中 |
| **Control** | Style Guide | 風格參考成圖 | 待訂 | 規劃中 |
| **Control** | Style Transfer | 風格轉換 | 待訂 | 規劃中 |
| **Control** | Recolor | 重新上色 | Coming Soon | 規劃中 |

- 扣點規則可沿用現有邏輯：**前台**依 `payment_config` 對應 key 扣點；**管理區**一律不扣點。

---

## 三、前台：「我的」→ 我的 AI 編輯區

### 3.1 選單調整

- **現狀**：「我的功能」下拉有單一連結「AI 圖片放大」→ `/client/ai-upscale.html`。
- **調整**：
  - 將該連結改為「**我的 AI 編輯區**」。
  - 連結目標改為 **`/client/ai-edit.html`**（統一入口頁）。
  - 保留 i18n key，例如 `nav.aiEditArea`：`我的 AI 編輯區`。

### 3.2 統一入口頁 `/client/ai-edit.html`

- **頁面標題**：我的 AI 編輯區（或「AI 編輯區」）。
- **版面**：與設計頁相同 — **左欄設定、右欄顯示**（`create-panel` 網格：左約 280–380px，右 1fr；功能較少故表單精簡）。
- **結構建議**：
  1. **左欄**：工具列表（放大／編輯／控制），選「放大」時顯示上傳區＋「開始放大」；編輯／控制目前標「規劃中」。
  2. **右欄**：預留提示 → 選圖後顯示原圖預覽 → 執行後顯示結果與下載。
  3. **區塊一：放大**
     - 標題「放大」
     - 說明：4 倍 AI 放大，每次 10 點。
     - 行為：可 **內嵌同一套上傳＋放大 UI**，或 **按鈕／卡片連結到 `/client/ai-upscale.html`**（建議先連結，之後若有需要再改內嵌）。
  3. **區塊二：Edit（編輯）**
     - 標題「編輯」
     - 列出：Erase Object、Inpaint、Outpaint、Remove Background、Search and Recolor、Search and Replace、Replace Background & Relight。
     - 已實作：可點擊進入子頁或展開表單。
     - 未實作：顯示「規劃中」或「即將推出」。
  4. **區塊三：Control（控制）**
     - 標題「控制」
     - 列出：Sketch、Structure、Style Guide、Style Transfer、Recolor（Coming Soon）。
     - 同上，已實作可進入，未實作顯示規劃中／即將推出。

- **技術**：與現有前台一致（Bootstrap、auth-middleware、site-header），登入後才能使用；呼叫既有 `/api/upscale-image` 或未來各編輯 API 時帶 Bearer token，402 時導向點數頁。

### 3.3 網址與導覽

| 項目 | 建議 |
|------|------|
| 統一入口 | `/client/ai-edit.html` |
| 僅放大（可保留書籤） | `/client/ai-upscale.html` |
| 未來子功能 | 可選 `/client/ai-edit.html#erase`、`/client/ai-edit.html#inpaint` 或獨立頁如 `/client/ai-edit-inpaint.html`，依實作複雜度決定。 |

---

## 四、管理區：AI 工具整合

### 4.1 選單調整

- **現狀**：側邊欄有「生圖 Playground」「AI 放大」兩個獨立項目。
- **調整**：
  - 新增一個總入口「**AI 工具**」或「**AI 編輯區**」，連結到 **`/admin/ai-tools.html`**。
  - **方案 A（推薦）**：一個「AI 工具」頁，底下用區塊或分頁呈現「放大」「編輯」「控制」；左側選單只保留一個「AI 工具」連結。
  - **方案 B**：左側選單保留「AI 工具」父項，底下子項為「放大」「編輯（規劃中）」「控制（規劃中）」；「放大」可繼續連到現有 `/admin/upscale.html`，或併入 `ai-tools.html` 的其中一個分頁。

### 4.2 統一頁 `/admin/ai-tools.html`

- **頁面標題**：AI 工具（或「AI 編輯區」）。
- **結構建議**：
  1. **區塊一：放大**
     - 與現有 `/admin/upscale.html` 相同流程（上傳→呼叫 `POST /api/upscale-image`→下載），可 **內嵌同一 UI** 或 **iframe／連結到 upscale.html**；建議內嵌或同一頁分頁，體驗較一致。
  2. **區塊二：Edit（編輯）**
     - 列出上述 Edit 七項，未實作顯示「規劃中」。
  3. **區塊三：Control（控制）**
     - 列出上述 Control 五項，未實作顯示「規劃中」。

- **權限**：僅管理員，沿用現有 `requireAdmin`；呼叫各 API 時後端依管理員身分不扣點。

### 4.3 網址與導覽

| 項目 | 建議 |
|------|------|
| 統一入口 | `/admin/ai-tools.html` |
| 僅放大（可保留） | `/admin/upscale.html` |
| 未來子功能 | 可為 `ai-tools.html#inpaint` 或獨立頁，依需求決定。 |

---

## 五、實作順序建議

| 階段 | 內容 |
|------|------|
| **1. 前台入口與選單** | 選單「AI 圖片放大」改為「我的 AI 編輯區」→ `/client/ai-edit.html`；新增 `ai-edit.html` 作為統一入口，內含「放大」區塊（連結至 `/client/ai-upscale.html`）＋ Edit／Control 區塊（目前僅列出名稱與「規劃中」）。 |
| **2. 管理區入口與選單** | 側邊欄新增「AI 工具」→ `/admin/ai-tools.html`；`ai-tools.html` 內含「放大」區塊（可內嵌現有 upscale UI 或連結至 `/admin/upscale.html`）＋ Edit／Control 區塊（列出名稱與「規劃中」）。可視需求決定是否保留側欄「AI 放大」單獨連結。 |
| **3. 未來各子功能** | 依 API 與產品優先級，逐項實作 Edit／Control；每項可選在 `ai-edit.html` / `ai-tools.html` 內嵌表單，或獨立子頁再從統一入口連結。 |

---

## 六、與既有設計／製作邏輯的關係

- **不綁定**：不使用「客製產品」「再製方案」「找製作方」等流程的狀態或資料。
- **不強制**：用戶可完全不用 AI 編輯區，仍可正常使用發案、找廠、訂製品等。
- **點數**：僅前台一般用戶會依規則扣點；管理區不扣點；扣點規則與現有 `points_ai_upscale` 等一致，可擴充新 key（如 `points_ai_inpaint` 等）。

---

## 七、摘要

| 項目 | 前台 | 管理區 |
|------|------|--------|
| 選單入口 | 我的 → **我的 AI 編輯區** | 側欄 **AI 工具** |
| 統一頁 | `/client/ai-edit.html` | `/admin/ai-tools.html` |
| 內容 | 放大（連結現有頁）＋ Edit 列表 ＋ Control 列表 | 放大（內嵌或連結）＋ Edit 列表 ＋ Control 列表 |
| 扣點 | 依各功能規則（放大已 10 點）；管理區不扣點 | 不扣點 |
| 與設計／製作 | 無關，獨立工具 | 無關，獨立工具 |

此規劃可讓「放大」與未來的 Edit／Control 功能都收斂在單一入口，使用者與管理員體驗一致，且不影響現有設計與製作邏輯。
