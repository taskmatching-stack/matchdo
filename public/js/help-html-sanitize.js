/**
 * 操作介紹 HTML 白名單（與 lib/help-html-sanitize.js 同步）
 */
(function (global) {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var ALLOWED_HELP_TAGS = [
    'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'a', 'br',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'
  ];

  function looksLikeHtml(s) {
    return /<\s*(h2|h3|p|ul|ol|li|strong|a|br|table|thead|tbody|tfoot|tr|th|td|caption)\b/i.test(String(s || ''));
  }

  function normalizeWordPasteHtml(s) {
    return String(s || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, '')
      .replace(/<\/?(span|font|meta|link|xml|o:p|w:[^\s>]+|colgroup|col)[^>]*>/gi, '')
      .replace(/<b\b[^>]*>/gi, '<strong>')
      .replace(/<\/b>/gi, '</strong>')
      .replace(/<i\b[^>]*>/gi, '<em>')
      .replace(/<\/i>/gi, '</em>')
      .replace(/<em>([\s\S]*?)<\/em>/gi, '<strong>$1</strong>')
      .replace(/<\/?div[^>]*>/gi, '');
  }

  function unescapeHtmlEntities(s) {
    var t = String(s || '');
    if (!/&lt;\s*(table|h2|h3|p|ul|ol)\b/i.test(t)) return t;
    return t
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  function sanitizeHelpHtml(raw) {
    var s = unescapeHtmlEntities(String(raw || ''));
    s = normalizeWordPasteHtml(s);
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
    s = s.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(/\sclass="[^"]*"/gi, '');
    s = s.replace(/\sstyle="[^"]*"/gi, '');
    s = s.replace(/<\s*(table|thead|tbody|tfoot|tr)\b[^>]*>/gi, function (_, tag) {
      return '<' + tag + '>';
    });
    s = s.replace(/<table>/gi, '<table class="help-table">');
    s = s.replace(/<\s*(th|td)\b([^>]*)>/gi, function (_, tag, attrs) {
      var extra = '';
      var cm = /colspan\s*=\s*("?)(\d+)\1/i.exec(attrs || '');
      var rm = /rowspan\s*=\s*("?)(\d+)\1/i.exec(attrs || '');
      if (cm) {
        var cn = parseInt(cm[2], 10);
        if (cn >= 2 && cn <= 20) extra += ' colspan="' + cn + '"';
      }
      if (rm) {
        var rn = parseInt(rm[2], 10);
        if (rn >= 2 && rn <= 20) extra += ' rowspan="' + rn + '"';
      }
      return '<' + tag + extra + '>';
    });
    s = s.replace(/<\s*(h2|h3|p|ul|ol|li|strong|br|caption)\b[^>]*>/gi, function (_, tag) {
      return '<' + tag + '>';
    });
    var allowed = ALLOWED_HELP_TAGS.join('|');
    s = s.replace(new RegExp('<\\/?(?!' + allowed + ')\\w+\\b[^>]*>', 'gi'), '');
    s = s.replace(/<a\s+([^>]*?)href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>/gi, function (_, pre, q, dq, sq, bare) {
      var href = dq || sq || bare || '';
      if (!/^https?:\/\//i.test(href) && !/^\//.test(href)) return '';
      return '<a href="' + escapeHtml(href) + '">';
    });
    return s;
  }

  function extractTablesHtml(raw) {
    var src = normalizeWordPasteHtml(String(raw || ''));
    var tables = [];
    var re = /<table\b[\s\S]*?<\/table>/gi;
    var m;
    while ((m = re.exec(src)) !== null) {
      var clean = sanitizeHelpHtml(m[0]);
      if (/<table\b/i.test(clean)) tables.push(clean);
    }
    return tables.join('');
  }

  function wrapTablesForQuillEditor(html) {
    var s = sanitizeHelpHtml(html);
    if (!/<table\b/i.test(s)) return s;
    return s.replace(/<table class="help-table">[\s\S]*?<\/table>/gi, function (table) {
      return '<div class="og-table-embed" contenteditable="false">' + table + '</div>';
    });
  }

  function ingestHtmlForQuillEditor(raw) {
    var s = sanitizeHelpHtml(raw);
    if (!String(s || '').trim()) return '';
    return wrapTablesForQuillEditor(s);
  }

  function splitHelpHtmlByTables(html) {
    var s = String(html || '');
    var parts = [];
    var re = /<table class="help-table">[\s\S]*?<\/table>/gi;
    var last = 0;
    var m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push({ type: 'html', content: s.slice(last, m.index) });
      parts.push({ type: 'table', content: m[0] });
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push({ type: 'html', content: s.slice(last) });
    if (!parts.length && s.trim()) parts.push({ type: 'html', content: s });
    return parts;
  }

  function normalizeEditorHtml(html) {
    var s = String(html || '');
    s = s.replace(/<div class="og-table-embed"[^>]*>([\s\S]*?)<\/div>/gi, function (_, inner) {
      return sanitizeHelpHtml(inner);
    });
    return sanitizeHelpHtml(s);
  }

  global.HelpHtmlSanitize = {
    looksLikeHtml: looksLikeHtml,
    sanitizeHelpHtml: sanitizeHelpHtml,
    extractTablesHtml: extractTablesHtml,
    wrapTablesForQuillEditor: wrapTablesForQuillEditor,
    ingestHtmlForQuillEditor: ingestHtmlForQuillEditor,
    splitHelpHtmlByTables: splitHelpHtmlByTables,
    normalizeEditorHtml: normalizeEditorHtml
  };
})(typeof window !== 'undefined' ? window : this);
