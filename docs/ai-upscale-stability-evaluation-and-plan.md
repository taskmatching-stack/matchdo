# AI 放大功能：Stability AI API 評估與執行規劃

更新日期：2026-02-22

**需求**：平台「AI 放大」扣 **10 點/次**，需選用效果與成本皆合適的 API。

---

## 一、Stability AI 放大方案整理

依 [Stability AI Developer Platform - Upscale](https://platform.stability.ai/docs/api-reference#tag/Upscale) 與您提供的價目：

| 方案 | 說明 | 單次價格（credits） | 約當美金（$0.01/credit） |
|------|------|---------------------|---------------------------|
| **Fast Upscaler** | 單純放大，解析度 ×4，上限 4 megapixels | **2** | **$0.02** |
| **Conservative Upscaler** | 低解析→4K，不重新詮釋畫面 | 40 | $0.40 |
| **Creative Upscaler** | 可加 prompt，低解析→4K 精修 | 60 | $0.60 |

- 官網計價：**$10 = 1,000 credits** → 1 credit = $10÷1000 = **$0.01**。  
- 2 credits 換算：2÷1000 = 0.002（佔 1000 張比例），金額 = 0.002 × $10 = **$0.02**（非 $0.002）。

---

## 二、效果與成本評估（是否符合你的放大需求）

### 效果（依情境選擇）

| 情境 | 建議方案 | 理由 |
|------|----------|------|
| **產品圖／設計圖「只放大、不亂改」** | **Conservative** 或 **Fast** | 不重畫內容，線條與顏色較可預期。 |
| **只要解析度 ×4、成本壓低** | **Fast** | 4x、最高 4MP，適合多數訂製品縮圖放大。 |
| **希望「修細節、更精緻」且可接受高成本** | Creative | 有 prompt、可微調風格，單次 60 credits。 |

- **Fast**：效果為「單純放大」，適合「把現有圖放大給廠商看／列印」。
- **Conservative**：效果為「低解析→4K、不重新詮釋」，適合要 4K 且盡量保持原圖。
- **Creative**：效果最強但貴，且會重新詮釋，較不適合「忠實放大」。

### 成本（對應你 10 點/次）

| 方案 | 單次 API 成本 | 與「10 點/次」的關係 |
|------|----------------|------------------------|
| **Fast** | **約 $0.02** | 成本低，10 點/次容易覆蓋成本並留利潤空間，**最符合你訂的 10 點**。 |
| Conservative | 約 $0.40 | 單次成本高，除非 1 點價值 ≥ 約 $0.04，否則 10 點難覆蓋。 |
| Creative | 約 $0.60 | 單次成本更高，10 點更難覆蓋。 |

**結論**  
- **若堅持「10 點/次」且要控制成本**：建議採用 **Fast Upscaler**（2 credits），效果為單純 4x 放大、成本約 $0.02/次，與 10 點設定最匹配。  
- 若日後要「不重畫的 4K」且願意提高單次扣點或定價，再考慮 **Conservative**。

---

## 三、API 端點與文件

- **Fast Upscaler**  
  - `POST https://api.stability.ai/v2beta/stable-image/upscale/fast`  
  - 文件：[Fast Upscale](https://platform.stability.ai/docs/api-reference#tag/Upscale/paths/~1v2beta~1stable-image~1upscale~1fast/post)
- **Conservative Upscaler**  
  - `POST https://api.stability.ai/v2beta/stable-image/upscale/conservative`  
  - 文件：[Conservative Upscale](https://platform.stability.ai/docs/api-reference#tag/Upscale/paths/~1v2beta~1stable-image~1upscale~1conservative/post)
- 總覽與參數說明：[Upscale Tag](https://platform.stability.ai/docs/api-reference#tag/Upscale)

呼叫前需 **API Key**（Stability 後台取得），通常放在 header：`Authorization: Bearer <key>`。

---

## 四、功能擺放位置與扣點

**扣點與預計位置**以 **`docs/points-deduction-plan.md`** 為準，摘要如下：

- **管理區**：後台選單「AI 工具」→「AI 放大」（如 `admin/ai-tools.html` 或 `admin/upscale.html`），**不扣點**。
- **前台**：獨立頁 **`/client/ai-upscale.html`**（或「我的」→「AI 圖片放大」），**10 點/次**；與發案流程無關。

---

## 五、規劃執行步驟（放大功能）

### Phase 1：環境與後端串接

| 步驟 | 內容 |
|------|------|
| 1.1 | 至 [Stability AI Platform](https://platform.stability.ai/) 註冊／登入，取得 **API Key**。 |
| 1.2 | 在專案 `.env` 新增 `STABILITY_API_KEY`（或 `STABILITY_AI_API_KEY`），勿提交至版控。 |
| 1.3 | 後端新增 **內部函式**（例如 `upscaleImageWithStability(imageBufferOrUrl, mode)`）：<br>• `mode: 'fast'` 呼叫 Fast 端點；依 [官方文件](https://platform.stability.ai/docs/api-reference#tag/Upscale) 組裝 request，解析回傳圖片。 |
| 1.4 | 新增 **對外 API** `POST /api/upscale-image`：<br>• 接受上傳圖片；可選參數 `mode`（預設 `fast`）、**`admin: true`**（僅後端依權限判斷，見下）。<br>• **若為管理員請求（admin 且已驗證為後台）**：不扣點，直接呼叫放大、回傳結果。<br>• **若為一般使用者**：需登入；讀取 `points_ai_upscale`（預設 10），成功後扣點、寫流水，回傳放大圖。 |

### Phase 2：扣點與錯誤處理（僅前台使用者）

| 步驟 | 內容 |
|------|------|
| 2.1 | 僅在「非 admin」請求時讀取 `points_ai_upscale` 並扣點；admin 路徑不查餘額、不扣點。 |
| 2.2 | 扣點時機：**僅在放大成功後**扣點；失敗不扣點。 |
| 2.3 | 餘額不足時回傳 **402**，body 帶 `{ error: '點數不足', balance }`，前端導向儲值頁。 |

### Phase 3：前台（獨立工具，與發案流程無關）

| 步驟 | 內容 |
|------|------|
| 3.1 | 新增獨立頁，例如 **`/client/ai-upscale.html`** 或 **`/tools/upscale.html`**；或於「我的」下拉選單加「AI 圖片放大」連結。 |
| 3.2 | 頁面：上傳圖片 → 呼叫 `POST /api/upscale-image`（不帶 admin）→ 顯示 loading、成功後顯示放大圖與下載。 |
| 3.3 | 若回傳 402，顯示「點數不足，請儲值」並導向 `/credits.html`。 |

### Phase 4：管理區（不扣點）

| 步驟 | 內容 |
|------|------|
| 4.1 | 後台選單新增「AI 工具」或於既有工具區加「AI 放大」。 |
| 4.2 | 頁面：上傳圖片 → 呼叫 `POST /api/upscale-image`，**後端依 admin 身分或 header/參數辨識為後台** → 不扣點、回傳放大圖。 |

### Phase 5：營運與測試

| 步驟 | 內容 |
|------|------|
| 5.1 | 後台「點數規則」已含 **AI 放大（points_ai_upscale）**，預設 10。 |
| 5.2 | 測試：前台用一般帳號放大 → 扣 10 點、流水正確；後台用管理員放大 → 不扣點。 |

---

## 六、建議優先順序

1. **先接 Fast Upscaler**（2 credits、約 $0.02），符合 10 點/次成本與「單純放大」需求。  
2. 後端同一支 `POST /api/upscale-image`，依是否為**管理員**決定扣點與否；前台獨立頁、管理區獨立入口。  
3. 上線後若用戶要求「更高品質、不重畫 4K」，再評估 **Conservative** 為進階選項（可訂較高扣點）。

以上為 Stability AI 放大 API 的效果與成本評估、功能擺放位置，以及執行步驟規劃。
