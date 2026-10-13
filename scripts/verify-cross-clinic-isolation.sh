#!/usr/bin/env bash
# Cross-clinic isolation — deployed verification (run from a network-allowed host).
#
# The cloud agent sandbox denies outbound HTTPS to *.vercel.app, so these
# deployed checks must be run by a human (or CI runner) with network access.
#
# Usage:
#   BASE_URL="https://<preview>.vercel.app" \
#   MUMBAI_ASSESSMENT_ID="cmv6hg0kf002ofqcupxdrl72f" \
#   ACUBE_ASSESSMENT_ID="<an acube assessment id>" \
#   ACUBE_DOCTOR_COOKIE="<Dr Avinash authenticated session cookie>" \
#   bash scripts/verify-cross-clinic-isolation.sh
#
# ACUBE_DOCTOR_COOKIE is optional; without it only the anonymous checks run.
# Exit code is non-zero if any assertion fails.

set -u
BASE_URL="${BASE_URL:?set BASE_URL to the deployed preview origin}"
MUMBAI_ASSESSMENT_ID="${MUMBAI_ASSESSMENT_ID:?set MUMBAI_ASSESSMENT_ID}"
ACUBE_ASSESSMENT_ID="${ACUBE_ASSESSMENT_ID:-}"
ACUBE_DOCTOR_COOKIE="${ACUBE_DOCTOR_COOKIE:-}"

fail=0
check() { # name  expected_regex  actual_code
  if [[ "$3" =~ $2 ]]; then echo "PASS  $1 (HTTP $3)"; else echo "FAIL  $1 (HTTP $3, expected $2)"; fail=1; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$@"; }

echo "== Anonymous (no session, no token) =="
# PDF generation must not run for an anonymous caller.
c=$(code -X POST "$BASE_URL/api/assessment/pdf" -H 'content-type: application/json' \
      --data "{\"assessmentId\":\"$MUMBAI_ASSESSMENT_ID\"}")
check "anon POST /api/assessment/pdf denied" '^(401|403)$' "$c"

# PDF download must not stream to an anonymous caller.
c=$(code "$BASE_URL/api/assessment/pdf?id=$MUMBAI_ASSESSMENT_ID")
check "anon GET /api/assessment/pdf denied" '^(401|403)$' "$c"

# Doctor dashboard API must reject an unauthenticated caller.
c=$(code "$BASE_URL/api/doctor/reports")
check "anon GET /api/doctor/reports denied" '^(401|403)$' "$c"

# Existence oracle: a well-formed but nonexistent id must look the same as a
# real one to an anonymous caller (both 401, neither 404).
c=$(code -X POST "$BASE_URL/api/assessment/pdf" -H 'content-type: application/json' \
      --data '{"assessmentId":"cZZZZZZZZZZZZZZZZZZZZZZZZ"}')
check "anon POST unknown id -> same 401 (no 404 oracle)" '^(401|403)$' "$c"

if [[ -n "$ACUBE_DOCTOR_COOKIE" && -n "$ACUBE_ASSESSMENT_ID" ]]; then
  echo "== Authenticated as an Acube doctor, reaching a Mumbai-Test assessment =="
  # Cross-clinic report generation must be refused.
  c=$(code -X POST "$BASE_URL/api/assessment/pdf" -H 'content-type: application/json' \
        -H "cookie: $ACUBE_DOCTOR_COOKIE" --data "{\"assessmentId\":\"$MUMBAI_ASSESSMENT_ID\"}")
  check "acube doctor POST pdf for mumbai assessment denied" '^(403|404)$' "$c"

  # Cross-clinic PDF download must be refused.
  c=$(code "$BASE_URL/api/assessment/pdf?id=$MUMBAI_ASSESSMENT_ID" -H "cookie: $ACUBE_DOCTOR_COOKIE")
  check "acube doctor GET pdf for mumbai assessment denied" '^(403|404)$' "$c"

  # Cross-clinic doctor report detail / journey must be refused.
  c=$(code "$BASE_URL/api/doctor/journey/$MUMBAI_ASSESSMENT_ID" -H "cookie: $ACUBE_DOCTOR_COOKIE")
  check "acube doctor journey for mumbai assessment denied" '^(403|404)$' "$c"

  # Acube doctor's own clinic assessment MUST be reachable (control).
  c=$(code "$BASE_URL/api/doctor/journey/$ACUBE_ASSESSMENT_ID" -H "cookie: $ACUBE_DOCTOR_COOKIE")
  check "acube doctor journey for OWN assessment allowed" '^(200)$' "$c"
else
  echo "(skipping authenticated cross-clinic checks — set ACUBE_DOCTOR_COOKIE and ACUBE_ASSESSMENT_ID)"
fi

# Manual two-clinic browser checklist (no automation substitute):
#  1. Scan DrFACT Mumbai Test QR -> /q/drfact-mumbai-test, complete an assessment.
#  2. Scan Acube QR -> /q/acube-aesthetics, complete an assessment.
#  3. Log in as a DrFACT Mumbai Test clinician: queue/reports show ONLY (1), never (2).
#  4. Log in as Dr Avinash (Acube): queue/reports show ONLY (2), never (1).
#  5. From each session, open the other clinic's assessment id by URL -> 403/404.
#  6. Confirm the approved report shows the correct clinic + doctor.

echo
if [[ "$fail" -eq 0 ]]; then echo "ALL DEPLOYED CHECKS PASSED"; else echo "SOME CHECKS FAILED"; fi
exit "$fail"
