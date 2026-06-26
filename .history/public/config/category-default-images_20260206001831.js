/**
 * 分類預設封面圖片配置
 * 為每個子分類提供精美的預設圖片
 */

const CategoryDefaultImages = {
    // 居家裝修類
    '室內設計': '/img/categories/interior-design.jpg',
    '裝潢統包': '/img/categories/renovation.jpg',
    '木工': '/img/categories/carpentry.jpg',
    '水電': '/img/categories/plumbing.jpg',
    '油漆': '/img/categories/painting.jpg',
    '泥作': '/img/categories/masonry.jpg',
    '鐵工': '/img/categories/ironwork.jpg',
    '玻璃': '/img/categories/glass.jpg',
    '窗簾': '/img/categories/curtain.jpg',
    '地板': '/img/categories/flooring.jpg',
    '天花板': '/img/categories/ceiling.jpg',
    '衛浴': '/img/categories/bathroom.jpg',
    '廚具': '/img/categories/kitchen.jpg',
    '系統櫃': '/img/categories/cabinet.jpg',
    
    // 設計類
    'Logo設計': '/img/categories/logo-design.jpg',
    '平面設計': '/img/categories/graphic-design.jpg',
    '包裝設計': '/img/categories/package-design.jpg',
    '名片設計': '/img/categories/business-card.jpg',
    '海報設計': '/img/categories/poster-design.jpg',
    '品牌設計': '/img/categories/brand-design.jpg',
    '插畫': '/img/categories/illustration.jpg',
    '3D設計': '/img/categories/3d-design.jpg',
    
    // 建築類
    '建築設計': '/img/categories/architecture.jpg',
    '景觀設計': '/img/categories/landscape.jpg',
    '土木工程': '/img/categories/civil-engineering.jpg',
    '結構設計': '/img/categories/structure.jpg',
    
    // 家具類
    '客製化家具': '/img/categories/custom-furniture.jpg',
    '實木家具': '/img/categories/wood-furniture.jpg',
    '辦公家具': '/img/categories/office-furniture.jpg',
    '戶外家具': '/img/categories/outdoor-furniture.jpg',
    
    // 行銷類
    '網站建置': '/img/categories/web-design.jpg',
    '影片製作': '/img/categories/video-production.jpg',
    '攝影': '/img/categories/photography.jpg',
    '行銷企劃': '/img/categories/marketing.jpg',
    'SEO': '/img/categories/seo.jpg',
    '社群經營': '/iStudio-1.0.0/img/categories/social-media.jpg',
    
    // 預設圖（當找不到對應分類時）
    'default': '/iStudio-1.0.0/img/categories/default-project.svg'
};

/**
 * 取得分類的預設封面圖片
 * @param {string} category - 分類名稱
 * @returns {string} 圖片 URL
 */
function getCategoryDefaultImage(category) {
    // 嘗試找到完全匹配的分類
    if (CategoryDefaultImages[category]) {
        return CategoryDefaultImages[category];
    }
    
    // 嘗試找到部分匹配的分類（模糊搜尋）
    const matchedKey = Object.keys(CategoryDefaultImages).find(key => 
        category && category.includes(key)
    );
    
    if (matchedKey) {
        return CategoryDefaultImages[matchedKey];
    }
    
    // 如果都找不到，返回預設圖
    return CategoryDefaultImages.default;
}

/**
 * 取得專案的封面圖片 URL
 * @param {Object} project - 專案物件
 * @returns {string} 圖片 URL
 */
function getProjectCoverImage(project) {
    if (!project) {
        return CategoryDefaultImages.default;
    }
    
    // 1. 如果有使用者上傳的圖片
    if (project.cover_image_type === 'uploaded' && project.cover_image_url) {
        return project.cover_image_url;
    }
    
    // 2. 如果有 AI 生成的圖片
    if (project.cover_image_type === 'ai_generated' && project.cover_image_url) {
        return project.cover_image_url;
    }
    
    // 3. 使用分類預設圖
    const category = project.cover_image_category || project.category;
    return getCategoryDefaultImage(category);
}

// 匯出給其他檔案使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CategoryDefaultImages,
        getCategoryDefaultImage,
        getProjectCoverImage
    };
}
