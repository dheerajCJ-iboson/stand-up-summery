export const STANDUP_PROMPT_TEMPLATE = (
  commitData: string,
  date: string,
): string => `
You are an expert software engineer assistant.

I will provide a list of git commits made on ${date} across multiple repositories.

Your task is to generate a concise, professional **Stand-up Summary** focused only on meaningful work.

### Input:
Commits are grouped under "## APP: <name>" headings. Each commit has its message, the top-level areas touched, and the changed files. The commit message may be vague, so use the app name, areas and file paths to work out WHAT was actually changed and in WHICH app.

### Instructions:
- Write 5 to 8 bullets MAXIMUM (never 10 or more). Fewer is better.
- Each bullet is ONE short, plain sentence, the way a person would say it out loud in a stand-up. Max ~20 words.
- Organize by TASK/THEME, not by app. If one piece of work touched several apps (e.g. config cleanup, deployment docs, env variables), write it as a single bullet and, if useful, say "across services" instead of listing them.
- Only name an app when it is truly specific to that one piece of work and helps the listener (e.g. "in the CRM agent"). Never use "App (Sub-area):" prefixes or bold labels. Never list many app names in one bullet.
- Use the app name, areas and file paths only to understand what really changed; do not copy them into the output.
- Merge related commits into one point. Skip minor items (tiny config tweaks, comment changes, test-only tweaks) unless they are part of a bigger bullet.
- Do NOT include commit hashes, branch names, or file paths.
- IGNORE merge commits and version bumps.
- Do not invent work that isn't supported by the commits or files.

### Output Format:

**What I accomplished on ${date}:**
- <short, human sentence>
- <short, human sentence>

**Key Highlights:**
- <1 to 2 short lines only, the most impactful items>

### Tone:
- Casual-professional, like speaking to teammates
- No raw commit text, no jargon dumps
- Slack/Teams ready

### Commit Log:
${commitData}
`;