#!/usr/bin/env bash
# 建立 MatchDO 內部 cron（Cloud Scheduler → Cloud Run）
# 在 Cloud Shell 執行；需先設定 INTERNAL_CRON_SECRET 於 Cloud Run 環境變數。
# 用法：MATCHDO_URL=https://matchdo.cc INTERNAL_CRON_SECRET=xxx ./scripts/setup-internal-cron-scheduler.sh

set -euo pipefail

PROJECT="${GCLOUD_PROJECT:-matchdo}"
REGION="${GCLOUD_REGION:-asia-northeast1}"
BASE_URL="${MATCHDO_URL:-https://matchdo.cc}"
SECRET="${INTERNAL_CRON_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "請設定 INTERNAL_CRON_SECRET" >&2
  exit 1
fi

gcloud config set project "$PROJECT"

create_or_update() {
  local name="$1"
  local uri="$2"
  if gcloud scheduler jobs describe "$name" --location="$REGION" &>/dev/null; then
    gcloud scheduler jobs update http "$name" \
      --location="$REGION" \
      --schedule="0 3 * * *" \
      --uri="$uri" \
      --http-method=POST \
      --headers="Authorization=Bearer ${SECRET},Content-Type=application/json" \
      --message-body='{}' \
      --time-zone="UTC"
  else
    gcloud scheduler jobs create http "$name" \
      --location="$REGION" \
      --schedule="0 3 * * *" \
      --uri="$uri" \
      --http-method=POST \
      --headers="Authorization=Bearer ${SECRET},Content-Type=application/json" \
      --message-body='{}' \
      --time-zone="UTC"
  fi
}

create_or_update "ugc-retention-daily" "${BASE_URL}/api/internal/ugc-retention-cron"
create_or_update "subscription-expiry-daily" "${BASE_URL}/api/internal/subscription-expiry-cron"

echo "Done. Jobs: ugc-retention-daily, subscription-expiry-daily (UTC 03:00 daily)"
