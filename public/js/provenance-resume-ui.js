/**
 * 生圖履歷 — 前台／後台共用 modal（P1：user_design + promo_scene）
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('zh-TW', { hour12: false }); } catch (_) { return String(iso).slice(0, 19); }
  }

  var modalEl = null;
  var modalInstance = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.id = 'provenanceResumeModal';
    modalEl.tabIndex = -1;
    modalEl.innerHTML =
      '<div class="modal-dialog modal-lg modal-dialog-scrollable">' +
      '<div class="modal-content">' +
      '<div class="modal-header py-2">' +
      '<h6 class="modal-title mb-0">生圖履歷</h6>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
      '</div>' +
      '<div class="modal-body small" id="provenanceResumeBody"></div>' +
      '<div class="modal-footer py-2">' +
      '<button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">關閉</button>' +
      '<button type="button" class="btn btn-outline-primary btn-sm" id="btnProvResumeJson">匯出 JSON</button>' +
      '<button type="button" class="btn btn-primary btn-sm" id="btnProvResumePdf">匯出 PDF</button>' +
      '</div></div></div>';
    document.body.appendChild(modalEl);
    return modalEl;
  }

  function renderReferences(refs) {
    if (!refs || !refs.length) return '<p class="text-muted mb-0">尚無參考來源記錄</p>';
    return '<div class="row g-2">' + refs.map(function (r) {
      var img = r.image_url
        ? '<img src="' + esc(r.image_url) + '" class="rounded border" style="width:100%;height:72px;object-fit:cover" alt="">'
        : '<div class="rounded border bg-light text-muted d-flex align-items-center justify-content-center" style="height:72px;font-size:0.7rem">無圖</div>';
      var link = r.inspiration_url
        ? ('<a href="' + esc(r.inspiration_url) + '" target="_blank" rel="noopener" class="small">公開連結</a>')
        : '<span class="text-muted small">無公開連結</span>';
      return '<div class="col-6 col-md-4">' + img +
        '<div class="mt-1 fw-semibold">' + esc(r.ref_kind_label || '參考') + '</div>' +
        '<div class="text-truncate" title="' + esc(r.title || '') + '">' + esc(r.title || '—') + '</div>' +
        (r.manufacturer_name ? ('<div class="text-muted">' + esc(r.manufacturer_name) + '</div>') : '') +
        link + '</div>';
    }).join('') + '</div>';
  }

  function renderResumeHtml(resume) {
    var ctx = resume.generation_context || {};
    var img = resume.image && resume.image.output_url
      ? ('<p><img src="' + esc(resume.image.output_url) + '" class="img-fluid rounded border mb-2" alt=""></p>')
      : '';
    var html = img + '<dl class="row mb-2">' +
      '<dt class="col-sm-3">履歷編號</dt><dd class="col-sm-9"><code class="small">' + esc(resume.record_id) + '</code></dd>' +
      '<dt class="col-sm-3">類型</dt><dd class="col-sm-9">' + esc(resume.asset_kind) + '</dd>' +
      '<dt class="col-sm-3">生成入口</dt><dd class="col-sm-9">' + esc(ctx.entry_surface_label || ctx.entry_surface || '—') + '</dd>' +
      '<dt class="col-sm-3">生成時間</dt><dd class="col-sm-9">' + esc(fmtTime(resume.timestamps && resume.timestamps.created_at)) + '</dd>';
    if (resume.billing && resume.billing.points_charged != null) {
      html += '<dt class="col-sm-3">消耗點數</dt><dd class="col-sm-9">' + esc(resume.billing.points_charged) + '</dd>';
    }
    if (resume.provenance_links && resume.provenance_links.inspiration_url) {
      html += '<dt class="col-sm-3">靈感牆</dt><dd class="col-sm-9"><a href="' + esc(resume.provenance_links.inspiration_url) + '" target="_blank" rel="noopener">' + esc(resume.provenance_links.inspiration_url) + '</a></dd>';
    }
    if (resume.actor && resume.actor.email) {
      html += '<dt class="col-sm-3">帳號</dt><dd class="col-sm-9">' + esc(resume.actor.email) + '</dd>';
    }
    html += '</dl>';
    html += '<div class="fw-semibold mb-1">參考來源</div>' + renderReferences(resume.references);
    var prompts = resume.prompts || {};
    html += '<div class="fw-semibold mt-3 mb-1">Prompt</div>' +
      '<div class="mb-1"><span class="text-muted">使用者：</span>' + esc(prompts.user_prompt || '—') + '</div>';
    if (prompts.final_prompt && prompts.final_prompt !== prompts.user_prompt) {
      html += '<div class="mb-1"><span class="text-muted">最終：</span>' + esc((prompts.final_prompt || '').slice(0, 1200)) + '</div>';
    }
    if (prompts.seed != null) html += '<div class="mb-1"><span class="text-muted">Seed：</span>' + esc(prompts.seed) + '</div>';
    if (ctx.camera_params && ctx.camera_params.length) {
      html += '<div class="fw-semibold mt-2 mb-1">商攝參數</div><ul class="mb-0 ps-3">';
      ctx.camera_params.forEach(function (p) {
        html += '<li>' + esc(p.category_label + '：' + p.name) + '</li>';
      });
      html += '</ul>';
    }
    if (resume.platform && resume.platform.disclaimer) {
      html += '<p class="text-muted mt-3 mb-0" style="font-size:0.72rem">' + esc(resume.platform.disclaimer) + '</p>';
    }
    return html;
  }

  async function getAuthToken(isAdmin) {
    if (window.AuthService && typeof AuthService.getSession === 'function') {
      var s = await AuthService.getSession();
      return s && (s.access_token || (s.session && s.session.access_token));
    }
    return null;
  }

  async function downloadPdfWithAuth(pdfUrl, token, filename) {
    var r = await fetch(pdfUrl, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) {
      var err = await r.json().catch(function () { return {}; });
      alert(err.error || 'PDF 下載失敗');
      return;
    }
    var blob = await r.blob();
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'matchdo-provenance-resume.pdf';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function openProvenanceResume(opts) {
    opts = opts || {};
    var kind = (opts.kind || '').trim();
    var id = (opts.id || '').trim();
    var isAdmin = !!opts.admin;
    if (!kind || !id) {
      alert('缺少履歷參數');
      return;
    }
    ensureModal();
    var body = document.getElementById('provenanceResumeBody');
    body.innerHTML = '<p class="text-muted mb-0">載入中…</p>';
    if (!modalInstance && global.bootstrap) {
      modalInstance = new bootstrap.Modal(modalEl);
    }
    if (modalInstance) modalInstance.show();

    var token = await getAuthToken(isAdmin);
    if (!token) {
      body.innerHTML = '<p class="text-danger">請先登入</p>';
      return;
    }
    var apiBase = isAdmin ? '/api/admin/provenance-resume' : '/api/me/provenance-resume';
    var qs = '?kind=' + encodeURIComponent(kind) + '&id=' + encodeURIComponent(id);
    var r = await fetch(apiBase + qs, { headers: { Authorization: 'Bearer ' + token } });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      body.innerHTML = '<p class="text-danger">' + esc(data.error || '載入失敗') + '</p>';
      return;
    }
    var resume = data.resume;
    body.innerHTML = renderResumeHtml(resume);

    var pdfBase = isAdmin ? '/api/admin/provenance-resume/export.pdf' : '/api/me/provenance-resume/export.pdf';
    document.getElementById('btnProvResumePdf').onclick = function () {
      downloadPdfWithAuth(pdfBase + qs, token, 'matchdo-provenance-' + kind + '.pdf');
    };
    document.getElementById('btnProvResumeJson').onclick = function () {
      var blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'matchdo-provenance-' + kind + '-' + id.slice(0, 8) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };
  }

  function mapRecordSourceToKind(source) {
    if (source === 'site') return 'user_design';
    if (source === 'promo' || source === 'promo_camera' || source === 'promo_camera_web' || source === 'promo_camera_app') return 'promo_scene';
    return null;
  }

  global.ProvenanceResumeUI = {
    open: openProvenanceResume,
    downloadPdf: downloadPdfWithAuth,
    mapRecordSourceToKind: mapRecordSourceToKind
  };
})(typeof window !== 'undefined' ? window : global);
