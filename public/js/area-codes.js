/**
 * area-codes.js — 全站服務地區集中管理
 *
 * 結構（v2）：
 *   台灣 → 縣市（葉節點，按北中南東離島分組顯示）
 *   海外國家 → 州/地區 → 城市（最多三層）
 *
 * 前台第一層：台灣 和 海外國家 同級
 * 資料從 /api/service-areas 讀取；失敗時使用靜態 fallback
 */

(function (global) {

    // ── 靜態 fallback 資料（API 不可用時使用）──
    // countries[]: 頂層，台灣 + 海外國家同級
    // taiwan_groups[]: 台灣縣市按大區分組（北部/中部/南部/東部/離島）
    var COUNTRIES = [
        {
            code: 'TW', zh: '台灣', en: 'Taiwan', type: 'country',
            children: [
                { code: 'TW-TPE', zh: '臺北', en: 'Taipei',       type: 'tw_city', group_code: 'TW-N' },
                { code: 'TW-NWT', zh: '新北', en: 'New Taipei',    type: 'tw_city', group_code: 'TW-N' },
                { code: 'TW-KEE', zh: '基隆', en: 'Keelung',       type: 'tw_city', group_code: 'TW-N' },
                { code: 'TW-TAO', zh: '桃園', en: 'Taoyuan',       type: 'tw_city', group_code: 'TW-N' },
                { code: 'TW-HSQ', zh: '新竹縣', en: 'Hsinchu County', type: 'tw_city', group_code: 'TW-N' },
                { code: 'TW-HSZ', zh: '新竹市', en: 'Hsinchu City',   type: 'tw_city', group_code: 'TW-N' },
                { code: 'TW-ILA', zh: '宜蘭', en: 'Yilan',         type: 'tw_city', group_code: 'TW-N' },
                { code: 'TW-TXG', zh: '臺中', en: 'Taichung',      type: 'tw_city', group_code: 'TW-C' },
                { code: 'TW-MIA', zh: '苗栗', en: 'Miaoli',        type: 'tw_city', group_code: 'TW-C' },
                { code: 'TW-CHA', zh: '彰化', en: 'Changhua',      type: 'tw_city', group_code: 'TW-C' },
                { code: 'TW-NAN', zh: '南投', en: 'Nantou',        type: 'tw_city', group_code: 'TW-C' },
                { code: 'TW-YUN', zh: '雲林', en: 'Yunlin',        type: 'tw_city', group_code: 'TW-C' },
                { code: 'TW-KHH', zh: '高雄', en: 'Kaohsiung',     type: 'tw_city', group_code: 'TW-S' },
                { code: 'TW-TNN', zh: '臺南', en: 'Tainan',        type: 'tw_city', group_code: 'TW-S' },
                { code: 'TW-CYI', zh: '嘉義縣', en: 'Chiayi County', type: 'tw_city', group_code: 'TW-S' },
                { code: 'TW-CYQ', zh: '嘉義市', en: 'Chiayi City',   type: 'tw_city', group_code: 'TW-S' },
                { code: 'TW-PIF', zh: '屏東', en: 'Pingtung',      type: 'tw_city', group_code: 'TW-S' },
                { code: 'TW-PEH', zh: '澎湖', en: 'Penghu',        type: 'tw_city', group_code: 'TW-S' },
                { code: 'TW-HUA', zh: '花蓮', en: 'Hualien',       type: 'tw_city', group_code: 'TW-E' },
                { code: 'TW-TTT', zh: '臺東', en: 'Taitung',       type: 'tw_city', group_code: 'TW-E' },
                { code: 'TW-KIN', zh: '金門', en: 'Kinmen',        type: 'tw_city', group_code: 'TW-O' },
                { code: 'TW-LIE', zh: '連江', en: 'Lienchiang',    type: 'tw_city', group_code: 'TW-O' }
            ]
        },
        { code: 'JP', zh: '日本',    en: 'Japan',        type: 'country' },
        { code: 'KR', zh: '南韓',    en: 'South Korea',  type: 'country' },
        { code: 'SG', zh: '新加坡',  en: 'Singapore',    type: 'country' },
        { code: 'HK', zh: '香港',    en: 'Hong Kong',    type: 'country' },
        { code: 'MY', zh: '馬來西亞', en: 'Malaysia',    type: 'country' },
        { code: 'TH', zh: '泰國',    en: 'Thailand',     type: 'country' },
        { code: 'VN', zh: '越南',    en: 'Vietnam',      type: 'country' },
        { code: 'PH', zh: '菲律賓',  en: 'Philippines',  type: 'country' },
        { code: 'ID', zh: '印尼',    en: 'Indonesia',    type: 'country' },
        { code: 'AU', zh: '澳洲',    en: 'Australia',    type: 'country' },
        { code: 'NZ', zh: '紐西蘭',  en: 'New Zealand',  type: 'country' },
        { code: 'US', zh: '美國',    en: 'USA',          type: 'country' },
        { code: 'CA', zh: '加拿大',  en: 'Canada',       type: 'country' },
        { code: 'GB', zh: '英國',    en: 'UK',           type: 'country' },
        { code: 'DE', zh: '德國',    en: 'Germany',      type: 'country' },
        { code: 'FR', zh: '法國',    en: 'France',       type: 'country' },
        { code: 'NL', zh: '荷蘭',    en: 'Netherlands',  type: 'country' },
        { code: 'AE', zh: '阿聯酋',  en: 'UAE',          type: 'country' },
        { code: 'OTHER', zh: '其他海外', en: 'Other',    type: 'country' }
    ];

    var TW_GROUP_META = {
        'TW-N': { zh: '北部', en: 'North' },
        'TW-C': { zh: '中部', en: 'Central' },
        'TW-S': { zh: '南部', en: 'South' },
        'TW-E': { zh: '東部', en: 'East' },
        'TW-O': { zh: '離島', en: 'Outlying Islands' }
    };

    // ── code → {zh, en} 快查 map ──
    var _codeMap = {};

    function buildCodeMap() {
        _codeMap = {};
        COUNTRIES.forEach(function (c) {
            _codeMap[c.code] = { zh: c.zh, en: c.en };
            (c.children || []).forEach(function (ch) {
                _codeMap[ch.code] = { zh: ch.zh, en: ch.en };
                (ch.children || []).forEach(function (ct) {
                    _codeMap[ct.code] = { zh: ct.zh, en: ct.en };
                });
            });
        });
    }
    buildCodeMap();

    function getLabel(code, lang) {
        var e = _codeMap[code];
        if (!e) return code;
        return (lang === 'en' ? e.en : e.zh) || code;
    }

    function getCodes(codes, lang) {
        return (codes || []).map(function (c) { return getLabel(c, lang); });
    }

    function zhToCode(zhText) {
        var text = (zhText || '').trim().replace(/^台/, '臺');
        for (var code in _codeMap) {
            if (_codeMap[code].zh === text) return code;
        }
        return zhText.trim();
    }

    /** 舊版相容：從 countries 生成 groups 格式 */
    function buildGroups() {
        var twNode = COUNTRIES.find(function (c) { return c.code === 'TW'; });
        var groups = [];
        // 台灣縣市按大區分組
        var TW_ORDER = ['TW-N', 'TW-C', 'TW-S', 'TW-E', 'TW-O'];
        var twGrouped = {};
        if (twNode) {
            (twNode.children || []).forEach(function (ch) {
                var gk = ch.group_code;
                if (!gk) return;
                if (!twGrouped[gk]) {
                    var m = TW_GROUP_META[gk] || { zh: gk, en: gk };
                    twGrouped[gk] = { code: gk, zh: m.zh, en: m.en, cities: [] };
                }
                twGrouped[gk].cities.push({ code: ch.code, zh: ch.zh, en: ch.en });
            });
            TW_ORDER.forEach(function (k) { if (twGrouped[k]) groups.push(twGrouped[k]); });
        }
        // 海外國家
        var overseas = { code: 'OVERSEAS', zh: '海外', en: 'Overseas', cities: [] };
        COUNTRIES.filter(function (c) { return c.code !== 'TW'; }).forEach(function (c) {
            var node = { code: c.code, zh: c.zh, en: c.en };
            if (c.children && c.children.length) {
                node.cities = c.children.map(function (s) {
                    var sn = { code: s.code, zh: s.zh, en: s.en };
                    if (s.children && s.children.length) sn.cities = s.children.map(function (ct) { return { code: ct.code, zh: ct.zh, en: ct.en }; });
                    return sn;
                });
            }
            overseas.cities.push(node);
        });
        if (overseas.cities.length) groups.push(overseas);
        return groups;
    }

    global.AreaCodes = {
        countries: COUNTRIES,             // 新版：台灣+海外國家同級頂層
        twGroupMeta: TW_GROUP_META,       // 台灣大區中英文
        get groups() { return buildGroups(); }, // 舊版相容
        getLabel: getLabel,
        getCodes: getCodes,
        zhToCode: zhToCode,
        _rebuildMap: buildCodeMap
    };

    // ── 從 API 載入最新資料 ──
    if (typeof fetch !== 'undefined') {
        fetch('/api/service-areas')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (json) {
                if (!json || !json.countries || !json.countries.length) return;
                COUNTRIES = json.countries;
                global.AreaCodes.countries = COUNTRIES;
                buildCodeMap();
                document.dispatchEvent(new CustomEvent('areacodes:updated'));
            })
            .catch(function () { /* 靜默降級 */ });
    }

})(window);
