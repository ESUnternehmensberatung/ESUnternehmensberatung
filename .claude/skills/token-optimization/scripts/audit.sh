#!/usr/bin/env bash
# Token-overhead audit for a Claude Code project.
# Usage: bash audit.sh [project-dir]   (default: current directory)
# Read-only: changes nothing, prints a findings report.
set -uo pipefail

DIR="${1:-.}"
cd "$DIR" || { echo "error: cannot cd to $DIR" >&2; exit 1; }

est_tokens() { # tokens ~= bytes / 4
  local bytes
  bytes=$(wc -c <"$1" 2>/dev/null || echo 0)
  echo $(( bytes / 4 ))
}

findings=0
note() { findings=$((findings + 1)); printf '  [%s] %s\n' "$1" "$2"; }

echo "== Claude Code token audit: $(pwd) =="
echo

# --- 1. CLAUDE.md / AGENTS.md size --------------------------------------
echo "-- Memory files (loaded EVERY session) --"
found_mem=0
while IFS= read -r f; do
  found_mem=1
  t=$(est_tokens "$f")
  l=$(wc -l <"$f")
  if [ "$t" -gt 500 ]; then
    note WARN "$f: ~${t} tokens / ${l} lines (target < 500 tokens, < 200 lines) — trim or move workflows to skills"
  else
    note OK "$f: ~${t} tokens / ${l} lines"
  fi
done < <(find . -maxdepth 3 -name CLAUDE.md -o -maxdepth 3 -name AGENTS.md 2>/dev/null | grep -v node_modules)
[ "$found_mem" -eq 0 ] && echo "  (none found)"
echo

# --- 2. Unscoped rules ---------------------------------------------------
echo "-- .claude/rules (unscoped rules load in every session) --"
if [ -d .claude/rules ]; then
  unscoped=0
  while IFS= read -r f; do
    if ! head -20 "$f" | grep -q '^paths:'; then
      unscoped=1
      note WARN "$f: no 'paths:' frontmatter — ~$(est_tokens "$f") tokens in every session; add path scoping"
    fi
  done < <(find .claude/rules -name '*.md' 2>/dev/null)
  [ "$unscoped" -eq 0 ] && note OK "all rules are path-scoped"
else
  echo "  (no .claude/rules directory)"
fi
echo

# --- 3. MCP servers ------------------------------------------------------
echo "-- MCP servers (schemas can cost 10-20k tokens each) --"
for f in .mcp.json "$HOME/.claude.json"; do
  if [ -f "$f" ]; then
    n=$(grep -o '"command"\|"url"' "$f" 2>/dev/null | wc -l)
    if [ "$n" -gt 3 ]; then
      note WARN "$f: ~${n} server entries — run /context to check overhead, /mcp to disable unused ones"
    else
      note OK "$f: ~${n} server entries"
    fi
  fi
done
[ ! -f .mcp.json ] && [ ! -f "$HOME/.claude.json" ] && echo "  (no MCP config found)"
echo

# --- 4. Deny list & claudeignore ------------------------------------------
echo "-- Read protection --"
if [ -f .claude/settings.json ] && grep -q '"deny"' .claude/settings.json; then
  note OK ".claude/settings.json has permissions.deny"
else
  note WARN "no permissions.deny in .claude/settings.json — one accidental lockfile read costs 10k+ tokens"
fi
if [ -f .claudeignore ]; then
  note OK ".claudeignore present"
else
  note INFO "no .claudeignore (advisory, but cheap to add)"
fi
echo

# --- 5. Heavyweight readables ---------------------------------------------
echo "-- Heavyweight files/dirs Claude could accidentally read --"
heavy=0
for d in node_modules dist build .next vendor target coverage; do
  [ -d "$d" ] && { heavy=1; note INFO "$d/ exists — ensure it is deny-listed"; }
done
for f in package-lock.json yarn.lock pnpm-lock.yaml Cargo.lock poetry.lock; do
  [ -f "$f" ] && { heavy=1; note INFO "$f (~$(est_tokens "$f") tokens if read) — deny-list '**/*.lock' patterns"; }
done
[ "$heavy" -eq 0 ] && echo "  (nothing notable)"
echo

echo "== Done: $findings findings. Fix WARNs first — see SKILL.md fix catalog. =="
