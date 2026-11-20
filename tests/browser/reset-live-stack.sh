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
# SAFETY. This script runs DROP DATABASE on the target it is given, which cannot
# be undone, so it only ever drops a database it created itself.
#
# Every database it creates is stamped with a fixed marker, as a COMMENT ON
# DATABASE. Before dropping, it refuses unless the target either does not exist
# yet or carries that exact marker. That is the check that holds: a database
# this script did not create is never dropped, whatever it is called and
# wherever the host and port really lead.
#
# In front of it sit two cheaper checks that catch the obvious mistakes with a
# clear message: RMC_DB_NAME must be letters, digits and underscores ending in
# `_shapes` or `_test`, and RMC_DB_HOST must be loopback. Neither proves the
# target is local or disposable — a tunnel on 127.0.0.1 reaches anywhere, and a
# real database may happen to end in `_test` — which is why the marker exists.
#
# Every variable the run needs is validated before anything is destroyed. Do not
# relax any of this to point the script at a database that matters.
#
# A fixture left over from before the marker existed will be refused. Drop it by
# hand once, and the script will recreate and stamp it.
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

die() { echo "reset-live-stack: refusing — $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Everything below runs BEFORE anything is destroyed. This script drops a
# database, which cannot be undone, and it reads its target out of the
# environment — so an inherited or mistyped RMC_DB_NAME, or a jwt file nobody
# sourced, must stop it here rather than halfway through. A `set -e` failure
# after the drop would leave an empty, unprovisioned database behind.
# ---------------------------------------------------------------------------

# First line: the name must look like a fixture and the host must be this
# machine. Both are cheap, and both are weak — a tunnel on 127.0.0.1 reaches
# anywhere, and a real database may happen to end in _test. The marker check
# further down is the one that actually holds; these two only turn the obvious
# mistakes into a clear message.
#
# The name is matched whole, not just by suffix. A glob suffix would accept a
# name containing a newline, and a name beginning with `-`, which `dropdb` would
# read as an option rather than a database — the same failure as a wrong target,
# by a different door.
if ! [[ $name =~ ^[A-Za-z0-9_]+$ ]]; then
  die "RMC_DB_NAME must be letters, digits and underscores only; got '$name'"
fi
case $name in
  *_shapes|*_test) ;;
  *) die "RMC_DB_NAME must name a test database, ending in _shapes or _test; got '$name'" ;;
esac
case $host in
  127.0.0.1|::1|localhost) ;;
  *) die "RMC_DB_HOST must be loopback (127.0.0.1, ::1 or localhost); got '$host'" ;;
esac
case $port in
  ''|*[!0-9]*) die "RMC_DB_PORT must be a number; got '$port'" ;;
esac

for tool in psql dropdb createdb dotnet; do
  command -v "$tool" >/dev/null || die "$tool is not on PATH"
done
# `command -v dotnet` does not prove the EF tool is installed, and a missing
# `dotnet ef` would otherwise surface only after the database had been dropped.
dotnet ef --version >/dev/null 2>&1 ||
  die "the EF tool is not installed (dotnet tool install --global dotnet-ef)"

[ -n "${PGPASSWORD:-}" ] || die "PGPASSWORD is not set"
[ -n "$credentials" ] || die "RMC_CREDENTIALS_FILE is not set"
[ -r "$credentials" ] || die "cannot read RMC_CREDENTIALS_FILE at '$credentials'"
[ -s "$credentials" ] || die "RMC_CREDENTIALS_FILE at '$credentials' is empty"
[ -d "$repo" ] || die "no backend repo at '$repo' (set RMC_BACKEND_REPO)"
[ -d "$repo/src/Anchal.Api" ] || die "'$repo' does not look like the backend repo: no src/Anchal.Api"

# `provision` validates these four at startup and throws without them, by which
# point the database would already be gone. The same rules, checked up front.
[ -n "${Anchal__Jwt__Secret:-}" ] || die "Anchal__Jwt__Secret is not set; source your jwt env file"
secret_bytes=$(printf '%s' "$Anchal__Jwt__Secret" | wc -c)
[ "$secret_bytes" -ge 32 ] || die "Anchal__Jwt__Secret must be at least 32 bytes; got $secret_bytes"
[ -n "${Anchal__Jwt__Issuer:-}" ] || die "Anchal__Jwt__Issuer is not set; source your jwt env file"
[ -n "${Anchal__Jwt__Audience:-}" ] || die "Anchal__Jwt__Audience is not set; source your jwt env file"
expiry=${Anchal__Jwt__ExpiryMinutes:-}
case $expiry in
  ''|*[!0-9]*) die "Anchal__Jwt__ExpiryMinutes must be a whole number from 1 to 1440; got '$expiry'" ;;
esac
[ "$expiry" -ge 1 ] && [ "$expiry" -le 1440 ] ||
  die "Anchal__Jwt__ExpiryMinutes must be from 1 to 1440; got '$expiry'"

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

# The check that actually holds. Every database this script creates is stamped
# with this exact comment, and it refuses to drop one that is not stamped. So a
# database it did not create is never dropped — whatever it is called, and
# wherever the host and port really lead.
marker='rmc-anchal live-spec fixture; created by tests/browser/reset-live-stack.sh; safe to drop'

# No rows means the database does not exist yet, which is fine: it is about to
# be created. One row means it exists, and then the comment has to match.
present=$(psql -h "$host" -p "$port" -U "$user" -d postgres -v ON_ERROR_STOP=1 \
  -t -A -q -v target="$name" <<'SQL'
select 'PRESENT|' || coalesce(shobj_description(oid, 'pg_database'), '')
  from pg_database where datname = :'target';
SQL
)
if [ -n "$present" ]; then
  found=${present#PRESENT|}
  [ "$found" = "$marker" ] || die "'$name' on $host:$port already exists and does not carry this
  script's marker, so it was not created here and will not be dropped.
    expected comment: $marker
         got comment: ${found:-(none)}
  If it really is a disposable fixture, drop it by hand first."
fi

echo "reset-live-stack: recreating $name on $host:$port as $user"

# A client still attached — a Kestrel that was not stopped, an open psql — makes
# DROP DATABASE fail outright, so they are disconnected first. The name goes in
# as a psql variable written `:'target'`, which psql expands to a properly quoted
# SQL literal: the shell quoting around it protects the shell, not the SQL, and a
# database name may legally contain a quote. Fed on stdin rather than with -c,
# because -c sends its argument to the server without interpolating variables.
psql -h "$host" -p "$port" -U "$user" -d postgres -v ON_ERROR_STOP=1 -q \
  -v target="$name" >/dev/null <<'SQL'
select pg_terminate_backend(pid) from pg_stat_activity
  where datname = :'target' and pid <> pg_backend_pid();
SQL

dropdb -h "$host" -p "$port" -U "$user" --if-exists -- "$name"
createdb -h "$host" -p "$port" -U "$user" -- "$name"

# Stamp it immediately, so the next run can tell this database apart from one
# somebody else made. `format('%I'/%L')` quotes the identifier and the literal;
# COMMENT ON DATABASE takes an identifier, which no psql variable can supply
# directly, so the statement is built and then run with \gexec.
psql -h "$host" -p "$port" -U "$user" -d postgres -v ON_ERROR_STOP=1 -q \
  -v target="$name" -v marker="$marker" >/dev/null <<'SQL'
select format('comment on database %I is %L', :'target', :'marker') \gexec
SQL

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
