/**
 * area-codes.js — 全站服務地區集中管理
 *
 * ── 如何新增地區 ──────────────────────────────────────────
 * 1. 在對應 group 的 cities 陣列新增一筆 { code, zh, en }
 * 2. 若需要新大區，在 AREA_GROUPS 新增一個 group 物件
 * 3. 儲存後所有頁面（vendors / vendor-profile / contact-info）自動套用
 * ──────────────────────────────────────────────────────────
 *
 * code 規則：
 *   台灣城市 → ISO 3166-2:TW，例如 TW-TPE
 *   海外國家 → ISO 3166-1 alpha-2，例如 JP / US / SG
 *   特殊值   → OVERSEAS（泛海外）
 */

(function (global) {

    /** @type {Array<{code:string, zh:string, en:string, cities:Array<{code:string,zh:string,en:string}>}>} */
    var AREA_GROUPS = [
        {
            code: 'TW-N',
            zh: '北部',
            en: 'North Taiwan',
            cities: [
                { code: 'TW-TPE', zh: '臺北', en: 'Taipei' },
                { code: 'TW-NWT', zh: '新北', en: 'New Taipei' },
                { code: 'TW-KEE', zh: '基隆', en: 'Keelung' },
                { code: 'TW-TAO', zh: '桃園', en: 'Taoyuan' },
                { code: 'TW-HSQ', zh: '新竹縣', en: 'Hsinchu County' },
                { code: 'TW-HSZ', zh: '新竹市', en: 'Hsinchu City' },
                { code: 'TW-ILA', zh: '宜蘭', en: 'Yilan' }
            ]
        },
        {
            code: 'TW-C',
            zh: '中部',
            en: 'Central Taiwan',
            cities: [
                { code: 'TW-TXG', zh: '臺中', en: 'Taichung' },
                { code: 'TW-MIA', zh: '苗栗', en: 'Miaoli' },
                { code: 'TW-CHA', zh: '彰化', en: 'Changhua' },
                { code: 'TW-NAN', zh: '南投', en: 'Nantou' },
                { code: 'TW-YUN', zh: '雲林', en: 'Yunlin' }
            ]
        },
        {
            code: 'TW-S',
            zh: '南部',
            en: 'South Taiwan',
            cities: [
                { code: 'TW-KHH', zh: '高雄', en: 'Kaohsiung' },
                { code: 'TW-TNN', zh: '臺南', en: 'Tainan' },
                { code: 'TW-CYI', zh: '嘉義縣', en: 'Chiayi County' },
                { code: 'TW-CYQ', zh: '嘉義市', en: 'Chiayi City' },
                { code: 'TW-PIF', zh: '屏東', en: 'Pingtung' },
                { code: 'TW-PEH', zh: '澎湖', en: 'Penghu' }
            ]
        },
        {
            code: 'TW-E',
            zh: '東部',
            en: 'East Taiwan',
            cities: [
                { code: 'TW-HUA', zh: '花蓮', en: 'Hualien' },
                { code: 'TW-TTT', zh: '臺東', en: 'Taitung' }
            ]
        },
        {
            code: 'TW-O',
            zh: '離島',
            en: 'Outlying Islands',
            cities: [
                { code: 'TW-KIN', zh: '金門', en: 'Kinmen' },
                { code: 'TW-LIE', zh: '連江', en: 'Lienchiang' }
            ]
        },
        {
            code: 'OVERSEAS',
            zh: '海外',
            en: 'Overseas',
            cities: [
                /* ── 新增海外國家：在此加入 { code, zh, en } 即可 ── */
                { code: 'JP', zh: '日本', en: 'Japan' },
                { code: 'KR', zh: '南韓', en: 'South Korea' },
                { code: 'SG', zh: '新加坡', en: 'Singapore' },
                { code: 'HK', zh: '香港', en: 'Hong Kong' },
                { code: 'MY', zh: '馬來西亞', en: 'Malaysia' },
                { code: 'TH', zh: '泰國', en: 'Thailand' },
                { code: 'VN', zh: '越南', en: 'Vietnam' },
                { code: 'PH', zh: '菲律賓', en: 'Philippines' },
                { code: 'ID', zh: '印尼', en: 'Indonesia' },
                { code: 'AU', zh: '澳洲', en: 'Australia' },
                { code: 'NZ', zh: '紐西蘭', en: 'New Zealand' },
                { code: 'US', zh: '美國', en: 'USA' },
                { code: 'CA', zh: '加拿大', en: 'Canada' },
                { code: 'GB', zh: '英國', en: 'UK' },
                { code: 'DE', zh: '德國', en: 'Germany' },
                { code: 'FR', zh: '法國', en: 'France' },
                { code: 'NL', zh: '荷蘭', en: 'Netherlands' },
                { code: 'AE', zh: '阿聯酋', en: 'UAE' },
                { code: 'OTHER', zh: '其他海外', en: 'Other' }
            ]
        }
    ];

    // ── 快速查詢 map：code → { zh, en } ──
    var _codeMap = {};
    AREA_GROUPS.forEach(function (g) {
        _codeMap[g.code] = { zh: g.zh, en: g.en };
        (g.cities || []).forEach(function (c) {
            _codeMap[c.code] = { zh: c.zh, en: c.en };
        });
    });

    /**
     * 取得地區顯示名稱
     * @param {string} code   - 地區碼，例如 'TW-TPE' / 'JP'
     * @param {string} [lang] - 'zh'（預設）或 'en'
     * @returns {string}
     */
    function getLabel(code, lang) {
        var entry = _codeMap[code];
        if (!entry) return code;
        return (lang === 'en' ? entry.en : entry.zh) || code;
    }

    /**
     * 將 code 陣列轉為顯示名稱陣列
     * @param {string[]} codes
     * @param {string}   [lang]
     * @returns {string[]}
     */
    function getCodes(codes, lang) {
        return (codes || []).map(function (c) { return getLabel(c, lang); });
    }

    /**
     * 將舊版中文字串嘗試對應到 code（遷移用）
     * 例如 "台北" → "TW-TPE"，"海外" → "OVERSEAS"
     * @param {string} zhText
     * @returns {string} code or original text
     */
    function zhToCode(zhText) {
        var text = (zhText || '').trim();
        // 特殊相容：台 → 臺
        var normalized = text.replace(/^台/, '臺');
        for (var code in _codeMap) {
            if (_codeMap[code].zh === normalized || _codeMap[code].zh === text) return code;
        }
        return text; // 找不到就原文保留
    }

    global.AreaCodes = {
        groups: AREA_GROUPS,
        getLabel: getLabel,
        getCodes: getCodes,
        zhToCode: zhToCode
    };

})(window);
