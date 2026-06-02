/**
 * 全站簡易圖片放大 lightbox（無 Bootstrap 依賴）
 * MatchdoImageLightbox.open({ src, caption, alt }) 或 open({ images: [...], index: 0, caption })
 */
(function (global) {
    'use strict';

    var root = null;
    var imgEl = null;
    var capEl = null;
    var prevBtn = null;
    var nextBtn = null;
    var counterEl = null;
    var prevOverflow = '';
    var galleryImages = [];
    var galleryLabels = [];
    var galleryIndex = 0;
    var baseCaption = '';

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
            '<button type="button" class="matchdo-image-lightbox-nav matchdo-image-lightbox-prev" aria-label="上一張">&lsaquo;</button>' +
            '<button type="button" class="matchdo-image-lightbox-nav matchdo-image-lightbox-next" aria-label="下一張">&rsaquo;</button>' +
            '<img src="" alt="">' +
            '<p class="matchdo-image-lightbox-counter"></p>' +
            '<p class="matchdo-image-lightbox-caption"></p>' +
            '</div>';
        document.body.appendChild(root);
        imgEl = root.querySelector('img');
        capEl = root.querySelector('.matchdo-image-lightbox-caption');
        counterEl = root.querySelector('.matchdo-image-lightbox-counter');
        prevBtn = root.querySelector('.matchdo-image-lightbox-prev');
        nextBtn = root.querySelector('.matchdo-image-lightbox-next');
        root.querySelectorAll('[data-close]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                close();
            });
        });
        prevBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            showGalleryIndex(galleryIndex - 1);
        });
        nextBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            showGalleryIndex(galleryIndex + 1);
        });
        document.addEventListener('keydown', function (e) {
            if (!root || !root.classList.contains('is-open')) return;
            if (e.key === 'Escape') close();
            if (galleryImages.length > 1 && e.key === 'ArrowLeft') {
                e.preventDefault();
                showGalleryIndex(galleryIndex - 1);
            }
            if (galleryImages.length > 1 && e.key === 'ArrowRight') {
                e.preventDefault();
                showGalleryIndex(galleryIndex + 1);
            }
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

    function updateGalleryChrome() {
        var multi = galleryImages.length > 1;
        if (prevBtn) prevBtn.style.display = multi ? 'flex' : 'none';
        if (nextBtn) nextBtn.style.display = multi ? 'flex' : 'none';
        if (counterEl) {
            counterEl.textContent = multi ? ((galleryIndex + 1) + ' / ' + galleryImages.length) : '';
            counterEl.style.display = multi ? 'block' : 'none';
        }
    }

    function captionForGalleryIndex() {
        var imgLabel = (galleryLabels[galleryIndex] || '').trim();
        var base = (baseCaption || '').trim();
        if (imgLabel && base && imgLabel !== base) return base + ' · ' + imgLabel;
        return imgLabel || base || '';
    }

    function showGalleryIndex(idx) {
        if (!galleryImages.length || !imgEl) return;
        galleryIndex = ((idx % galleryImages.length) + galleryImages.length) % galleryImages.length;
        imgEl.src = galleryImages[galleryIndex];
        updateGalleryChrome();
        if (capEl) {
            capEl.textContent = captionForGalleryIndex();
        }
    }

    function normalizeImageItems(raw) {
        if (!Array.isArray(raw)) return [];
        return raw.map(function (it, i) {
            if (!it) return null;
            if (typeof it === 'string') return { url: it, label: '' };
            var url = (it.url || '').trim();
            if (!url) return null;
            return {
                url: url,
                label: String(it.label != null ? it.label : '').trim()
            };
        }).filter(Boolean);
    }

    function open(opts) {
        opts = opts || {};
        var imageItems = normalizeImageItems(opts.imageItems);
        var images = Array.isArray(opts.images) ? opts.images.filter(function (u) { return u && String(u).trim(); }) : [];
        var src = (opts.src || '').trim();
        if (!images.length && !src && !imageItems.length) return;
        ensureRoot();
        root.style.zIndex = String(stackZIndexAboveModals());
        baseCaption = opts.caption || opts.alt || '';
        if (imageItems.length) {
            galleryImages = imageItems.map(function (it) { return it.url; });
            galleryLabels = imageItems.map(function (it) { return it.label; });
        } else {
            galleryImages = images.length ? images.slice() : (src ? [src] : []);
            galleryLabels = galleryImages.map(function () { return ''; });
        }
        galleryIndex = Math.max(0, Math.min(opts.index || 0, galleryImages.length - 1));
        showGalleryIndex(galleryIndex);
        imgEl.alt = captionForGalleryIndex() || opts.alt || baseCaption || '';
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
        galleryImages = [];
        galleryLabels = [];
        galleryIndex = 0;
        baseCaption = '';
        if (imgEl) imgEl.src = '';
        if (capEl) capEl.textContent = '';
        if (counterEl) counterEl.textContent = '';
        updateGalleryChrome();
    }

    function parseImageItemsFromImg(img) {
        if (!img) return [];
        var rawItems = img.getAttribute('data-image-items');
        if (rawItems) {
            try {
                var parsedItems = JSON.parse(rawItems.replace(/&quot;/g, '"'));
                var items = normalizeImageItems(parsedItems);
                if (items.length) return items;
            } catch (e) { /* ignore */ }
        }
        var urls = parseUrlsFromImg(img);
        return urls.map(function (u, i) {
            return { url: u, label: '' };
        });
    }

    function parseUrlsFromImg(img) {
        if (!img) return [];
        var raw = img.getAttribute('data-image-urls');
        if (raw) {
            try {
                var parsed = JSON.parse(raw.replace(/&quot;/g, '"'));
                if (Array.isArray(parsed) && parsed.length) return parsed.filter(Boolean);
            } catch (e) { /* ignore */ }
        }
        return img.src ? [img.src] : [];
    }

    function urlMatchesGalleryEntry(imgSrc, entry) {
        if (!imgSrc || !entry) return false;
        if (imgSrc === entry) return true;
        try {
            var a = new URL(imgSrc, window.location.origin);
            var b = new URL(entry, window.location.origin);
            return a.pathname === b.pathname;
        } catch (_) {
            return String(imgSrc).split('?')[0] === String(entry).split('?')[0];
        }
    }

    function openFromImg(img, caption) {
        if (!img || !img.src) return;
        var items = parseImageItemsFromImg(img);
        var urls = items.map(function (it) { return it.url; });
        var imgSrc = img.currentSrc || img.src || '';
        var cap = caption || img.getAttribute('data-lightbox-caption') || '';
        if (urls.length > 1) {
            var idx = 0;
            for (var i = 0; i < urls.length; i++) {
                if (urlMatchesGalleryEntry(imgSrc, urls[i])) { idx = i; break; }
            }
            open({ imageItems: items, index: idx, caption: cap, alt: cap });
        } else {
            open({
                imageItems: items.length ? items : [{ url: urls[0] || imgSrc, label: '' }],
                caption: cap,
                alt: cap
            });
        }
    }

    function captionFromImg(img) {
        if (!img) return '';
        var items = parseImageItemsFromImg(img);
        var imgSrc = img.currentSrc || img.src || '';
        var itemLabel = '';
        for (var i = 0; i < items.length; i++) {
            if (urlMatchesGalleryEntry(imgSrc, items[i].url) && items[i].label) {
                itemLabel = items[i].label;
                break;
            }
        }
        if (!itemLabel && items[0] && items[0].label) itemLabel = items[0].label;
        var card = img.closest('.material-card, .portfolio-card, .card, .pending-image-card');
        var title = '';
        if (card) {
            var t = card.querySelector('.fw-semibold');
            if (t) title = t.textContent.trim();
        }
        if (itemLabel && title && itemLabel !== title) return title + ' · ' + itemLabel;
        return itemLabel || title || img.getAttribute('data-lightbox-caption') || img.getAttribute('title') || img.alt || '';
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
