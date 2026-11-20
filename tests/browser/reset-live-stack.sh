#!/usr/bin/env bash
# Return the live monitoring database to the state daily-form-live.spec.ts needs:
# migrated, provisioned, and with no office setups and no entries.
#
# WHY THIS EXISTS. Opening balances lock permanently, per office, the first time
# they are saved — not per day. The spec completes that one-time screen through
# the UI, because SaveSetupAsync is the code under test for the locked-balance
# rule, and asserts that a second setup is refused with 409. So an office that
# has run the spec once can never run it again, and after six runs the database
# is spent for good. Without this script the gate is a one-shot.
#
# This script holds NO credentials. It takes every secret from the environment:
#
#   PGPASSWORD              password for the Postgres superuser below
#   RMC_CREDENTIALS_FILE    path to the protected provisioning env file
#                           (one LOGIN=PASSWORD line per approved account)
#   Anchal__Jwt__*          Secret / Issuer / Audience / ExpiryMinutes —
#                           `provision` validates these at startup and throws
#                           without them. Source your jwt env file first.
#
# and takes the rest, with the defaults of the task-8 runbook, from:
#
#   RMC_DB_HOST (127.0.0.1)  RMC_DB_PORT (5433)  RMC_DB_NAME (anchal_shapes)
#   RMC_DB_USER (postgres)   RMC_BACKEND_REPO (/home/claude/backend)
#
# Usage, with the API stopped (see below):
#
#   export PGPASSWORD=...                       # not echoed by this script
#   . /path/to/jwt.env
#   RMC_CREDENTIALS_FILE=/home/claude/live/anchal-provisioning.env \
#     tests/browser/reset-live-stack.sh
#
# STOP THE API FIRST, AND START IT AGAIN AFTERWARDS. A running Kestrel holds a
# connection pool to the database this script drops; its pooled connections do
# not survive the drop, and every later request fails until it is restarted.
# This script disconnects whatever is still attached so the drop can proceed,
# but it cannot repair a process it did not start.
set -euo pipefail

host=${RMC_DB_HOST:-127.0.0.1}
port=${RMC_DB_PORT:-5433}
name=${RMC_DB_NAME:-anchal_shapes}
user=${RMC_DB_USER:-postgres}
repo=${RMC_BACKEND_REPO:-/home/claude/backend}
credentials=${RMC_CREDENTIALS_FILE:-}

die() { echo "reset-live-stack: $*" >&2; exit 1; }

[ -n "${PGPASSWORD:-}" ] || die "PGPASSWORD is not set"
[ -n "$credentials" ] || die "RMC_CREDENTIALS_FILE is not set"
[ -r "$credentials" ] || die "cannot read RMC_CREDENTIALS_FILE at $credentials"
[ -d "$repo" ] || die "no backend repo at $repo (set RMC_BACKEND_REPO)"
[ -n "${Anchal__Jwt__Secret:-}" ] || die "Anchal__Jwt__Secret is not set; source your jwt env file"

# The connection validator pins host, port, database and username explicitly and
# throws at startup on a mismatch, so the pins are derived from the same values
# used to create the database rather than written out twice.
export ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT:-Development}
export ConnectionStrings__CommissionerMonitoring="Host=$host;Port=$port;Database=$name;Username=$user;Password=$PGPASSWORD"
export CommissionerMonitoring__DatabaseEnvironment=$ASPNETCORE_ENVIRONMENT
export CommissionerMonitoring__ExpectedHost=$host
export CommissionerMonitoring__ExpectedPort=$port
export CommissionerMonitoring__ExpectedDatabase=$name
export CommissionerMonitoring__ExpectedUsername=$user
# Provisioning writes a few hundred rows and the Development defaults echo every
# statement, which buries the result. Values are never logged either way. The
# configuration key has literal dots in it, which `__` cannot express and which
# bash will not accept in a variable name, so it is passed through `env`.
quiet_sql="Logging__LogLevel__Microsoft.EntityFrameworkCore.Database.Command=${RMC_SQL_LOG_LEVEL:-Warning}"

echo "reset-live-stack: recreating $name on $host:$port as $user"

# A client still attached — a Kestrel that was not stopped, an open psql — makes
# DROP DATABASE fail outright, so they are disconnected first.
psql -h "$host" -p "$port" -U "$user" -d postgres -v ON_ERROR_STOP=1 -q -c \
  "select pg_terminate_backend(pid) from pg_stat_activity
     where datname = '$name' and pid <> pg_backend_pid();" >/dev/null

dropdb -h "$host" -p "$port" -U "$user" --if-exists "$name"
createdb -h "$host" -p "$port" -U "$user" "$name"

echo "reset-live-stack: applying migrations"
env "$quiet_sql" dotnet ef database update \
  --project "$repo/src/Anchal.Infrastructure" \
  --startup-project "$repo/src/Anchal.Api"

# Provisioning seeds the six offices, the 25-service catalog and the seven
# approved logins. It does NOT create opening balances: that is the one-time
# screen the spec walks, and it is why this reset is needed at all.
echo "reset-live-stack: provisioning accounts, offices and the service catalog"
env "$quiet_sql" dotnet run --project "$repo/src/Anchal.Api" -- provision --credentials-file "$credentials"

setups=$(psql -h "$host" -p "$port" -U "$user" -d "$name" -t -A -c \
  'select count(*) from commissioner_monitoring.monitoring_office_setups;')
accounts=$(psql -h "$host" -p "$port" -U "$user" -d "$name" -t -A -c \
  'select count(*) from commissioner_monitoring.monitoring_users;')
[ "$setups" = "0" ] || die "expected 0 office setups after reset, found $setups"
[ "$accounts" = "7" ] || die "expected 7 provisioned accounts after reset, found $accounts"

echo "reset-live-stack: ready — $accounts accounts, $setups office setups."
echo "reset-live-stack: start the API again before running the spec."
