---
name: token-optimization
description: Audits and reduces Claude Code token consumption. Use when the user complains about high token usage, hitting rate/usage limits, expensive sessions, the context window filling up, auto-compact warnings, or asks to cut costs — including German phrasing like "Token sparen", "Verbrauch reduzieren", "zu viele Token", "Kosten senken". Runs a project audit, reports estimated savings, and applies fixes (slim CLAUDE.md, path-scoped rules, deny lists, MCP hygiene, output-filtering hooks, model routing).
---

# Token Optimization for Claude Code

Token cost scales with context size. Every message re-sends the whole context, so
1,000 wasted tokens of fixed overhead cost 1,000 tokens on *every* turn of *every*
session. There are two levers:

1. **Fixed overhead** — what loads at session start (CLAUDE.md, rules, MCP schemas).
   Cut once, saves forever.
2. **Per-task consumption** — what accumulates while working (file reads, tool
   output, failed attempts, thinking tokens). Cut with workflow habits and delegation.

Work the levers in that order: fixed overhead first (measurable, permanent), then
workflow habits.

## Workflow

### Step 1: Audit

Run the audit script from the project root of the repository being optimized:

```bash
bash scripts/audit.sh [project-dir]
```

(Resolve `scripts/audit.sh` relative to this skill's directory.) It measures, without
changing anything:

- Estimated token size of every `CLAUDE.md` / `AGENTS.md` in scope (target: < 500 tokens, < 200 lines)
- `.claude/rules/*.md` files missing `paths:` frontmatter (these load in EVERY session)
- Number of configured MCP servers (`.mcp.json`, `~/.claude.json`)
- Presence of `permissions.deny` in `.claude/settings.json` and of `.claudeignore`
- Heavyweight directories/files Claude might read (lockfiles, `dist/`, generated code)

If the script is unavailable, perform the same checks manually with `wc -c` (tokens ≈ chars / 4),
`grep -L 'paths:'`, and reading the settings files.

### Step 2: Report

Present findings as a table: **finding → estimated tokens wasted per session → fix**.
Be concrete: "CLAUDE.md is ~3,800 tokens; trimming to essentials saves ~3,300 tokens
on every single request." Rank by savings. Reference numbers are in
[references/best-practices.md](references/best-practices.md).

### Step 3: Apply fixes (with approval for destructive edits)

Apply in priority order. Details and templates for each fix are in
[references/best-practices.md](references/best-practices.md).

## Fix catalog (priority order)

### 1. Put CLAUDE.md on a diet — biggest fixed win

Keep **only what Claude cannot infer from the code**: non-obvious build/test commands,
hard constraints, architecture decisions. Delete style guides, obvious facts, long
workflow instructions. Target < 200 lines / < 500 tokens. A benchmark cut 3,847 → 312
tokens (-91.9%) with no quality regression.

Move specialized workflow instructions (PR review process, migration steps, release
checklist) **into skills** — skill descriptions cost ~30–100 tokens at startup; the
body loads only when needed.

### 2. Path-scope your rules

Every `.claude/rules/*.md` without `paths:` frontmatter loads in every session. Add:

```yaml
---
paths:
  - "src/api/**"
---
```

Now the rule enters context only when Claude touches matching files. Reported ~41%
overhead reduction in rule-heavy repos.

### 3. Block reads of junk with permissions.deny

`.claudeignore` is advisory; `permissions.deny` in `.claude/settings.json` actually
blocks reads. Minimum set:

```json
{
  "permissions": {
    "deny": [
      "Read(./node_modules/**)",
      "Read(./dist/**)",
      "Read(./build/**)",
      "Read(./.next/**)",
      "Read(**/*.lock)",
      "Read(./package-lock.json)"
    ]
  }
}
```

A single accidental lockfile read can cost 10,000+ tokens.

### 4. MCP hygiene

Configured MCP servers can add 10,000–20,000 tokens each per session (50k–70k total is
common) whether used or not. Actions:

- `/context` to see what's consuming space; `/mcp` to disable unused servers
- Prefer CLI tools (`gh`, `aws`, `gcloud`, `sentry-cli`) over MCP equivalents — zero
  schema overhead
- Keep tool-search / deferred tool loading enabled (default in current versions)

### 5. Filter verbose output with hooks

Don't let Claude read 10,000 lines of test/log output. A `PreToolUse` hook can rewrite
test commands to pipe through `grep -A 5 -E '(FAIL|ERROR)' | head -100`. Template in
[references/best-practices.md](references/best-practices.md#hook-filter-test-output).
Compression of 80–99% is typical.

### 6. Model routing

- Default model: Sonnet. Reserve Opus for architecture/multi-file debugging.
- Subagents for exploration, log reading, boilerplate: `model: haiku` in the agent
  frontmatter (or `CLAUDE_CODE_SUBAGENT_MODEL=haiku`). Up to ~75% cost cut.
- Lower thinking effort for simple work: `/effort`, or `MAX_THINKING_TOKENS=8000`.

### 7. Session hygiene (teach the user these habits)

| Habit | Effect |
|---|---|
| `/clear` between unrelated tasks (after `/rename`) | stale context stops taxing every message |
| `/compact Focus on code changes and test output` | keeps what matters, drops the rest |
| `/context` + `/usage` (or statusline) | visibility — you can't manage what you can't see |
| Plan mode (Shift+Tab) before big tasks | prevents expensive wrong-direction work (~14% fewer tokens) |
| `/rewind` after failed attempts | removes dead-end context entirely |
| Specific prompts ("fix validation in auth.ts:42", not "improve the codebase") | avoids broad scanning |
| Delegate verbose ops (tests, docs fetching, log analysis) to subagents | only the summary returns to the main context |

### 8. Optional: compact instructions in CLAUDE.md

```markdown
# Compact instructions
When compacting, preserve: current task state, file paths touched, failing tests.
Drop: exploration dead-ends, full file contents, verbose tool output.
```

## Verification

After applying fixes, re-run `scripts/audit.sh` and show before/after numbers. Suggest
the user run `/context` in their next session to confirm reduced baseline.
