# 人像商用構圖防護 — 交接（2026-09-12）

**接續開發從此看。** 新視窗請先讀本檔，勿重做下方「已完成」。

## 最新 commit

| 項目 | 值 |
|---|---|
| **Commit** | 本輪：依原圖清晰也送中文「構圖預設商用…」；英文 lead 不再寫 erotic/suggestive |
| **基準（曾可正常出圖）** | 使用者實測有效句＝中文「構圖預設商用、避免情色感」（`e2e400e`／整理後 `35316b8`） |
| **勿再犯** | `121d90f`（描述後 append 英文 erotic/suggestive）、`5120ec6`（scene/prompt 英文 lead 加 erotic 詞）、`686e77a`（依原圖清晰**省略**中文句、只留英文 erotic） |

## 問題背景

- **依原圖（reference）** 清晰生圖常遇 Gemini `400 Image generation blocked`；同一參考圖在 **依場景** 有時可出。
- 使用者實測有效句：中文 **「構圖預設商用、避免情色感」**。
- `686e77a` 誤把依原圖清晰的中文句拿掉，只留英文 `erotic/suggestive` → 又 block。

## 已完成（勿重做）

### 1. Prompt 結構（本輪修正：依原圖清晰也送中文句）

| 路徑 | reference | scene / prompt |
|---|---|---|
| **清晰 Gemini lead** | 英文商用句在 **lead 開頭**（鎖服裝段內；**無** erotic/suggestive 詞） | **無** 英文 erotic/suggestive lead |
| **清晰 Gemini + 有描述** | 中文 `構圖預設商用…` 在描述**前** | 同左 |
| **清晰 Gemini + 無描述** | 中文商用句 → 再接姿勢依場景句 | 同左 |
| **氛圍／混合貼人** | 三模式皆加中文商用句 + closing 含「構圖商用」 | 同左 |
| **禁止** | 描述後再 append 英文 framing；hybrid lead 重複 framing；依原圖清晰省略中文句 | 同左 |

**關鍵檔案：**

- `lib/promo-portrait-styling.js` — `buildPortraitReferenceCommercialFramingGeminiLine`（僅 reference）、`buildPortraitCommercialFramingMoodLine`、`buildPortraitCommercialFramingClearGeminiLine`
- `lib/promo-space-gemini.js` — `buildPromoPortraitGeminiPrompt`：clearFraming 在 `origUserPrompt` **之前**，無尾端 append

### 2. 先前已上線、本輪未改

| Commit | 內容 | 狀態 |
|---|---|---|
| `7fa721d` | 移除 `121d90f` 描述後 duplicate append | ✅ 保留 |
| `a2b719e` | 放寬描述**潤飾**標準（攔截門檻不變） | ✅ 保留於 `server.js` |
| `78bec40` | 首頁「我的收藏」不被 media wall 覆寫 | ✅ 已完成，勿再改 |

### 3. 使用者政策（必守）

1. 首次、空描述：姿勢依場景（`portrait_formal_id` 除外）
2. **不要** Gemini 400 自動 retry 換模式（`35316b8` 已移除）
3. **不要** retry 時自動切依場景
4. `@matchdo.cc`：仍跑 auto-polish；skip block/throttle；log `[internal_bypass]`

## 待你驗證（部署後）

1. **依原圖 + 空描述** — 清晰模式能否出圖（先前易 block 的參考圖）
2. **依原圖 + 有描述** — prompt 須含中文「構圖預設商用…」且在描述前；不得再出現 `erotic/suggestive`
3. **依場景 / 依描述 + 有描述** — 中文商用句在描述前
4. **氛圍／混合** — 貼人後構圖仍商用

## 部署

push `main` 後 Cloud Shell：

```bash
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
```

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && ( gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest ) 2>&1 | grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'
```

## 若仍 block — 排查方向（勿先重做已完成項）

1. 用管理員／`@matchdo.cc` 看實際送出的 prompt：依原圖清晰是否含中文「構圖預設商用」；是否仍有 `erotic/suggestive`
2. 確認線上已部署本輪修正，而非停在 `686e77a`
3. **勿**恢復 `121d90f` 尾端 append 或 `5120ec6` scene/prompt 英文 lead
4. **勿**加 block retry 或自動切依場景
5. 若僅特定參考圖：可能是圖本身 moderation — 記錄 `api_blocked` 事件後再議

## 相關文件

- 三模式基準：`docs/PROGRESS-promo-portrait-modes-baseline-2026-08-25.md`
- 攝影 App 隔離：`.cursor/rules/promo-camera-app-isolation.mdc`（Store 實驗勿改 L3 PWA）
- FLUX／Gemini 提示詞政策：`docs/flux-and-gemini-prompt-policy.md`
