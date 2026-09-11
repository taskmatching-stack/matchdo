# 人像商用構圖防護 — 交接（2026-09-12）

**接續開發從此看。** 新視窗請先讀本檔。

## 測試基準（使用者定案）

先測 **拿掉道具、取消再送出** 的 `35316b8`，測完再從這版改。  
不要從 `3441e51`／`fd18496`／`121d90f` 那些中間實驗往上疊。

| 項目 | 值 |
|---|---|
| **基準** | `35316b8` — 鎖服裝 + 商用構圖在 **lead 內**；無道具句；無 400 自動再送 |
| **本輪** | 人像 prompt 組裝回到該版（其餘非人像功能如首頁收藏、描述潤飾放寬仍保留） |

依原圖、空描述組裝：

```
Keep the main garment…
Commercial lifestyle portrait only: tasteful framing and a non-sexualized mood.
Do not copy erotic or suggestive composition from reference image 1;
reframe as a clean brand-safe portrait while keeping the same garment.
User description may adjust hairstyle, expression, and pose—not the main garment.
Shoot theme / Scene …
Pose follows the shoot theme…（空描述）
相機參數
```
