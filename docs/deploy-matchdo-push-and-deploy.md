# matchdo.cc 推送與部署（正式環境）

**matchdo.cc** 跑在 **GCP Cloud Run**（專案 `matchdo`、區域 `asia-northeast1`、服務 `matchdo`）。  
**GitHub** 只負責**版本管理**；**部署**是另外一步，把 GitHub `main` 的程式建置並上線。

---

## 一、每次上線的順序（必記）

```text
① 本機改程式 → commit
② git push origin main        ← 推到 GitHub（版本庫）
③ 部署指令                    ← 從 GitHub 拉 main 再建置上線（Cloud Shell 見 **§3.1 整行**，必含 `grep`）
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

## 三、部署

部署前都會 **`git fetch origin main` + `git reset --hard origin/main`**，代表**只部署 GitHub 上的 main**，不是本機未 commit 的檔案。

### ⚠️ Cloud Shell 必讀（貼錯指令 = 滿屏紅字，但多半仍會成功）

在 Cloud Shell 執行 `gcloud` 時，**未過濾版**會反覆刷：

```text
Regional Access Boundary HTTP request failed ...
Account not found for email: ...taskmatchlng@gmail.com
```

這是 **Google Cloud Shell 內建 gcloud 的已知噪音**（`taskmatchlng` 是 Google 端字串錯誤，**不是你的 Gmail 打錯**）。**不代表部署失敗。**

| 你看到的 | 要不要緊？ |
|----------|------------|
| 上面紅字，但後面有 `Uploading sources...done`、`Building Container...` | **不要緊**，繼續等 |
| 最後出現 **`Done.`** | **部署成功**，網站已更新 |
| **`TokenRefreshError`** 或長時間無 `Done.`、建置中斷 | **要緊**，見下方「真的失敗」 |

**怎麼避免滿屏紅字？** 下面 **§3.1 整行複製**（含 `grep -v` 過濾）。**禁止**貼不含 `grep` 的舊版單行——邏輯相同，只會多洗幾十行假錯誤。

#### ⛔ 禁止的部署尾綴（Agent／文件屢犯，對 `Regional Access Boundary` **完全無效**）

| ❌ 錯誤寫法 | 為何不行 |
|------------|----------|
| **不含 `grep`** 的 `gcloud run deploy … && update-traffic` | 滿屏 `taskmatchlng` 假錯誤 |
| `\| grep -v -E 'Downloading\|Extracting\|Verifying\|Already exists\|Pull complete\|Status:'` | 只過濾 Docker 層訊息，**過濾不了** `Regional Access Boundary` |
| `deploy … 2>&1 \| grep … && update-traffic`（grep 只接在 deploy 上） | `update-traffic` 在 grep **外**，且括號結構錯 |
| 刪掉末尾 `grep`「讓輸出乾淨一點」 | 會以為部署失敗 |

**Cloud Shell 唯一合法尾綴（整段 deploy 必須包在括號內再 pipe）：**

```bash
) 2>&1 | grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'
```

完整可貼指令見 **§3.1**（含前面的 `gcloud config set account` 與 `( gcloud run deploy … && gcloud run services update-traffic … )`）。

**真的失敗時（不是 taskmatchlng 噪音）：**

```bash
gcloud auth login
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
```

仍不行 → Cloud Shell 右上角 **⋮ → Restart**，重開後再跑 **§3.1 安靜版**。

**禁止：** 為了消紅字去改 GitHub 帳號、亂刪 GCP 專案，或以為 `taskmatchlng` 是你的第二個 Google 帳號。

---

### 3.1 方式 A：Google Cloud Shell — **唯一預設指令（整行複製）**

1. 開啟 [Google Cloud Shell](https://shell.cloud.google.com)，專案選 **matchdo**。
2. **（建議）** 每次重開 Shell 先貼兩行：

```bash
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
```

3. **整行貼上（這就是正式部署指令，不要改、不要刪末尾 `grep`）：**

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && ( gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest ) 2>&1 | grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'
```

> 末尾 `update-traffic --to-latest`：避免流量釘死舊 revision。  
> `grep` 只藏已知噪音；**`Done.`、`revision [...] has been deployed`、真正錯誤仍會顯示**。

4. 等待約 **5～10 分鐘**（上傳、建置、部署）。
5. 成功時會出現 **`Done.`**、`revision [...] has been deployed and is serving 100 percent of traffic` 與 `Service URL`。

**若 Shell 顯示「超過 Cloud Shell 用量上限」**：改 **§3.2 方式 B（本機 PowerShell）**，或等額度重置後再貼 §3.1 那一行。

---

### 3.2 方式 B：本機 PowerShell（Cloud Shell 無法使用時）

> **勿將本節指令貼到 Cloud Shell。** Cloud Shell 必用 **§3.1**（含 `grep` 過濾 `Regional Access Boundary|taskmatchlng`）。

