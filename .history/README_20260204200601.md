# MatchDO 合做 — 最小依賴與快速啟動

本專案目前是「靜態前端 + 極簡後端」的設計：前端為 Bootstrap + 原生 JavaScript；後端僅負責呼叫 Gemini 與（可選）代理資料查詢，保持簡潔。

## 依賴（來自 package.json）
- express：提供極簡 HTTP 伺服器與靜態檔案服務
- multer：處理前端圖片上傳（記憶體儲存）
- dotenv：載入 `.env` 變數（Supabase/Gemini 金鑰）
- @supabase/supabase-js：連線 Supabase（查價、後續 Auth/DB）
- @google/generative-ai：呼叫 Gemini 3.0 Vision（圖片→JSON 規格）

> 備註：目前 `openai` 套件未在 [server.js](server.js) 使用，若要最小化依賴可移除。

## 環境變數
於 [.env](.env) 已配置：
- `SUPABASE_URL` / `SUPABASE_KEY`（anon key，可前端使用；敏感操作改走 Edge Functions）
- `GEMINI_API_KEY`（僅在後端使用，避免暴露於瀏覽器）

## 快速啟動
```bash
cd D:\AI建站\ai-matching
npm install
npm start
```
- 伺服器預設執行於 `http://localhost:3000/`
- 首頁測試：上傳圖片 → 觸發 `/api/analyze` → 顯示估價明細
- 管理介面示範：`http://localhost:3000/admin/index.html`

## 為什麼不是純前端？
- 目的：保護 `GEMINI_API_KEY`，不直接暴露於瀏覽器；用後端轉呼 AI。
- 好處：保持簡單，同時滿足安全性與圖片上傳需求。

## 想要更「純前端」的選項
- 把 AI 與金流邏輯改到 Supabase Edge Functions：
  - 前端以 `fetch('https://<project>.functions.supabase.co/<fn>')` 呼叫。
  - `GEMINI_API_KEY`/支付密鑰都在 Edge Functions 的環境變數，不進瀏覽器。
- 本地不跑 Node 伺服器也可運作（以任意靜態主機提供前端）。

## 下一步建議
- 先建立 `price_library` 表與測試資料，讓 `/api/analyze` 能完整計算估價（參考 docs/matchdo-architecture.md）。
- 若你要極簡依賴：刪除 `openai` 並 `npm uninstall openai`。
- 後續依 Roadmap 分階段：Auth → Edge Functions → Matching SQL → 金流。
