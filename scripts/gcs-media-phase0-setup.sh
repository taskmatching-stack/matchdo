#!/usr/bin/env bash
# Phase 0：建立 matchdo-media GCS + Cloud CDN + media.matchdo.cc
# 在 GCP Cloud Shell 執行（專案 matchdo）。
#
# 用法：
#   cd ~/matchdo && git pull origin main
#   bash scripts/gcs-media-phase0-setup.sh
#
# 執行後：依腳本輸出設定 DNS，再等 SSL 憑證（最多約 60 分鐘），最後：
#   bash scripts/gcs-media-phase0-healthcheck.sh

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-matchdo}"
REGION="${REGION:-asia-northeast1}"
BUCKET="${GCS_MEDIA_BUCKET:-matchdo-media}"
DOMAIN="${GCS_MEDIA_DOMAIN:-media.matchdo.cc}"
BACKEND_BUCKET="${GCS_BACKEND_BUCKET:-matchdo-media-backend}"
URL_MAP="${GCS_URL_MAP:-matchdo-media-url-map}"
SSL_CERT="${GCS_SSL_CERT:-matchdo-media-cert}"
HTTPS_PROXY="${GCS_HTTPS_PROXY:-matchdo-media-https-proxy}"
FWD_RULE="${GCS_FWD_RULE:-matchdo-media-https-rule}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-matchdo}"
CLOUD_RUN_REGION="${CLOUD_RUN_REGION:-asia-northeast1}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIFECYCLE_JSON="${REPO_ROOT}/infra/gcs-matchdo-media-lifecycle.json"
HEALTHCHECK_FILE="${REPO_ROOT}/infra/gcs-healthcheck/phase0.txt"

echo "==> Phase 0 GCS media setup"
echo "    project=${PROJECT_ID} bucket=${BUCKET} domain=${DOMAIN}"

gcloud config set project "${PROJECT_ID}" 2>&1 | grep -v -E 'Regional Access Boundary|taskmatchlng' || true
gcloud config set account taskmatching@gmail.com 2>&1 | grep -v -E 'Regional Access Boundary|taskmatchlng' || true

if ! gcloud storage buckets describe "gs://${BUCKET}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "==> Creating bucket gs://${BUCKET} (${REGION})"
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access
else
  echo "==> Bucket gs://${BUCKET} already exists"
fi

if [[ -f "${LIFECYCLE_JSON}" ]]; then
  echo "==> Applying lifecycle (preview prefixes, 90d)"
  gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file="${LIFECYCLE_JSON}"
else
  echo "WARN: lifecycle file not found: ${LIFECYCLE_JSON}"
fi

echo "==> Public read for CDN/LB (allUsers objectViewer; URLs still use ${DOMAIN})"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member=allUsers \
  --role=roles/storage.objectViewer \
  --quiet

if ! gcloud compute backend-buckets describe "${BACKEND_BUCKET}" --global &>/dev/null; then
  echo "==> Creating backend bucket + Cloud CDN"
  gcloud compute backend-buckets create "${BACKEND_BUCKET}" \
    --gcs-bucket-name="${BUCKET}" \
    --enable-cdn \
    --global
else
  echo "==> Backend bucket ${BACKEND_BUCKET} exists; ensuring CDN on"
  gcloud compute backend-buckets update "${BACKEND_BUCKET}" --enable-cdn --global
fi

if ! gcloud compute url-maps describe "${URL_MAP}" --global &>/dev/null; then
  echo "==> Creating URL map"
  gcloud compute url-maps create "${URL_MAP}" \
    --default-backend-bucket="${BACKEND_BUCKET}" \
    --global
else
  echo "==> URL map ${URL_MAP} already exists"
fi

if ! gcloud compute ssl-certificates describe "${SSL_CERT}" --global &>/dev/null; then
  echo "==> Creating managed SSL certificate for ${DOMAIN}"
  gcloud compute ssl-certificates create "${SSL_CERT}" \
    --domains="${DOMAIN}" \
    --global
else
  echo "==> SSL cert ${SSL_CERT} already exists"
fi

if ! gcloud compute target-https-proxies describe "${HTTPS_PROXY}" --global &>/dev/null; then
  echo "==> Creating HTTPS proxy"
  gcloud compute target-https-proxies create "${HTTPS_PROXY}" \
    --url-map="${URL_MAP}" \
    --ssl-certificates="${SSL_CERT}" \
    --global
else
  echo "==> HTTPS proxy ${HTTPS_PROXY} already exists"
fi

if ! gcloud compute forwarding-rules describe "${FWD_RULE}" --global &>/dev/null; then
  echo "==> Creating global forwarding rule (443)"
  gcloud compute forwarding-rules create "${FWD_RULE}" \
    --global \
    --target-https-proxy="${HTTPS_PROXY}" \
    --ports=443
else
  echo "==> Forwarding rule ${FWD_RULE} already exists"
fi

LB_IP="$(gcloud compute forwarding-rules describe "${FWD_RULE}" --global --format='get(IPAddress)')"
echo ""
echo "========== DNS（請在 matchdo.cc 的 DNS 提供商設定）=========="
echo "  類型: A"
echo "  名稱: media"
echo "  值:   ${LB_IP}"
echo "  TTL:  300（或預設）"
echo ""
echo "SSL 憑證狀態（需 DNS 生效後才會 ACTIVE，常需 15–60 分鐘）："
gcloud compute ssl-certificates describe "${SSL_CERT}" --global \
  --format='table(name,managed.status,managed.domainStatus)'

echo ""
echo "==> Cloud Run 服務帳號 → GCS objectAdmin"
RUN_SA="$(gcloud run services describe "${CLOUD_RUN_SERVICE}" \
  --region="${CLOUD_RUN_REGION}" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [[ -z "${RUN_SA}" ]]; then
  PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
  RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  echo "    (fallback compute default SA) ${RUN_SA}"
else
  echo "    ${RUN_SA}"
fi
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/storage.objectAdmin" \
  --quiet

if [[ -f "${HEALTHCHECK_FILE}" ]]; then
  echo "==> Uploading healthcheck object"
  gcloud storage cp "${HEALTHCHECK_FILE}" "gs://${BUCKET}/_healthcheck/phase0.txt" \
    --content-type="text/plain; charset=utf-8"
  echo "    After DNS + SSL ACTIVE, test:"
  echo "    curl -I \"https://${DOMAIN}/_healthcheck/phase0.txt\""
else
  echo "WARN: healthcheck file missing: ${HEALTHCHECK_FILE}"
fi

echo ""
echo "==> Phase 0 GCP resources ready."
echo "    Next: DNS → wait SSL ACTIVE → bash scripts/gcs-media-phase0-healthcheck.sh"
echo "    DB baseline: run docs/storage-gcs-phase0-inventory.sql in Supabase SQL Editor"
echo "    Local: node scripts/inventory-supabase-storage-buckets.js"
