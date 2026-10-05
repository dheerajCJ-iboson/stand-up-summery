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
- Group the summary by app. Use a short, readable app name (derive it from the APP heading; drop paths/noise).
- Every bullet must make clear which part of that app it affected (e.g. API, CRM agent, deployment, docs, tests) based on files/areas, even if the commit message doesn't say.
- If an app name is generic (e.g. "app", "api"), qualify it using the path it came from.
- Focus on outcomes, not individual commits. Merge related commits into one point.
- Do NOT include commit hashes, branch names, or file paths in the output.
- IGNORE merge commits, version bumps, and trivial refactors unless impactful.
- Do not invent work that isn't supported by the commits or files.

### Output Format:

**What I accomplished on ${date}:**

**<App name>**
- <clear, outcome-focused point>
- <clear, outcome-focused point>

**<Another app name>**
- <clear, outcome-focused point>

**Key Highlights:**
- <most impactful achievement, mention the app>
- <important fix or improvement, mention the app>

### Tone:
- Simple, clean, and professional
- No raw commit text
- Slack/Teams ready

### Commit Log:
${commitData}
`;