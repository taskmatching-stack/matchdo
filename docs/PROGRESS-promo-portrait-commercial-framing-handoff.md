# 人像商用構圖防護 — 交接（2026-09-12）

**接續開發從此看。** 新視窗請先讀本檔。

## 鎖定（使用者 2026-09-12 定案）

**可正常出圖：** 拿掉道具的前一版（`e2e400e`）已可出圖；拿掉道具並取消再送出（`35316b8`）只是整理，前後都應能出。  
後面 `5120ec6`、`121d90f`、`686e77a`、`fd18496` 都是另造結構，已失敗，**不要再改 prompt 組裝。**

| 項目 | 值 |
|---|---|
| **鎖定 commit** | `35316b8` — `refactor(promo): focus reference portrait on commercial framing, drop block retry` |
| **首次加入用詞** | `e2e400e`（你說「可以了」）；`35316b8` 是整理掉無效姿勢／道具句 + **取消再送出** |
| **本輪** | 把清晰人像 prompt 組裝還原成 `35316b8`，不再疊中文／刪英文用詞 |

## 35316b8 怎麼寫（有描述也有這句）

清晰 Gemini **依原圖**：商用構圖寫在 **lead 開頭**（鎖服裝段內），**有沒有填描述都會在**。描述只接在後面，不另插、不 append。

```
…Keep the main garment…
Commercial lifestyle portrait only: tasteful framing and a non-sexualized mood.
Do not copy erotic or suggestive composition from reference image 1;
reframe as a clean brand-safe portrait while keeping the same garment.
User description may adjust hairstyle, expression, and pose—not the main garment.
Shoot theme: …
Styling and details: （有填描述才有這段）
或 Pose follows the shoot theme…（空描述）
```

- 氛圍／混合貼人：中文「構圖預設商用生活人像，避免情色或過度挑逗感…」
- **不要** Gemini 400 自動再送出、不要自動切依場景
- **不要**在描述後再 append 英文 framing（`121d90f`）
- **不要**給 scene/prompt 英文 lead 加 erotic 詞（`5120ec6`）
- **不要**拿掉 lead 裡的英文商用句、另插一層中文（`fd18496`）

## 部署

push `main` 後 Cloud Shell：

```bash
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
```

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && ( gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest ) 2>&1 | grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'
```
