# Embed Simulator 前端測試指南

> **Build**: 2026-06-27  
> **狀態**: Phase C 前端完成，Phase B 後端 API 待實作

---

## 測試方式

### 1. 本機測試（假資料模式）

啟動 server 後，打開瀏覽器訪問：

```
http://localhost:8080/embed/preview-simulator.html
```

**測試內容**：
- ✅ 單欄 Accordion 佈局（桌機 640px 置中、手機 100% 寬）
- ✅ 4 款假產品卡片（2×2 grid）
- ✅ 選擇原型後載入假材料（3 種）+ 假配件（3 種）
- ✅ 假工藝選項（刺繡、絲印、燙金、雷射）
- ✅ Prompt 輸入
- ✅ 生成按鈕 → 3 秒模擬延遲 → 顯示假成圖
- ✅ 再生成 + 下載按鈕

### 2. 直接測試頁面

如果只想測試 UI（不透過 iframe），可以直接訪問：

```
http://localhost:8080/embed/simulator.html?mock=1
```

參數說明：
- `?mock=1`：使用假資料，不呼叫後端 API
- `?embed_id=xxx&sig=yyy`：真實模式（需要 Phase B 後端）

---

## UI 檢查項目

### 佈局
- [ ] 桌機：容器 640px 置中，左右有留白
- [ ] 手機：容器 100% 寬，無橫向捲軸
- [ ] Header 黏在頂部（sticky）
- [ ] Powered by Matchdo 連結可點

### Step 1（選款式）
- [ ] 預設展開
- [ ] 2×2 grid（桌機手機相同）
- [ ] Hover 有提升效果
- [ ] 點擊後卡片有 selected 樣式（藍框 + 陰影）
- [ ] 選完後 Step 1 自動收起（若有多款）
- [ ] 摘要顯示「已選：XXX」

### Step 2（材料與配件）
- [ ] 選完原型後才顯示
- [ ] 預設展開
- [ ] 材料 3×3 grid（單選）
- [ ] 配件 3×3 grid（可複選）
- [ ] 選中有打勾圖示
- [ ] 摘要顯示「已選 X 項」

### Step 3（工藝）
- [ ] 有工藝時才顯示
- [ ] Checkbox 可勾選
- [ ] 摘要顯示「已選 X 項」

### Step 4（描述）
- [ ] 預設展開
- [ ] Textarea 可輸入
- [ ] 提示文字顯示

### Step 5（生成）
- [ ] 固定展開
- [ ] 按鈕 hover 有效果
- [ ] 生成中按鈕 disabled
- [ ] 顯示 spinner + 文字

### 結果區
- [ ] 生成前不顯示
- [ ] 生成後自動捲動到結果區
- [ ] 成圖正確縮放（不超出 640px 容器）
- [ ] 再生成按鈕可點
- [ ] 下載按鈕可點（右鍵另存）

### RWD
- [ ] 桌機（≥768px）：容器置中
- [ ] 平板（768px～1024px）：容器置中
- [ ] 手機（<768px）：容器撐滿

---

## 已知限制（Mock 模式）

以下功能在 Mock 模式無法測試，需要 Phase B 後端完成：

1. **真實廠商資料**（目前假 Logo + 假廠商名）
2. **真實原型圖片**（目前 placeholder）
3. **真實材配關聯**（目前寫死 3 材料 + 3 配件）
4. **真實 FLUX 生成**（目前假圖 + 3 秒延遲）
5. **限流檢查**（無法測試 429 錯誤）
6. **額度扣除**（無法測試點數不足）
7. **簽名驗證**（無法測試簽名錯誤）

---

## 檔案結構

```
public/
├─ embed/
│  ├─ simulator.html              (主頁面，200 行)
│  └─ preview-simulator.html      (測試包裝頁)
└─ js/
   └─ embed-simulator.js          (邏輯，350 行)

server.js
└─ L7130-7131: 新增 2 個 embed 路由
```

---

## 下一步（Phase B）

前端完成後，接續實作後端：

1. **Phase A**: DB schema（3 個新表 + payment_config key）
2. **Phase B1**: `/api/embed/simulator/bootstrap`、`/link-tree`、`/capabilities`
3. **Phase B2**: `/api/embed/simulator/generate`（HMAC 簽名、限流、扣點、FLUX）

實作順序：A → B1 → B2 → 前後端串接測試

---

**最後更新**：2026-06-27  
**搭配文件**：
- [`PROGRESS-vendor-embed-simulator.md`](PROGRESS-vendor-embed-simulator.md)（完整規格）
- [`embed-simulator-ui-implementation.md`](embed-simulator-ui-implementation.md)（UI 設計指南）
