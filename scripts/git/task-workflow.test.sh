#!/usr/bin/env sh
set -eu

source_repo="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$source_repo" ]; then
  echo "[task-workflow-test] STOP: run from the repository." >&2
  exit 2
fi

tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/mamago-task-workflow.XXXXXX")"
# macOS /var is a symlink; Git reports the physical /private/var path.
tmp_root="$(cd "$tmp_root" && pwd -P)"
trap 'rm -rf "$tmp_root"' EXIT HUP INT TERM

remote="$tmp_root/remote.git"
canonical="$tmp_root/canonical"
updater="$tmp_root/updater"
worktrees="$tmp_root/worktrees"
home_dir="$tmp_root/home"

quiet_git() {
  git "$@" >/dev/null 2>&1
}

# Stub pnpm: records calls so the test never touches the network or a real install.
stub_bin="$tmp_root/bin"
pnpm_log="$tmp_root/pnpm.log"
mkdir -p "$stub_bin"
cat > "$stub_bin/pnpm" <<'STUB'
#!/usr/bin/env sh
printf '%s\n' "$*" >> "$PNPM_STUB_LOG"
if [ "$*" = 'exec prisma generate' ]; then
  mkdir -p node_modules/@prisma/client node_modules/.prisma/client
  printf '{"name":"@prisma/client","main":"index.js"}\n' > node_modules/@prisma/client/package.json
  printf '' > node_modules/@prisma/client/index.js
  printf '// generated client\n' > node_modules/.prisma/client/index.js
  printf '// generated types\n' > node_modules/.prisma/client/index.d.ts
fi
STUB
chmod +x "$stub_bin/pnpm"
PATH="$stub_bin:$PATH"
PNPM_STUB_LOG="$pnpm_log"
export PATH PNPM_STUB_LOG

git init --bare "$remote" >/dev/null
quiet_git clone "$remote" "$canonical"

git -C "$canonical" config user.email task-workflow-test@example.com
git -C "$canonical" config user.name "Task Workflow Test"
mkdir -p "$canonical/scripts/git"
cp "$source_repo/scripts/git/session-start-gate.sh" "$canonical/scripts/git/session-start-gate.sh"
cp "$source_repo/scripts/git/task-start.sh" "$canonical/scripts/git/task-start.sh"
cp "$source_repo/scripts/git/task-sync.sh" "$canonical/scripts/git/task-sync.sh"
cp "$source_repo/scripts/git/worktree-deps.sh" "$canonical/scripts/git/worktree-deps.sh"
cp "$source_repo/scripts/git/worktree-fingerprint.cjs" "$canonical/scripts/git/worktree-fingerprint.cjs"
cp "$source_repo/scripts/git/install-shell-shortcuts.sh" "$canonical/scripts/git/install-shell-shortcuts.sh"
printf 'init\n' > "$canonical/README.md"
printf 'node_modules/\n' > "$canonical/.gitignore"
mkdir -p "$canonical/prisma"
printf '// schema fixture\n' > "$canonical/prisma/schema.prisma"
git -C "$canonical" add README.md scripts/git .gitignore prisma
git -C "$canonical" commit -m "test: initialize dev" >/dev/null
git -C "$canonical" branch -M dev
quiet_git -C "$canonical" push -u origin dev

base_head="$(git -C "$canonical" rev-parse HEAD)"
(
  cd "$canonical"
  MAMAGO_WORKTREES_DIR="$worktrees" sh scripts/git/task-start.sh demo-task fix >/dev/null
)
first_worktree="$(cat "$canonical/.git/mamago-last-worktree")"
[ "$(git -C "$first_worktree" rev-parse HEAD)" = "$base_head" ] || {
  echo "[task-workflow-test] task-start did not preserve exact BASE_HEAD" >&2
  exit 1
}
[ "$(git -C "$first_worktree" branch --show-current)" = "fix/demo-task-$(date +%Y%m%d)" ] || {
  echo "[task-workflow-test] task-start created an unexpected branch name" >&2
  exit 1
}

# task-start must install deps and generate the client itself, never symlink node_modules.
grep -qx 'install --frozen-lockfile' "$pnpm_log" && grep -qx 'exec prisma generate' "$pnpm_log" || {
  echo "[task-workflow-test] task-start did not run pnpm install + prisma generate" >&2
  exit 1
}
[ ! -L "$first_worktree/node_modules" ] || {
  echo "[task-workflow-test] task-start must not symlink node_modules" >&2
  exit 1
}

printf 'task\n' > "$first_worktree/task.txt"
git -C "$first_worktree" add task.txt
git -C "$first_worktree" commit -m "fix: task change" >/dev/null

quiet_git clone "$remote" "$updater"
git -C "$updater" config user.email task-workflow-test@example.com
git -C "$updater" config user.name "Task Workflow Test"
quiet_git -C "$updater" checkout dev
printf 'dev\n' > "$updater/dev.txt"
git -C "$updater" add dev.txt
git -C "$updater" commit -m "chore: advance dev" >/dev/null
quiet_git -C "$updater" push origin dev

# Any visible WIP, including untracked files, must block reconciliation.
printf 'untracked\n' > "$first_worktree/untracked.txt"
set +e
(
  cd "$first_worktree"
  sh scripts/git/task-sync.sh >/dev/null 2>&1
)
dirty_status=$?
set -e
[ "$dirty_status" -eq 3 ] || {
  echo "[task-workflow-test] untracked task work must stop task-sync" >&2
  exit 1
}
rm "$first_worktree/untracked.txt"

