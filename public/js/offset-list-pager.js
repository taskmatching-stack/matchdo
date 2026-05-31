(function (global) {
    function buildPageNumberList(currentPage, pageCount, siblingCount) {
        siblingCount = siblingCount == null ? 1 : siblingCount;
        if (pageCount <= 1) return [];
        var items = [];
        var left = Math.max(1, currentPage - siblingCount);
        var right = Math.min(pageCount, currentPage + siblingCount);
        for (var i = 1; i <= pageCount; i++) {
            if (i === 1 || i === pageCount || (i >= left && i <= right)) {
                items.push(i);
            } else if (items[items.length - 1] !== '…') {
                items.push('…');
            }
        }
        return items;
    }

    /**
     * @param {Object} cfg
     * @param {HTMLElement} cfg.pagerEl
     * @param {HTMLElement} [cfg.prevEl]
     * @param {HTMLElement} [cfg.nextEl]
     * @param {HTMLElement} [cfg.pageNumsEl]
     * @param {HTMLElement} [cfg.infoEl]
     * @param {number} cfg.total
     * @param {number} cfg.offset
     * @param {number} cfg.limit
     * @param {function(number): void} [cfg.onGoToPage] newOffset
     * @param {string} [cfg.pageInfoTemplate] e.g. '第 {page} / {total} 頁'
     */
    function render(cfg) {
        var pager = cfg.pagerEl;
        if (!pager) return;
        var total = cfg.total || 0;
        var offset = cfg.offset || 0;
        var limit = cfg.limit || 12;
        if (!total) {
            pager.classList.add('d-none');
            return;
        }
        var pageCount = Math.max(1, Math.ceil(total / limit));
        if (total <= limit) {
            pager.classList.add('d-none');
            return;
        }
        pager.classList.remove('d-none');
        var currentPage = Math.floor(offset / limit) + 1;
        if (cfg.prevEl) cfg.prevEl.disabled = offset <= 0;
        if (cfg.nextEl) cfg.nextEl.disabled = offset + limit >= total;
        if (cfg.infoEl && cfg.pageInfoTemplate) {
            cfg.infoEl.textContent = String(cfg.pageInfoTemplate)
                .replace('{page}', String(currentPage))
                .replace('{total}', String(pageCount));
        }
        var numsEl = cfg.pageNumsEl;
        if (!numsEl) return;
        numsEl.innerHTML = '';
        var nums = buildPageNumberList(currentPage, pageCount, cfg.siblingCount != null ? cfg.siblingCount : 1);
        nums.forEach(function (n) {
            if (n === '…') {
                var span = document.createElement('span');
                span.className = 'px-1 small text-muted align-self-center';
                span.textContent = '…';
                span.setAttribute('aria-hidden', 'true');
                numsEl.appendChild(span);
                return;
            }
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm ' + (n === currentPage ? 'btn-primary' : 'btn-outline-secondary');
            btn.textContent = String(n);
            btn.setAttribute('data-page', String(n));
            if (n === currentPage) {
                btn.setAttribute('aria-current', 'page');
            }
            btn.addEventListener('click', function () {
                var p = parseInt(btn.getAttribute('data-page'), 10);
                if (!p || p === currentPage) return;
                var newOffset = (p - 1) * limit;
                if (typeof cfg.onGoToPage === 'function') cfg.onGoToPage(newOffset, p);
            });
            numsEl.appendChild(btn);
        });
    }

    global.MatchdoOffsetPager = { render: render, buildPageNumberList: buildPageNumberList };
})(typeof window !== 'undefined' ? window : this);
