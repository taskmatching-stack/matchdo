/**
 * Shared drag-and-drop image upload helper.
 * Usage: MatchdoImageDrop.wire({ zone, multiple, onFiles }) or { zone, input } to trigger change.
 */
(function (global) {
  var STYLE_ID = 'matchdo-image-drop-styles';

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.matchdo-image-drop-zone.is-drag-over {',
      '  outline: 2px dashed #5B6B7C;',
      '  outline-offset: 2px;',
      '  background-color: #EEF2F6;',
      '}',
      '.matchdo-image-drop-zone.is-drag-over input[type=file] { border-color: #5B6B7C; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  function filterImageFiles(fileList, multiple) {
    if (!fileList || !fileList.length) return [];
    var files = [];
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      if (f && f.type && f.type.indexOf('image/') === 0) files.push(f);
    }
    if (multiple === false && files.length > 1) return [files[0]];
    return files;
  }

  function wireImageDropZone(opts) {
    if (!opts || !opts.zone) return false;
    var zone = opts.zone;
    if (zone._matchdoImageDropWired) return false;
    zone._matchdoImageDropWired = true;
    ensureStyles();
    zone.classList.add('matchdo-image-drop-zone');
    var multiple = opts.multiple !== false;
    var activeClass = opts.activeClass || 'is-drag-over';
    var dragDepth = 0;

    function prevent(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    function handleFiles(fileList) {
      var files = filterImageFiles(fileList, multiple);
      if (!files.length) return;
      if (typeof opts.onFiles === 'function') {
        opts.onFiles(multiple ? files : files[0]);
        return;
      }
      var input = opts.input;
      if (!input) return;
      try {
        var dt = new DataTransfer();
        files.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
    }

    zone.addEventListener('dragenter', function (e) {
      prevent(e);
      dragDepth++;
      zone.classList.add(activeClass);
    });
    zone.addEventListener('dragover', function (e) {
      prevent(e);
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    zone.addEventListener('dragleave', function (e) {
      prevent(e);
      dragDepth--;
      if (dragDepth <= 0) {
        dragDepth = 0;
        zone.classList.remove(activeClass);
      }
    });
    zone.addEventListener('drop', function (e) {
      prevent(e);
      dragDepth = 0;
      zone.classList.remove(activeClass);
      handleFiles(e.dataTransfer && e.dataTransfer.files);
    });
    return true;
  }

  global.MatchdoImageDrop = {
    wire: wireImageDropZone,
    filterImageFiles: filterImageFiles
  };
})(typeof window !== 'undefined' ? window : this);
