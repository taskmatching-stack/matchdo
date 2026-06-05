# matchdo.cc 推送與部署（正式環境）

**matchdo.cc** 跑在 **GCP Cloud Run**（專案 `matchdo`、區域 `asia-northeast1`、服務 `matchdo`）。  
**GitHub** 只負責**版本管理**；**部署**是另外一步，把 GitHub `main` 的程式建置並上線。

---

## 一、每次上線的順序（必記）

```text
① 本機改程式 → commit
② git push origin main        ← 推到 GitHub（版本庫）
③ 部署指令                    ← 從 GitHub 拉 main 再建置上線
```

| 步驟 | 會不會讓 matchdo.cc 變新？ |
|------|---------------------------|
| 只做 ② push | **不會**（除非已設 Cloud Build 觸發，見下文「選用」） |
| 做完 ③ 部署 | **會** |

**禁止**在還沒 push 成功前就部署（會拉到舊版 commit）。

---

## 二、推送到 GitHub

在本機專案根目錄（有 `server.js` 的那一層）：

```powershell
git add <要上線的檔案>
git commit -m "簡短說明這次改了什麼"
git push origin main
```

確認：

```powershell
git status
git log -1 --oneline
```

應顯示 `Your branch is up to date with 'origin/main'`，且 `git log -1` 為你要上線的那個 commit。

遠端儲存庫：`https://github.com/taskmatching-stack/matchdo`（分支 `main`）。

---

## 三、部署（二擇一，指令內容相同）

部署前都會 **`git fetch origin main` + `git reset --hard origin/main`**，代表**只部署 GitHub 上的 main**，不是本機未 commit 的檔案。

### 方式 A：Google Cloud Shell（慣用）

1. 開啟 [Google Cloud Shell](https://shell.cloud.google.com)，專案選 **matchdo**。
2. 若額度未滿、Shell 能開，**整行貼上執行**：

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```

3. 等待約 **5～10 分鐘**（上傳、建置、部署）。
4. 成功時會出現 `Done.`、`revision [...] has been deployed and is serving 100 percent of traffic` 與 `Service URL`。

**若 Shell 顯示「超過 Cloud Shell 用量上限」**：改用法 B，或等額度重置後再貼同一行。

### 方式 B：本機 PowerShell（Cloud Shell 無法使用時）

與方式 A **同一套邏輯**，只是終端機改在本機。需已安裝 [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)（`gcloud --version` 有版本即可）。

```powershell
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
cd "d:\AI建站\ai-matching"
git fetch origin main
git reset --hard origin/main
gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```

或整行（與方式 A 參數完全相同，僅目錄改本機路徑）：

```powershell
gcloud config set account taskmatching@gmail.com; gcloud config set project matchdo; cd "d:\AI建站\ai-matching"; git fetch origin main; git reset --hard origin/main; gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```

成功／失敗訊息與方式 A 相同。

---

## 四、不要做的事

| ❌ 錯誤 | 說明 |
|--------|------|
| `gcloud run services update-traffic ...` | 只切流量，**不是**重新建置上線 |
| 拆掉 `fetch` + `reset --hard` 直接 deploy | 可能部署本機未 push 的舊檔 |
| 自行改 `gcloud run deploy` 參數 | 方式 A／B 須一致：`--source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image` |

---

## 五、選用：設好後只需 push（Cloud Build 觸發）

若不想每次手動跑部署指令，可在 GCP **一次性**設定：

1. [Cloud Build → 觸發條件](https://console.cloud.google.com/cloud-build/triggers?project=matchdo)
2. **建立觸發條件** → 來源 **GitHub（第 2 代）** → `taskmatching-stack/matchdo`
3. 分支：`^main$`
4. 類型：**部署至 Cloud Run** → 區域 `asia-northeast1`、服務 `matchdo`、允許未驗證的呼叫
5. 儲存

之後流程變成：**改程式 → commit → `git push origin main`**，到 [Cloud Build → 記錄](https://console.cloud.google.com/cloud-build/builds?project=matchdo) 看進度即可。

**注意**：未建立觸發條件前，**僅 push 不會上線**。

---

## 六、部署後檢查

- 瀏覽器開 https://matchdo.cc ，必要時 **Ctrl+F5** 強制重新整理。
- 建置失敗：到 Cloud Build 記錄看 log；或本機執行  
  `gcloud builds list --region=asia-northeast1 --limit=1`

---

## 七、常見釐清

| 說法 | 實際意思 |
|------|----------|
| 「從 GitHub 部署」 | 部署前先 `fetch` + `reset --hard origin/main`，來源是 GitHub `main` |
| 「本機部署」 | 在本機終端機執行 `gcloud run deploy`；若**有**先 reset 到 `origin/main`，仍等同從 GitHub 部署 |
| 「push 就會上線」 | **僅在**已設 Cloud Build 觸發時成立 |

---

## 八、相關文件

- `docs/deploy-zeabur-github.md` — Zeabur／GCP 較完整說明、環境變數
- `.cursor/rules/deployment.mdc` — Agent 用部署規則（與本檔一致）
