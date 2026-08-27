#!/usr/bin/env sh
set -eu

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "[task-shell] STOP: run inside the canonical mamaGo repository." >&2
  exit 2
fi
cd "$repo_root"

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "dev" ]; then
  echo "[task-shell] STOP: install shortcuts from the canonical dev checkout, not '$current_branch'." >&2
  exit 2
fi

shell_name="$(basename "${SHELL:-zsh}")"
case "$shell_name" in
  zsh) rc_file="$HOME/.zshrc" ;;
  bash) rc_file="$HOME/.bashrc" ;;
  *)
    echo "[task-shell] STOP: supported shells are zsh and bash; current: $shell_name" >&2
    exit 2
    ;;
esac

start_marker="# >>> mamago task workflow >>>"
end_marker="# <<< mamago task workflow <<<"
mkdir -p "$(dirname "$rc_file")"
touch "$rc_file"

if grep -Fq "$start_marker" "$rc_file"; then
  tmp_rc="$(mktemp -t mamago-shell-rc.XXXXXX)"
  trap 'rm -f "$tmp_rc"' EXIT HUP INT TERM
  awk -v start="$start_marker" -v end="$end_marker" '
    $0 == start { skip = 1; next }
    $0 == end { skip = 0; next }
    !skip { print }
  ' "$rc_file" > "$tmp_rc"
  cat "$tmp_rc" > "$rc_file"
fi

quote_single() {
  # Inside a shell single-quoted value, an apostrophe must be encoded as '\''.
  # Four backslashes are required here so sed emits one literal backslash.
  printf "%s" "$1" | sed "s/'/'\\\\''/g"
}
repo_quoted="$(quote_single "$repo_root")"

cat >> "$rc_file" <<EOF_BLOCK

$start_marker
export MAMAGO_REPO='$repo_quoted'

_mamago_use_node22() {
  if command -v node >/dev/null 2>&1 && [ "\$(node -p 'process.versions.node.split(\".\")[0]' 2>/dev/null)" = "22" ]; then
    return 0
  fi
  if type nvm >/dev/null 2>&1; then
    nvm use 22 --silent >/dev/null || return 1
    return 0
  fi
  if command -v fnm >/dev/null 2>&1; then
    eval "\$(fnm env)"
    fnm use 22 >/dev/null || return 1
    return 0
  fi
  echo "mamaGo: Node 22.x is required. Install/use Node 22 (nvm or fnm recommended)." >&2
  return 1
}

mgtask() {
  _mamago_use_node22 || return 1
  (cd "\$MAMAGO_REPO" && sh scripts/git/task-start.sh "\$@") || return 1
  local common_git_dir target
  common_git_dir="\$(git -C "\$MAMAGO_REPO" rev-parse --git-common-dir)" || return 1
  case "\$common_git_dir" in
    /*) ;;
    *) common_git_dir="\$MAMAGO_REPO/\$common_git_dir" ;;
  esac
  target="\$(cat "\$common_git_dir/mamago-last-worktree")" || return 1
  cd "\$target" || return 1
}

mgcheck() {
  _mamago_use_node22 || return 1
  sh "\$(git rev-parse --show-toplevel)/scripts/git/task-check.sh" "\$@"
}

mgfinish() {
  _mamago_use_node22 || return 1
  sh "\$(git rev-parse --show-toplevel)/scripts/git/task-finish.sh" "\$@"
}
$end_marker
EOF_BLOCK

echo "[task-shell] Installed/updated shortcuts in $rc_file"
echo "[task-shell] Activate now with: source $rc_file"
echo "[task-shell] Then use: mgtask <slug> [prefix], mgcheck, mgfinish"
