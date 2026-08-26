#!/usr/bin/env sh
set -eu

source_repo="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$source_repo" ]; then
  echo "[task-workflow-test] STOP: run from the repository." >&2
  exit 2
fi

tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/mamago-task-workflow.XXXXXX")"
trap 'rm -rf "$tmp_root"' EXIT HUP INT TERM

remote="$tmp_root/remote.git"
canonical="$tmp_root/canonical"
updater="$tmp_root/updater"
worktrees="$tmp_root/worktrees"
home_dir="$tmp_root/home"

quiet_git() {
  git "$@" >/dev/null 2>&1
}

git init --bare "$remote" >/dev/null
quiet_git clone "$remote" "$canonical"

git -C "$canonical" config user.email task-workflow-test@example.com
git -C "$canonical" config user.name "Task Workflow Test"
mkdir -p "$canonical/scripts/git"
cp "$source_repo/scripts/git/session-start-gate.sh" "$canonical/scripts/git/session-start-gate.sh"
cp "$source_repo/scripts/git/task-start.sh" "$canonical/scripts/git/task-start.sh"
cp "$source_repo/scripts/git/task-sync.sh" "$canonical/scripts/git/task-sync.sh"
cp "$source_repo/scripts/git/install-shell-shortcuts.sh" "$canonical/scripts/git/install-shell-shortcuts.sh"
printf 'init\n' > "$canonical/README.md"
git -C "$canonical" add README.md scripts/git
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

echo "[task-workflow-test] PASS"
