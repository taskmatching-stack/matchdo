#!/usr/bin/env bash
# Phase 0：驗證 media.matchdo.cc 可讀 GCS 物件
# 前置：gcs-media-phase0-setup.sh 已跑、DNS 已指向 LB IP、SSL 憑證 ACTIVE
#
# 用法：bash scripts/gcs-media-phase0-healthcheck.sh

set -euo pipefail

DOMAIN="${GCS_MEDIA_DOMAIN:-media.matchdo.cc}"
BUCKET="${GCS_MEDIA_BUCKET:-matchdo-media}"
URL="https://${DOMAIN}/_healthcheck/phase0.txt"

echo "==> Healthcheck GET ${URL}"

HTTP_CODE="$(curl -sS -o /tmp/matchdo-media-healthcheck-body.txt -w '%{http_code}' "${URL}" || echo "000")"
echo "    HTTP ${HTTP_CODE}"

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo ""
  echo "FAIL: expected HTTP 200."
  echo "Checklist:"
  echo "  1) DNS: media.matchdo.cc → LB IP (gcloud compute forwarding-rules describe matchdo-media-https-rule --global)"
  echo "  2) SSL: gcloud compute ssl-certificates describe matchdo-media-cert --global"
  echo "  3) Object: gcloud storage ls gs://${BUCKET}/_healthcheck/"
  exit 1
fi

head -n 3 /tmp/matchdo-media-healthcheck-body.txt
echo ""

echo "==> CDN headers (second request)"
curl -sS -I "${URL}" | grep -iE '^(HTTP/|cache-|age:|via:|x-cache|server:)' || true

echo ""
echo "OK: media.matchdo.cc healthcheck passed. Phase 0 CDN path is ready for Phase 1."