與方式 A **同一套邏輯**，只是終端機改在本機。需已安裝 [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)（`gcloud --version` 有版本即可）。

```powershell
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
cd "d:\AI建站\ai-matching"
git fetch origin main
git reset --hard origin/main
gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest
```

或整行（與方式 A 參數完全相同，僅目錄改本機路徑）：

```powershell
gcloud config set account taskmatching@gmail.com; gcloud config set project matchdo; cd "d:\AI建站\ai-matching"; git fetch origin main; git reset --hard origin/main; gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image; gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest
```

成功／失敗訊息與 §3.1 相同（本機 gcloud **通常不會**刷 `taskmatchlng` 紅字）。

### 3.3 方式 C：兩段式部署（§3.1 單行 `--source` 無法完成時）

**優先仍用 §3.1 那一行**；僅在下列情況改本節：

| 症狀 | 說明 |
|------|------|
| 卡在 `Uploading sources...` 很久或 Shell 中斷 | Cloud Shell 上傳 ~120MB 壓縮包不穩 |
| `Container import failed` | source deploy 映像匯入失敗（本機 PowerShell 亦常見） |
| 單行跑不完、但需上線 | 建置改走 repo 根目錄 **`cloudbuild.yaml`**（手動 docker build，避開上述匯入問題） |

> **說明**：兩段式**不會比單行少傳檔**（第一步仍要上傳 tarball）；慢的是上傳＋建置。Shell 斷線後見下方「Shell 中斷」。  
> 同樣**必須用下方整行（含 `grep`）**，勿貼無過濾版。

**Cloud Shell 整行貼上（含 `grep`，與 §3.1 相同過濾）：**

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && ( BUILD_ID=$(gcloud builds submit --config=cloudbuild.yaml --region=asia-northeast1 --async --format='value(id)') && gcloud builds log $BUILD_ID --region=asia-northeast1 --stream && gcloud run deploy matchdo --image=asia-northeast1-docker.pkg.dev/matchdo/cloud-run-source-deploy/matchdo:$BUILD_ID --region=asia-northeast1 --allow-unauthenticated && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest ) 2>&1 | grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'
```

> **勿用** `--format='value(id)'` **不帶 `--async`**：同步 submit 會把整段 build log 灌進 `BUILD_ID`，導致 `gcloud run deploy` 報 `unrecognized arguments`。

等待約 **5～15 分鐘**（上傳＋建置＋部署）；可開 [Cloud Build 記錄](https://console.cloud.google.com/cloud-build/builds?project=matchdo) 看進度。成功時會出現 `revision [...] has been deployed`。

**Shell 中斷**：重連後先查，不要馬上重跑整行：

```bash
gcloud builds list --region=asia-northeast1 --limit=3
```

- **SUCCESS** 且尚未 deploy → 只補 deploy（把 `ID` 代入）：`gcloud run deploy matchdo --image=asia-northeast1-docker.pkg.dev/matchdo/cloud-run-source-deploy/matchdo:ID --region=asia-northeast1 --allow-unauthenticated && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest`
- **WORKING** / **QUEUED** → 在 Console 等完成
- 無紀錄或 **FAILURE** → 再貼上方整行

驗收同 §5.1（`spec.traffic` 應指向新 revision）。

---

## 四、不要做的事

| ❌ 錯誤 | 說明 |
|--------|------|
| Cloud Shell 貼**不含 `grep -v`** 的 deploy 單行 | 會滿屏 `taskmatchlng` 假錯誤；**一律用 §3.1 整行** |
| 用 `grep` 過濾 **`Downloading\|Extracting\|…`** | **無效**；須過濾 `Regional Access Boundary\|taskmatchlng`（見 §三禁止表） |
| `deploy … \| grep … && update-traffic`（grep 未包整段） | 結構錯；須 `( deploy && update-traffic ) 2>&1 \| grep …` |
| 平常用 `update-traffic` **代替**部署 | 只切流量、**不會**重新建置映像 |
| 拆掉 `fetch` + `reset --hard` 直接 deploy | 可能部署本機未 push 的舊檔 |
| 自行改 `gcloud run deploy` 參數 | §3.1／§3.2 須一致：`--source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image`；**備援**見 §3.3 |

---

## 五、部署後檢查與異常排除

### 5.1 正常檢查

- 瀏覽器開 https://matchdo.cc ，必要時 **Ctrl+F5**。
- 確認 **revision 有變新**（不是永遠同一個編號）：

```bash
gcloud run services describe matchdo --region=asia-northeast1 \
  --format='yaml(spec.traffic,status.latestReadyRevisionName)'
