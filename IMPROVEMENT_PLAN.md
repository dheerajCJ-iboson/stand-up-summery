# Improvement Plan

Status legend: `[x]` done, `[~]` partly done / needs your input, `[ ]` not started.

## Interactive CLI
- [x] **T1. Interactive date menu** – on run, ask: Today / Yesterday / Last working day / Specific date / Date range / This week / Weekly roll-up of saved summaries.
- [x] **T2. Interactive options** – ask output format (slack / markdown / plain) and, when a Slack webhook is configured, whether to post.
- [x] **T3. Non-interactive flags** – `--today`, `--yesterday`, `--date`, `--from/--to`, `--week`, `--rollup`, `--format`, `--post`, `--verify`, `--prs`, `--yes`. Skips prompts when stdin is not a terminal or a date flag is given.

## Better input
- [x] **T4. Read the diffs, not just file names** – send a trimmed, noise-filtered diff per commit (lock files excluded, size capped via `DIFF_CHARS`).
- [x] **T5. PR / branch context** – branch names are sent as intent hints; `--prs` also pulls PR titles through the `gh` CLI.
- [x] **T6. Uncommitted work** – include `git status` of dirty repos as "in progress" when the range includes today.
- [~] **T7. Ticket links** – extract ticket IDs (e.g. `ABC-123`) from commits/branches and pass them to the model. Fetching ticket titles from Jira/Linear needs API credentials, so it is **not** done yet.
- [x] **T8. Scan all branches** – use `git log --all` so work on non-checked-out branches is not missed.

## Better output
- [x] **T9. Next / In progress and Blockers sections** – inferred from dirty repos, open PRs and commit evidence; omitted when there is no evidence.
- [x] **T10. Yesterday-aware** – feed the most recent earlier saved summary so multi-day work says "continued" instead of repeating.
- [x] **T11. Weekly roll-up** – merge saved summaries of a range into one short summary.
- [x] **T12. Output formats** – `slack` / `markdown` / `plain`, plus optional posting to `SLACK_WEBHOOK_URL`.

## Smarter scanning
- [x] **T13. `repos.json` config** – friendly app names and a list of repos to ignore (see `repos.example.json`).
- [x] **T14. Date ranges and last working day** – Monday's "last working day" covers Fri–Sun.
- [x] **T15. Dedupe cherry-picks / rebases** – match commits by `git patch-id`.

## Reliability
- [x] **T16. Provider fallback** – `LLM_FALLBACK_PROVIDER` / `LLM_FALLBACK_MODEL` used when the primary fails. Retries reduced so a failure no longer waits ~17 minutes.
- [x] **T17. Hallucination check** – optional second pass (`--verify` or `VERIFY=true`) removes claims not backed by the commits.
- [x] **T18. Errors are never saved as summaries** – LLM failures are reported and no file is written.

## Housekeeping
- [x] **T19. README + `.env.example` updated** for the new flags, providers and config.
- [x] **T20. Fix `test_models.ts`** to use the provider config instead of the Gemini-only key.
