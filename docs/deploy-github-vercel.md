# 用 GitHub + 雲端部署（Vercel / Render）

> **建議**：本專案為 Node.js + Express 常駐後端，**優先使用 Zeabur**（免費額度內不休眠、全中文）。完整步驟見 **`docs/deploy-zeabur-github.md`**。本檔保留 GitHub 步驟與 Render／Vercel 說明。

## 一、先把程式碼放到 GitHub

### 1. 在 GitHub 建立新倉庫

1. 登入 [GitHub](https://github.com)
2. 右上角 **+** → **New repository**
3. Repository name 填：`ai-matching`（或你要的名稱）
4. 選 **Private** 或 **Public**
5. **不要**勾 "Add a README"（專案已有檔案）
6. 按 **Create repository**

### 2. 在本機用 Git 推上去

在專案資料夾（有 `server.js`、`package.json` 的那一層）開終端機：

```bash
# 若還沒初始化
git init

# 追蹤所有檔案（.env、node_modules 已被 .gitignore 排除）
git add .
git commit -m "Initial commit"

# 連到你的 GitHub 倉庫（網址改成你自己的）
git remote add origin https://github.com/你的帳號/ai-matching.git

# 推上去（主分支名稱可能是 main 或 master）
git branch -M main
git push -u origin main
```

若 GitHub 要你登入，用帳號密碼或 **Personal Access Token**（Settings → Developer settings → Personal access tokens）當密碼。

---

## 二、這個專案該用哪個雲端？

這個專案是 **Node.js + Express 後端**（`node server.js` 一直跑、聽 3000 port），不是純靜態網站。

| 平台 | 適合嗎 | 說明 |
|------|--------|------|
| **Vercel** | 較不適合 | 主要是靜態／Serverless，跑整顆 Express 要改寫、有執行時間與冷啟動限制 |
| **Zeabur** | ✅ 最推薦 | 台灣團隊、免費額度 $5、額度內不休眠；見 **`docs/deploy-zeabur-github.md`** |
| **Render** | ✅ 適合 | 支援「Web Service」一鍵跑 `npm start`，同一 repo 即可；免費版會休眠 |
| **Railway** | ✅ 適合 | 同上，連 GitHub 後選 Node、跑 `npm start` |

建議：**用 GitHub + Zeabur**（見 `docs/deploy-zeabur-github.md`）；或 Render／Railway 部署這顆後端。

---

## 三、用 Vercel（只放靜態前端時）

若你**只**想把「靜態檔（HTML/CSS/JS）」放 Vercel，後端改放別台（例如 Render）：

1. 登入 [Vercel](https://vercel.com) → **Add New** → **Project**
2. 選 **Import Git Repository**，連到你的 GitHub，選 `ai-matching`
3. 設定：
   - **Root Directory**：可留空或填 `public`（若你只想部署 public 資料夾）
   - **Build Command**：留空或 `npm run build`（若你有 build）
   - **Output Directory**：留空或 `public`
4. **Environment Variables**：把前端會用到的變數（例如 `VITE_*`）填上去，**不要**把 `.env` 整份貼上（金鑰不要進 Vercel 除非必要）
5. 按 **Deploy**

這樣會得到一個「只有靜態檔」的網址，API 要指向你另外部署的後端網址（例如 Render 的 URL）。

---

## 四、用 Render 部署整顆後端（推薦）

1. 登入 [Render](https://render.com) → **Dashboard** → **New** → **Web Service**
2. 選 **Build and deploy from a Git repository**，連 GitHub，選 `ai-matching`
3. 設定：
   - **Name**：`ai-matching`（或自訂）
   - **Runtime**：**Node**
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
4. **Environment**：
   - 點 **Add Environment Variable**
   - 把本機 `.env` 裡用到的變數**一筆一筆**加進去（例如 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`BFL_API_KEY` 等），**不要**把整份 .env 貼上
5. 按 **Create Web Service**

Render 會自動從 GitHub 拉程式、建置、跑 `npm start`，並給你一個網址，例如：  
`https://ai-matching-xxxx.onrender.com`

前端若也放在同一專案（例如 `public/` 由 Express 提供），同一個網址就能同時打到網頁和 API。

---

## 五、若堅持用 Vercel 跑整顆 Express

需要把現有 `server.js` 改成可被 Vercel Serverless 呼叫（匯出 app、不直接 listen），並加一個 `api` 入口。程式改動較多，且會受 Vercel 函數時間與大小限制，一般不建議。若你之後要往這條路做，再告訴我，我可以依你目前 `server.js` 結構寫具體改法。

---

## 六、部署後記得

- **環境變數**：雲端上的專案要自己加 Environment Variables，和本機 `.env` 對齊（金鑰、Supabase、BFL 等）。
- **Supabase**：若後端網址變了（例如從 localhost 變成 Render 網址），要在 Supabase 的 Authentication → URL Configuration 把 Site URL / Redirect URLs 設成新網址。
- **HTTPS**：Render / Vercel 都會給 HTTPS，前端呼叫 API 時用相對路徑 `/api/...` 即可，不必改程式。

---

**簡短結論**：  
**GitHub**：照「一」做完就有 repo。  
**部署**：建議用 **Render** 選 Web Service + Node，連同一個 GitHub repo，`npm start` 跑整顆後端；若只要靜態站才用 **Vercel**。
