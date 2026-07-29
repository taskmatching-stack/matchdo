# custom-product.html iOS APP 極簡風格改善

## 改善日期
2026-07-30 00:23

## 問題
初版 Apple 風格改善不夠徹底：
1. 按鈕漸變效果沒質感
2. 參考圖框線亂七八糟
3. 參考圖標籤一堆框線
4. 不夠簡潔

## 解決方案：iOS APP 極簡風格

### 核心設計原則
1. **零框線**：所有 `border` 用 `!important` 強制移除
2. **扁平化**：按鈕純色，hover 只改 opacity
3. **iOS 色系**：
   - 背景：`#f2f2f7`（iOS 灰）
   - 按鈕：`#007aff`（iOS 藍）
   - 成功：`#34c759`（iOS 綠）
4. **極簡陰影**：只用 `0 1px 3px rgba(0,0,0,.05)`
5. **大圓角**：統一 10-16px
6. **純背景分層**：不用框線，只用背景色差異

### 具體改變

#### 1. 按鈕（扁平化）
```css
/* 主按鈕：iOS 藍、零陰影 */
background: #007aff;
border-radius: 12px;
box-shadow: none;
/* hover 只改透明度 */
opacity: 0.8;
```

#### 2. 參考圖 Tab（分段控制器）
```css
/* 背景：iOS 灰 */
background: #f2f2f7;
/* 活動項：白色卡片 */
active: #fff + 極淡陰影
/* 零框線 */
border: none !important;
```

#### 3. 參考圖縮圖（零框線）
```css
/* 灰色背景、無框線、無陰影 */
background: #f2f2f7;
border: none;
box-shadow: none;
/* hover 只改透明度 */
opacity: 0.7;
```

#### 4. 標籤 Badge（純色）
```css
/* 成功：iOS 綠 */
background: #34c759;
color: #fff;
border: none;
```

#### 5. 強制覆蓋策略
```css
/* 全域移除框線 */
#custom-product *,
#custom-product *::before,
#custom-product *::after {
    border-color: transparent !important;
}
```

### iOS vs Apple Web 對比

| 元素 | Apple Web（初版） | iOS APP（現版） |
|------|------------------|----------------|
| 按鈕 | 漸變 + 陰影 + 上浮 | 純色 + opacity |
| 框線 | 部分保留 | 完全移除 |
| 陰影 | 多層次 | 極簡（0-1px） |
| 圓角 | 14-20px | 10-16px |
| 互動 | transform | opacity only |

## 文件位置
- **CSS**：`public/css/custom-product-apple-style.css`
- **引入**：`custom-product.html` 第 73 行

## 設計檢查清單
- ✅ 零框線（100% 移除）
- ✅ 扁平化按鈕（無漸變）
- ✅ iOS 色系（#f2f2f7 / #007aff / #34c759）
- ✅ 極簡陰影（0-1px blur）
- ✅ 純背景分層（不用線條）
- ✅ opacity 互動（不用 transform）
- ✅ 統一圓角（10-16px）

## 手機版
- 背景改白色（避免雙層灰）
- 間距再縮小
- 零框線保持

## 預期效果
- 極簡、扁平、呼吸感
- 類 iOS 設定頁面風格
- 零視覺噪音
- 專注內容本身

## 回滾
若仍有問題，可：
1. 檢查 CSS 載入順序（確保最後載入）
2. 清除瀏覽器快取
3. 移除引入還原原樣式
