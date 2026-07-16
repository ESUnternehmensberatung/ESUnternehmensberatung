# Token Optimization — Detailed Reference

Numbers, templates, and rationale backing the fix catalog in SKILL.md.
Sources listed at the bottom.

## Why context size is the whole game

- Claude Code sessions start with roughly 20,000–30,000 tokens of baseline context
  (system prompt, tool schemas, CLAUDE.md, rules, MCP) before the user types anything.
- Every turn re-sends the accumulated context. Fixed overhead is a per-message tax.
- Prompt caching softens the cost of *repeated* content but does not eliminate it,
  and cache misses (edits near the top of context, long gaps) re-bill in full.
- Model quality also degrades as context fills — cutting tokens improves both cost
  and answer quality.

## 1. CLAUDE.md diet

**Benchmark:** 3,847-token CLAUDE.md stripped to 312 tokens = 91.9% reduction, no
measured quality regression. A well-scoped CLAUDE.md for a real project is usually
300–600 tokens.

**Keep** (things Claude cannot infer from the code):
- Non-obvious build/test/deploy commands (`make dev-db`, not `npm test`)
- Hard constraints ("never touch generated/ — regenerate with make gen")
- Architecture decisions with a "why" ("we use polling not websockets because …")
- Compact instructions (see §8)

**Delete:**
- Code style rules a formatter/linter already enforces
- Descriptions of the directory layout (Claude can `ls`)
- Long workflow instructions → move to skills
- Anything duplicated in README

**Slim template:**

```markdown
# <Project>

## Commands
- Build: <cmd>        # only if non-obvious
- Test one file: <cmd>
- Lint/typecheck: <cmd>

## Constraints
- <hard rule Claude must never violate>

## Architecture notes
- <non-obvious decision + one-line why>
```

## 2. Path-scoped rules

Unscoped `.claude/rules/*.md` load at session start, always. With `paths:`
frontmatter they load lazily on first touch of a matching file:

```yaml
---
paths:
  - "src/api/**"
  - "migrations/*.sql"
---
```

One documented case: 41% overhead reduction just from adding `paths:` to existing
rules. Rule of thumb: a rule that applies to less than the whole repo gets `paths:`.

## 3. Deny lists vs .claudeignore

- `.claudeignore` — advisory; keeps files out of casual scans.
- `permissions.deny` in `.claude/settings.json` — enforced; blocks the Read tool.

Use both. Deny-list candidates: `node_modules/`, `dist/`, `build/`, `.next/`,
`vendor/`, `target/`, `coverage/`, `*.lock`, `package-lock.json`, `yarn.lock`,
`pnpm-lock.yaml`, generated code, large fixtures, minified bundles, `.min.js`.

## 4. MCP overhead

- Each configured server historically added 10,000–20,000 tokens of tool schemas per
  session; several servers commonly totalled 50,000–70,000 tokens — used or not.
- Current Claude Code defers MCP tool definitions by default (tool-search): only
  names load until a tool is used. Verify this is active; don't disable it.
- `/context` shows per-server consumption; `/mcp` disables servers per-session.
- CLI tools beat MCP for context efficiency: `gh`, `aws`, `gcloud`, `sentry-cli`,
  `kubectl` add zero schema overhead.
- Web content: raw HTML pages average ~38,000 tokens; a markdown-extraction step
  (e.g. Firecrawl, jina reader, `pandoc`) gets the same page to ~3,000 (-94%).

## 5. Hook: filter test output {#hook-filter-test-output}

`settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "~/.claude/hooks/filter-test-output.sh" }
        ]
      }
    ]
  }
}
```

`~/.claude/hooks/filter-test-output.sh` (make executable):

```bash
#!/bin/bash
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command')

if [[ "$cmd" =~ ^(npm test|pytest|go test) ]]; then
  filtered_cmd="$cmd 2>&1 | grep -A 5 -E '(FAIL|ERROR|error:)' | head -100"
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"$filtered_cmd\"}}}"
else
  echo "{}"
fi
```

Same pattern works for linters, builds, and log greps. Typical compression: 80–99%.

## 6. Model routing

| Task | Model | How |
|---|---|---|
| Default coding | Sonnet | `/model` or `/config` default |
| Architecture, gnarly multi-file bugs | Opus | switch per-task with `/model` |
| Subagent exploration, log reading, boilerplate | Haiku | `model: haiku` in agent frontmatter, or `CLAUDE_CODE_SUBAGENT_MODEL=haiku` |

Reported savings from routing alone: up to 75%.

**Thinking tokens** bill as output tokens; default budgets can be tens of thousands
per request. For simple work: lower `/effort`, disable thinking in `/config`, or set
`MAX_THINKING_TOKENS=8000` (fixed-budget models only; adaptive-reasoning models use
effort levels instead).

## 7. Session habits

- **`/clear` between unrelated tasks.** Stale context taxes every later message.
  `/rename` first so `/resume` can find the session again.
- **`/compact <instructions>`** — e.g. `/compact Focus on code samples and API usage`.
  Compact at natural phase boundaries (after research, before implementation), not
  only when forced. Reported savings 40–70% on focused tasks.
- **`/rewind`** (or double-Escape) after a failed approach removes the dead end from
  context entirely — better than compacting it.
- **Plan mode** (Shift+Tab) before complex tasks: structured plan→build→verify
  sessions measured ~14% fewer tokens than unstructured ones, mostly from avoided
  rework.
- **Subagents** for verbose operations: their context is separate; only the summary
  returns. Example measurement: subagent read 6,100 tokens of files, returned a
  420-token result — ~5,700 tokens never touched the main window.
- **Specific prompts.** "Add input validation to login() in auth.ts" reads one file;
  "improve the codebase" triggers a broad scan.
- **Verification targets in the prompt** (expected output, failing test) let Claude
  self-check instead of iterating with the user — fewer round trips.

## 8. Compact instructions

In CLAUDE.md:

```markdown
# Compact instructions
When compacting, preserve: current task state, list of files touched, failing
tests and their errors, decisions made. Drop: full file contents, exploration
dead-ends, verbose tool output.
```

## 9. Skills as progressive disclosure

Skill descriptions cost ~30–100 tokens each at startup; the SKILL.md body loads only
on invocation. Therefore: any instruction block in CLAUDE.md longer than ~15 lines
that applies to a *specific* workflow belongs in a skill instead. Aim: CLAUDE.md
< 200 lines, skills carry the depth.

## Sources

- Anthropic — Manage costs effectively: https://code.claude.com/docs/en/costs
- Anthropic — Best practices for Claude Code: https://code.claude.com/docs/en/best-practices
- Firecrawl — 12 Ways to Cut Token Consumption: https://www.firecrawl.dev/blog/claude-code-token-efficiency
- ClaudeLog — How to Optimize Claude Code Token Usage: https://claudelog.com/faqs/how-to-optimize-claude-code-token-usage/
- claudefa.st — Context management guide: https://claudefa.st/blog/guide/mechanics/context-management
