/**
 * 主產品多圖連動組：同組首次選取一併勾選；可個別取消；跨組混選僅提醒
 */
(function (global) {
    'use strict';

    var COMMON_GROUP = 'common';
    var WARN_SESSION_PREFIX = 'matchdo.linkGroupWarn.';

    function normalizeLinkGroup(raw) {
        if (raw == null) return '';
        return String(raw).trim().slice(0, 48);
    }

    function isActiveLinkGroup(group) {
        var g = normalizeLinkGroup(group);
        return !!g && g !== COMMON_GROUP;
    }

    function linkGroupForUrl(imageItems, url) {
        var u = String(url || '').trim();
        if (!u || !Array.isArray(imageItems)) return '';
        for (var i = 0; i < imageItems.length; i++) {
            var it = imageItems[i];
            if (it && String(it.url || '').trim() === u) {
                if (it.designer_selectable === false) return '';
                return normalizeLinkGroup(it.link_group);
            }
        }
        return '';
    }

    function findImageItem(imageItems, url) {
        var u = String(url || '').trim();
        if (!u || !Array.isArray(imageItems)) return null;
        for (var i = 0; i < imageItems.length; i++) {
            var it = imageItems[i];
            if (it && String(it.url || '').trim() === u) return it;
        }
        return null;
    }

    function isUrlSelected(selectedList, url) {
        var u = String(url || '').trim();
        return (selectedList || []).some(function (s) { return s && s.url === u; });
    }

    /**
     * 點選切換：取消只移除此張；新增時同連動組一次加入（受 maxSelect 限制）
     * @returns {{ selected: object[], action: string, added?: string[], removed?: string, truncated?: boolean, reason?: string, maxSelect?: number }}
     */
    function toggleLinkedPrototypePick(imageItems, selectedList, url, options) {
        options = options || {};
        var maxSelect = options.maxSelect != null ? options.maxSelect : 3;
        var labelForItem = options.labelForItem || function (it) {
            return (it && it.label != null ? String(it.label) : '').trim();
        };
        var warnFn = options.warnFn;
        var list = (selectedList || []).slice();
        var u = String(url || '').trim();
        if (!u) return { selected: list, action: 'noop' };

        var removeIdx = -1;
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].url === u) { removeIdx = i; break; }
        }
        if (removeIdx >= 0) {
            list.splice(removeIdx, 1);
            return { selected: list, action: 'remove', removed: u };
        }

        var group = linkGroupForUrl(imageItems, u);
        var candidates = [];
        if (isActiveLinkGroup(group)) {
            (imageItems || []).forEach(function (it) {
                if (!it || !it.url || isUrlSelected(list, it.url)) return;
                if (it.designer_selectable === false) return;
                if (normalizeLinkGroup(it.link_group) === group) candidates.push(it);
            });
        } else {
            var one = findImageItem(imageItems, u) || { url: u, link_group: group };
            if (one.designer_selectable === false) {
                return { selected: list, action: 'blocked', reason: 'display_only' };
            }
            if (!isUrlSelected(list, u)) candidates.push(one);
        }

        var ordered = [];
        (imageItems || []).forEach(function (it) {
            if (!it || !it.url) return;
            for (var j = 0; j < candidates.length; j++) {
                if (candidates[j].url === it.url) {
                    ordered.push(it);
                    break;
                }
            }
        });
        if (!ordered.length && candidates.length) ordered = candidates.slice();

        var room = maxSelect - list.length;
        if (room <= 0) {
            return { selected: list, action: 'blocked', reason: 'max', maxSelect: maxSelect };
        }

        var added = [];
        for (var k = 0; k < ordered.length; k++) {
            if (room <= 0) break;
            var item = ordered[k];
            if (isUrlSelected(list, item.url)) continue;
            list.push({
                url: item.url,
                label: labelForItem(item),
                link_group: normalizeLinkGroup(item.link_group) || group
            });
            added.push(item.url);
            room -= 1;
        }

        maybeWarnMixedLinkGroups(list, warnFn);

        return {
            selected: list,
            action: 'add',
            added: added,
            truncated: ordered.length > added.length,
            maxSelect: maxSelect
        };
    }

    /** 預設選取：略過僅展示；有連動組則先整組（上限內），否則只取第一張可選圖。 */
    function defaultLinkedSelection(imageItems, maxSelect, labelForItem) {
        maxSelect = maxSelect != null ? maxSelect : 3;
        labelForItem = labelForItem || function (it) {
            return (it && it.label != null ? String(it.label) : '').trim();
        };
        var selectable = (imageItems || []).filter(function (it) {
            return it && it.url && it.designer_selectable !== false;
        });
        if (!selectable.length) return [];

        var firstGroup = '';
        for (var i = 0; i < selectable.length; i++) {
            var g = normalizeLinkGroup(selectable[i].link_group);
            if (isActiveLinkGroup(g)) {
                firstGroup = g;
                break;
            }
        }

        var pick = [];
        if (firstGroup) {
            selectable.forEach(function (it) {
                if (pick.length >= maxSelect || !it || !it.url) return;
                if (normalizeLinkGroup(it.link_group) === firstGroup) {
                    pick.push({
                        url: it.url,
                        label: labelForItem(it),
                        link_group: firstGroup
                    });
                }
            });
        }
        if (!pick.length) {
            var it2 = selectable[0];
            pick.push({
                url: it2.url,
                label: labelForItem(it2),
                link_group: normalizeLinkGroup(it2.link_group)
            });
        }
        return pick;
    }

    /** @param {{url?:string,link_group?:string}[]} selectedItems */
    function checkPrototypeImageLinkGroups(selectedItems) {
        if (!selectedItems || selectedItems.length <= 1) {
            return { warn: false, groups: [] };
        }
        var active = [];
        selectedItems.forEach(function (it) {
            var g = normalizeLinkGroup(it && it.link_group);
            if (!g || g === COMMON_GROUP) return;
            active.push(g);
        });
        if (!active.length) return { warn: false, groups: [] };
        var unique = [];
        active.forEach(function (g) {
            if (unique.indexOf(g) < 0) unique.push(g);
        });
        if (unique.length <= 1) return { warn: false, groups: unique };
        return {
            warn: true,
            groups: unique,
            message: '您選了不同連動組的主產品圖（' + unique.join('、') + '）。混用可能讓 AI 生圖不一致，仍可繼續。'
        };
    }

    function warnSessionKey(selectedItems) {
        var parts = (selectedItems || []).map(function (it) {
            return normalizeLinkGroup(it && it.link_group) + '@' + String(it && it.url || '').trim();
        }).filter(Boolean).sort().join('|');
        return WARN_SESSION_PREFIX + parts;
    }

    function maybeWarnMixedLinkGroups(selectedItems, warnFn) {
        var result = checkPrototypeImageLinkGroups(selectedItems);
        if (!result.warn || !result.message) return result;
        var key = warnSessionKey(selectedItems);
        try {
            if (sessionStorage.getItem(key) === '1') return result;
            sessionStorage.setItem(key, '1');
        } catch (e) { /* ignore */ }
        var fn = warnFn || function (msg) { alert(msg); };
        fn(result.message);
        return result;
    }

    global.MatchdoImageLinkGroups = {
        COMMON_GROUP: COMMON_GROUP,
        normalizeLinkGroup: normalizeLinkGroup,
        isActiveLinkGroup: isActiveLinkGroup,
        linkGroupForUrl: linkGroupForUrl,
        toggleLinkedPrototypePick: toggleLinkedPrototypePick,
        defaultLinkedSelection: defaultLinkedSelection,
        checkPrototypeImageLinkGroups: checkPrototypeImageLinkGroups,
        maybeWarnMixedLinkGroups: maybeWarnMixedLinkGroups
    };
})(typeof window !== 'undefined' ? window : this);

