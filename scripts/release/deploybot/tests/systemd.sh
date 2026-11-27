#!/usr/bin/env bash
# Called at the end of integration.sh (disposable CI runner only): the real unit
# file under real systemd, with the sshd and gate that script already set up.
#
#   systemd.sh <source dir> <keys dir>
set -euo pipefail
[[ "${CI:-}" == true && "${RUNNER_ENVIRONMENT:-}" == github-hosted ]] || { echo "refusing to run outside a disposable CI runner" >&2; exit 2; }
src="$1" keys="$2"
unit=/etc/systemd/system/mamago-bot.service

sudo useradd --system --home /var/lib/mamago-deploy-bot --shell /usr/sbin/nologin mamago-bot
sudo cp -r "$src/mamago_deploy" /opt/mamago-deploy/
sudo python3 -m venv /opt/mamago-deploy/venv
sudo /opt/mamago-deploy/venv/bin/pip install --quiet -r "$src/requirements.txt"
sudo install -d -m 700 -o mamago-bot /etc/mamago-deploy/keys
for name in dev prod; do sudo install -m 600 -o mamago-bot "$keys/$name" "/etc/mamago-deploy/keys/$name"; done
sudo install -m 644 "$keys/known_hosts" /etc/mamago-deploy/keys/known_hosts
python3 -c '
import json, sys
keys = "/etc/mamago-deploy/keys"
host = {"type": "ssh", "address": "127.0.0.1", "port": 2222, "user": sys.argv[1],
        "identity_files": {"dev": f"{keys}/dev", "prod": f"{keys}/prod"}, "known_hosts": f"{keys}/known_hosts"}
environment = lambda strict: {"host": "ci-host", "operations": ["status"], "strict": strict}
print(json.dumps({"hosts": {"ci-host": host}, "environments": {"dev": environment(False), "prod": environment(True)}}))
' "$USER" | sudo tee /etc/mamago-deploy/registry.json >/dev/null
echo '{"owner_ids":[1]}' | sudo tee /etc/mamago-deploy/access.json >/dev/null
# Not a token: aiogram rejects it before any network request.
echo invalid-on-purpose | sudo bash "$src/set-secret.sh" bot_token

printf '[Unit]\nDescription=stand-in for the legacy bot\n[Service]\nExecStart=/bin/sleep infinity\n' | sudo tee "$unit" >/dev/null
sudo systemctl daemon-reload
sudo systemctl start mamago-bot.service
legacy_sum="$(sha256sum "$unit")"
legacy_pid="$(systemctl show -p MainPID --value mamago-bot.service)"
switch() { sudo env WAIT_SECONDS=15 SETTLE_SECONDS=3 bash "$src/switch-bot.sh" "$@" 2>&1; }
untouched() { [[ "$(sha256sum "$unit")" == "$legacy_sum" && "$(systemctl is-active mamago-bot.service)" == active ]]; }

echo "--- a missing credential is caught before the running bot is touched"
if out="$(switch switch)"; then echo "switch must fail"; exit 1; fi
echo "$out"
untouched
[[ "$(systemctl show -p MainPID --value mamago-bot.service)" == "$legacy_pid" ]]

echo "--- pre-check passes in the real sandbox, the bot then fails, the old unit returns"
echo invalid-on-purpose | sudo bash "$src/set-secret.sh" ghcr_token
if out="$(switch switch)"; then echo "switch must fail"; exit 1; fi
echo "$out"
for needle in "PASS credential bot_token" "PASS dev: gate" "PASS prod: gate" "pre-check passed" "previous bot is running again"; do
  grep -qF "$needle" <<<"$out" || { echo "missing: $needle"; exit 1; }
done
untouched

echo "--- explicit rollback"
switch rollback
untouched
echo "SYSTEMD PASS: sandbox pre-check, credentials, automatic and manual rollback"
