/**
 * 全站簡易圖片放大 lightbox（無 Bootstrap 依賴）
 * MatchdoImageLightbox.open({ src, caption, alt })
 */
(function (global) {
    'use strict';

    var root = null;
    var imgEl = null;
    var capEl = null;
    var prevOverflow = '';

    function ensureRoot() {
        if (root) return root;
        root = document.createElement('div');
        root.id = 'matchdo-image-lightbox';
        root.className = 'matchdo-image-lightbox';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div class="matchdo-image-lightbox-backdrop" data-close="1"></div>' +
            '<div class="matchdo-image-lightbox-panel">' +
            '<button type="button" class="matchdo-image-lightbox-close" aria-label="關閉" data-close="1">&times;</button>' +
            '<img src="" alt="">' +
            '<p class="matchdo-image-lightbox-caption"></p>' +
            '</div>';
        document.body.appendChild(root);
        imgEl = root.querySelector('img');
        capEl = root.querySelector('.matchdo-image-lightbox-caption');
        root.querySelectorAll('[data-close]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                close();
            });
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && root && root.classList.contains('is-open')) close();
        });
        return root;
    }

    function stackZIndexAboveModals() {
        var top = 1040;
        document.querySelectorAll('.modal.show, .modal-backdrop.show').forEach(function (el) {
            var zi = parseInt(window.getComputedStyle(el).zIndex, 10);
            if (!isNaN(zi) && zi > top) top = zi;
        });
        return Math.max(10060, top + 20);
    }

    function open(opts) {
        opts = opts || {};
        var src = (opts.src || '').trim();
        if (!src) return;
        ensureRoot();
        root.style.zIndex = String(stackZIndexAboveModals());
        imgEl.src = src;
        imgEl.alt = opts.alt || opts.caption || '';
        capEl.textContent = opts.caption || '';
        root.classList.add('is-open');
        root.setAttribute('aria-hidden', 'false');
        prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }

    function close() {
        if (!root) return;
        root.classList.remove('is-open');
        root.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = prevOverflow || '';
        if (imgEl) imgEl.src = '';
        if (capEl) capEl.textContent = '';
    }

    function openFromImg(img, caption) {
        if (!img || !img.src) return;
        open({ src: img.src, caption: caption || img.alt || '', alt: img.alt || '' });
    }

    function captionFromImg(img) {
        if (!img) return '';
        var card = img.closest('.material-card, .portfolio-card, .card');
        if (card) {
            var t = card.querySelector('.fw-semibold');
            if (t) return t.textContent.trim();
        }
        return img.getAttribute('title') || img.alt || '';
    }

    function bindDelegatedClicks() {
        document.addEventListener('click', function (e) {
            var img = e.target.closest('img.matchdo-enlarge-trigger, img.js-preview-enlarge');
            if (!img || !img.src) return;
            if (/placehold\.co/i.test(img.src)) return;
            e.preventDefault();
            e.stopPropagation();
            openFromImg(img, captionFromImg(img));
        });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindDelegatedClicks);
        } else {
            bindDelegatedClicks();
        }
    }

    global.MatchdoImageLightbox = { open: open, close: close, openFromImg: openFromImg };
})(typeof window !== 'undefined' ? window : global);
