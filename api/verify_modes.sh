#!/usr/bin/env bash
# Sequential two-mode verification: runs ENFORCED then LEGACY, each with its own
# freshly-written local.settings.json (the two modes cannot share one file
# because REQUIRE_AUTH is read once at func startup). No concurrent hosts.
set -u
cd "$(dirname "$0")"

AZ="D:/azure-cli/venv/Scripts/az.bat"
RG="classroom-survivors"

write_settings() {
  local mode="$1"   # "true" => enforced, "false" => legacy
  local ACCT=$( "$AZ" cosmosdb list -g "$RG" --query "[0].name" -o tsv 2>/dev/null | grep -vE "Cryptography|TripleDES|paramiko" )
  local ENDPOINT=$( "$AZ" cosmosdb show -g "$RG" -n "$ACCT" --query "documentEndpoint" -o tsv 2>/dev/null | grep -vE "Cryptography|TripleDES|paramiko" )
  local KEY=$( "$AZ" cosmosdb keys list -g "$RG" -n "$ACCT" --query "primaryMasterKey" -o tsv 2>/dev/null | grep -vE "Cryptography|TripleDES|paramiko" )
  cat > local.settings.json <<JSON
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_ENDPOINT": "${ENDPOINT}",
    "COSMOS_KEY": "${KEY}",
    "COSMOS_DB_NAME": "Val-EslApp-Test",
    "COSMOS_CONTAINER_NAME": "Students",
    "APP_API_KEY": "test-harness-key",
    "SESSION_SECRET": "manual-test-secret",
    "REQUIRE_AUTH": "${mode}"
  },
  "Host": { "CORS": "*" }
}
JSON
  echo "  wrote local.settings.json REQUIRE_AUTH=${mode}"
}

stop_func() {
  cmd.exe /c "taskkill /F /IM func.exe" >/dev/null 2>&1 || true
  cmd.exe /c "taskkill /F /IM dotnet.exe" >/dev/null 2>&1 || true
  sleep 2
}

start_and_wait() {
  local port="$1" expect="$2"  # expect = 401 (enforced) or 200 (legacy)
  stop_func
  func start --port "$port" >/tmp/func_$port.log 2>&1 &
  local pid=$!
  for i in $(seq 1 60); do
    local code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/api/getStudents" -H "X-App-Key: test-harness-key" 2>/dev/null)
    if [ "$code" = "$expect" ]; then echo "  host :$port ready (mode=$expect) after ${i}s"; return 0; fi
    sleep 1
  done
  echo "  !! host :$port FAILED to reach mode $expect (last=$code)"; return 1
}

seed() {
  node run_with_settings.js seed_test.js 2>&1 | grep -E "SEED_DONE|Error" | grep -vE "Cryptography|TripleDES|paramiko" | tail -1
}

LOG="auth_verify_$(date +%Y%m%d_%H%M%S).log"
{
  echo "===== $(date -u +%FT%TZ) ====="

  echo "## ENFORCED MODE (REQUIRE_AUTH=true)"
  write_settings "true"
  seed
  start_and_wait 7074 401
  TEST_BASE=http://localhost:7074/api npm run test 2>&1 | grep -vE "Cryptography|TripleDES|paramiko|deprecated" | grep -E "PASS|FAIL|RESULT"
  stop_func

  echo ""
  echo "## LEGACY MODE (REQUIRE_AUTH=false)"
  write_settings "false"
  seed
  start_and_wait 7074 200
  TEST_BASE=http://localhost:7074/api LEGACY_TEST=1 node test_auth.js 2>&1 | grep -vE "Cryptography|TripleDES|paramiko|deprecated" | grep -E "PASS|FAIL|RESULT"
  stop_func

  echo ""
  echo "## E2E CLIENT CONTRACT (enforced)"
  write_settings "true"
  seed
  start_and_wait 7074 401
  TEST_BASE=http://localhost:7074/api node test_e2e_client.js 2>&1 | grep -vE "Cryptography|TripleDES|paramiko|deprecated" | grep -E "PASS|FAIL|RESULT"
  stop_func
} | tee "$LOG"

echo ""
echo "saved: $LOG"
