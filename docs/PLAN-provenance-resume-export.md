# 生圖履歷（Provenance Resume）匯出

> **Baseline commit（凍結參考）：** `ca32d39`（2026-08-07）— 平台統計情境圖分入口 + 表尾總計  
> **Handoff 進度：** `docs/PROGRESS-provenance-resume-export.md`

## 目標

每張 AI 成圖可產生**履歷**（來源、時間、入口、參考、prompt、扣點），支援 **JSON** 與 **PDF** 匯出，供設計者對外展示、平台爭議調查。

## 前後台差異（`audience`）

| | `owner`（我的資產庫） | `admin`（後台） |
|--|--|--|
| 核心履歷 | ✅ 一致 | ✅ 一致 |
| 帳號 email / user_id | ❌ | ✅ |
| `data_lineage_json`、廠商自產標記 | ❌ | ✅ |
| Embed 訪客 IP／session | ❌ | ✅ |
| 私有參考 | 「私有參考（無公開連結）」 | 可含 internal id |

同一 JSON schema v1；admin 多 `_internal` 區塊。

## 統一 schema（export v1）

見實作 `lib/provenance-resume.js` → `buildProvenanceResume()` 回傳結構。

## 分期

| 期 | 範圍 | 狀態 |
|----|------|------|
| **P1** | `user_design` + `promo_scene`；API；PDF；後台生圖紀錄 + 資產庫（設計稿／情境圖） | 進行中 |
| **P2** | `material_combo`、`print`、`embed_visitor`；批量 ZIP；扣點 FK | 待做 |
| **P3** | 衍生鏈 `parent_record`、composed prompt 持久化 | 待做 |

## API

| 方法 | 路徑 | 權限 |
|------|------|------|
| GET | `/api/me/provenance-resume?kind=&id=` | 登入；僅本人 |
| GET | `/api/me/provenance-resume/export.pdf?kind=&id=` | 同上 |
| GET | `/api/admin/provenance-resume?kind=&id=` | admin |
| GET | `/api/admin/provenance-resume/export.pdf?kind=&id=` | admin |

`kind`：`user_design` | `promo_scene` |（P2+）`material_combo` | `print` | `embed_visitor`

## 程式

| 檔 | 用途 |
|----|------|
| `lib/provenance-resume.js` | 查表、組裝 JSON |
| `lib/provenance-resume-pdf.js` | PDF 渲染 |
| `public/js/provenance-resume-ui.js` | 前台／後台共用履歷 modal |
| `server.js` | 路由 |
| `public/admin/generation-records.html` | 詳情 → 履歷／匯出 |
| `public/client/my-custom-products.html` | 設計稿／情境圖卡片 → 履歷 |

## PDF 免責

「本文件為 MatchDO 平台生成紀錄匯出，供創作过程说明，不构成法律鉴定。」
