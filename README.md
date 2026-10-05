# Stand-up Summery

A Deno CLI that scans your git repos for a day (or a range), reads what actually changed, and asks an LLM to write a short, human stand-up.

## Setup
1. Install [Deno](https://deno.com) and copy `.env.example` to `.env`.
2. Pick a provider in `.env` (`LLM_PROVIDER=gemini | ollama | openai`) and set its key/host. Ollama cloud models (e.g. `gemma4:31b-cloud`) work through the local Ollama daemon.
3. Optional: copy `repos.example.json` to `repos.json` to give repos friendly names or ignore some.

## Usage
```bash
deno task start            # interactive: asks Today / Yesterday / date / range / week / roll-up
deno task start --yesterday
deno task start -d 05-10-2026 -f slack --verify
deno task start --from 29-09-2026 --to 03-10-2026
deno task start --rollup   # merge this week's saved summaries
deno task start --help
```
Summaries are saved to `summery/` (git-ignored).

## What makes it smart
- Reads condensed diffs, files and areas, not just commit messages; scans all branches and dedupes cherry-picks.
- Includes uncommitted work (when the range includes today) and, with `--prs`, GitHub PR titles.
- Knows the previous summary so multi-day work says "continued".
- Writes accomplishments, next/in-progress and blockers; `--verify` fact-checks it.
- Falls back to `LLM_FALLBACK_PROVIDER` if the primary fails; output as slack/markdown/plain, optional `--post` to Slack.

See `IMPROVEMENT_PLAN.md` for the task list and status.

## Layout
- `src/cli.ts` interactive CLI and flags · `src/git.ts` repo scanning · `src/summary.ts` prompt building, fallback, verify
- `src/llm/` providers · `src/config/` env, prompts, repos · `src/store.ts` saved summaries · `src/format.ts` output formats