```

`spec.traffic` 應指向**本次部署產生的 revision**；`latestReadyRevisionName` 應與流量一致。

### 5.2 異常：Done 了但 revision 不變、網站仍是舊程式

**症狀**：`gcloud run deploy --source …` 顯示 Done，但 revision 仍是舊的（例如一直是 `00374-c7d`），或 `spec.traffic` 釘死在某個 `revisionName`。

**診斷**：

```bash
gcloud run services describe matchdo --region=asia-northeast1 --format='yaml(spec.traffic)'
```

若出現：

```yaml
traffic:
- percent: 100
  revisionName: matchdo-00374-c7d   # 固定舊 revision
```

代表流量被**釘在舊 revision**；之後每次 deploy 可能只會生出 **Retired** 的新 revision，訪客永遠吃舊版。

**排除**（在 Cloud Shell；`TAG` 可改成當次 commit 前 7 碼）：

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main

gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image \
  --tag=live-TAG

gcloud run services update-traffic matchdo --region=asia-northeast1 --to-tags=live-TAG=100
```

驗證：

```bash
gcloud run services describe matchdo --region=asia-northeast1 --format='yaml(spec.traffic)'
```

`traffic` 應指向**新 revision**（含 tag 或新 `revisionName`），不應再只有舊的 `00374-c7d`。

釘子拔掉後，**§3.1 那一行 `--source` deploy 應可恢復正常**（新版本會自動接流量）。

> **說明**：`update-traffic` 在此僅用於**排除流量釘死**；平常上線仍用 §3.1 建置＋部署，不要只用 `update-traffic` 當部署。

---

## 六、日後選用：GitHub push 自動部署 Cloud Run（**現階段不啟用**）

> **決策（2026-06-06）**：計畫日後改設 **Cloud Build 觸發**（push `main` 即建置並部署），但**現在不適合啟用**——擔心每次 push 會自動上線**非預期或尚未驗收的版本**。  
> **目前正式流程維持 §一～§3.1**：先 push，再**手動**於 Cloud Shell 貼 **§3.1 整行**；**禁止**現在去 GCP 建立觸發條件，也**禁止** Agent 代為設定。

### 為何日後仍值得做

- 直接從 GitHub 拉程式建映像，不經本機硬碟
- 不必每次開 Cloud Shell 貼指令
- 與「只部署已 push 的 `main`」語意一致

### 啟用前條件（將來要設時再對照）

1. 團隊習慣：**只有確定要上線的 commit 才 push `main`**（或改用工 develop 分支、僅合併後觸發）
2. 每次 push 前已確認 `git log -1` 為預期版本
3. 願意到 [Cloud Build → 記錄](https://console.cloud.google.com/cloud-build/builds?project=matchdo) 追蹤自動部署結果

### 將來設定步驟（現勿執行）

1. [Cloud Build → 觸發條件](https://console.cloud.google.com/cloud-build/triggers?project=matchdo)
2. **建立觸發條件** → 來源 **GitHub（第 2 代）** → `taskmatching-stack/matchdo`
3. 分支：`^main$`
4. 類型：**部署至 Cloud Run** → 區域 `asia-northeast1`、服務 `matchdo`、允許未驗證的呼叫
5. 儲存

啟用後流程才變成：**改程式 → commit → `git push origin main`** 即自動上線。

**現狀**：未建立觸發條件，**僅 push 不會上線**（見 §一）。正式部署指令見 **§3.1**（Cloud Shell 整行含 `grep`）。

---

## 七、常見釐清

| 說法 | 實際意思 |
|------|----------|
| 「從 GitHub 部署」 | 部署前先 `fetch` + `reset --hard origin/main`，來源是 GitHub `main` |
| 「本機部署」 | 在本機終端機執行 `gcloud run deploy`；若**有**先 reset 到 `origin/main`，仍等同從 GitHub 部署 |
| 「push 就會上線」 | **僅在**已設 Cloud Build 觸發時成立 |
| `taskmatchlng` / `Regional Access Boundary` 紅字 | Cloud Shell **gcloud 噪音**（見 §三開頭）；**用 §3.1 含 `grep` 的整行**可過濾 |
| 部署有沒有成功？ | 看有沒有 **`Done.`** 與新 revision（§5.1），**不是**看有沒有紅字 |
| Agent／文件給的 Cloud Shell 指令 | **必須**含 `grep --line-buffered -v -E 'Regional Access Boundary\|taskmatchlng'`，且 deploy+update-traffic **同在括號內**（§3.1） |
| 曾誤用的 Docker 關鍵字 `grep` | **禁止**；見 §三「禁止的部署尾綴」 |

---

## 八、建置失敗

到 [Cloud Build 記錄](https://console.cloud.google.com/cloud-build/builds?project=matchdo) 看 log；或：

```bash
gcloud builds list --region=asia-northeast1 --limit=1
```

若為 `gcloud run deploy --source` 的 **`Container import failed`** 或上傳卡住，改 **§3.3 方式 C（兩段式）**。

---

## 九、相關文件

- `docs/deploy-zeabur-github.md` — Zeabur／GCP 較完整說明、環境變數
- `.cursor/rules/deployment.mdc` — Agent 用部署規則（與本檔一致）