(
  cd "$first_worktree"
  sh scripts/git/task-sync.sh >/dev/null
)
git -C "$first_worktree" merge-base --is-ancestor origin/dev HEAD || {
  echo "[task-workflow-test] task-sync did not reconcile non-overlapping dev changes" >&2
  exit 1
}

# The canonical checkout is now stale; task-start must use the gate-approved
# fast-forward and still create the next worktree from exact fresh origin/dev.
(
  cd "$canonical"
  MAMAGO_WORKTREES_DIR="$worktrees" sh scripts/git/task-start.sh overlap-task feat >/dev/null
)
second_worktree="$(cat "$canonical/.git/mamago-last-worktree")"
[ "$(git -C "$second_worktree" rev-parse HEAD)" = "$(git -C "$canonical" rev-parse origin/dev)" ] || {
  echo "[task-workflow-test] stale canonical dev was not safely fast-forwarded before task creation" >&2
  exit 1
}

printf 'task overlap\n' >> "$second_worktree/README.md"
git -C "$second_worktree" add README.md
git -C "$second_worktree" commit -m "feat: overlap task" >/dev/null

quiet_git -C "$updater" pull --ff-only origin dev
printf 'dev overlap\n' >> "$updater/README.md"
git -C "$updater" add README.md
git -C "$updater" commit -m "chore: overlap dev" >/dev/null
quiet_git -C "$updater" push origin dev

set +e
(
  cd "$second_worktree"
  sh scripts/git/task-sync.sh >/dev/null 2>&1
)
overlap_status=$?
set -e
[ "$overlap_status" -eq 6 ] || {
  echo "[task-workflow-test] overlapping task/dev files must stop automatic reconciliation" >&2
  exit 1
}

# Guard: a node_modules symlink pointing outside the worktree must fail; one inside is fine.
mkdir -p "$tmp_root/shared-nm"
rm -rf "$second_worktree/node_modules"
ln -s "$tmp_root/shared-nm" "$second_worktree/node_modules"
set +e
(cd "$second_worktree" && sh scripts/git/worktree-deps.sh check >/dev/null 2>&1)
symlink_status=$?
set -e
[ "$symlink_status" -eq 10 ] || {
  echo "[task-workflow-test] external node_modules symlink must fail the guard" >&2
  exit 1
}
rm "$second_worktree/node_modules"

# Content-based guard catches schema changes even if a restore preserves mtime.
(cd "$second_worktree" && sh scripts/git/worktree-deps.sh generate >/dev/null)
(cd "$second_worktree" && sh scripts/git/worktree-deps.sh check >/dev/null)
cp -p "$second_worktree/prisma/schema.prisma" "$tmp_root/original-schema"
printf '// changed schema\n' > "$second_worktree/prisma/schema.prisma"
touch -r "$tmp_root/original-schema" "$second_worktree/prisma/schema.prisma"
set +e
(cd "$second_worktree" && sh scripts/git/worktree-deps.sh check >/dev/null 2>&1)
stale_status=$?
set -e
[ "$stale_status" -eq 12 ] || {
  echo "[task-workflow-test] changed schema with preserved mtime must fail (got $stale_status)" >&2
  exit 1
}
(cd "$second_worktree" && sh scripts/git/worktree-deps.sh generate >/dev/null)
(cd "$second_worktree" && sh scripts/git/worktree-deps.sh check >/dev/null)
# Regenerating or replacing a shared client's JS/types must invalidate the guard.
printf '// foreign generated types\n' >> "$second_worktree/node_modules/.prisma/client/index.d.ts"
set +e
(cd "$second_worktree" && sh scripts/git/worktree-deps.sh check >/dev/null 2>&1)
foreign_status=$?
set -e
[ "$foreign_status" -eq 12 ] || {
  echo "[task-workflow-test] changed generated client must fail (got $foreign_status)" >&2
  exit 1
}
rm -rf "$second_worktree/node_modules"

mkdir -p "$home_dir"
(
  cd "$canonical"
  git fetch --quiet origin dev
  git merge --ff-only origin/dev >/dev/null
  HOME="$home_dir" SHELL=/bin/bash sh scripts/git/install-shell-shortcuts.sh >/dev/null
  HOME="$home_dir" SHELL=/bin/bash sh scripts/git/install-shell-shortcuts.sh >/dev/null
)
[ "$(grep -Fc '# >>> mamago task workflow >>>' "$home_dir/.bashrc")" -eq 1 ] || {
  echo "[task-workflow-test] shell shortcut installer must be idempotent" >&2
  exit 1
}
bash -n "$home_dir/.bashrc"

# Repository paths containing an apostrophe must remain valid shell syntax and
# round-trip exactly through MAMAGO_REPO.
quoted_parent="$tmp_root/has'quote"
quoted_repo="$quoted_parent/repo"
quoted_home="$tmp_root/quoted-home"
mkdir -p "$quoted_parent" "$quoted_home"
quiet_git clone "$remote" "$quoted_repo"
quiet_git -C "$quoted_repo" checkout dev
(
  cd "$quoted_repo"
  HOME="$quoted_home" SHELL=/bin/bash sh scripts/git/install-shell-shortcuts.sh >/dev/null
)
bash -n "$quoted_home/.bashrc"
resolved_repo="$(HOME="$quoted_home" bash -c '. "$HOME/.bashrc"; printf "%s" "$MAMAGO_REPO"')"
[ "$resolved_repo" = "$quoted_repo" ] || {
  echo "[task-workflow-test] shell shortcut installer did not preserve an apostrophe-containing repo path" >&2
  exit 1
}

echo "[task-workflow-test] PASS"
