export const STANDUP_PROMPT_TEMPLATE = (
  commitData: string,
  date: string,
): string => `
You are an expert software engineer assistant.

I will provide a list of git commits made on ${date} across multiple repositories.

Your task is to generate a concise, professional **Stand-up Summary** focused only on meaningful work.

### Instructions:
- Use branch names ONLY to understand context (e.g., feature, bugfix), but DO NOT include branch names in the output.
- DO NOT mention repository names, commit hashes, or git-specific details.
- Focus on **end results and outcomes**, not individual commits.
- Combine related commits into **single meaningful points**.
- IGNORE:
  - Merge commits
  - Branch names in output
  - Version bumps
  - Minor refactors unless impactful

### Output Format:

**What I accomplished on ${date}:**
- <clear, outcome-focused point>
- <clear, outcome-focused point>

**Key Highlights:**
- <most impactful achievement>
- <important fix or improvement>

### Tone:
- Simple, clean, and professional
- No prefixes like feature/module names
- No raw commit text
- Slack/Teams ready

### Commit Log:
${commitData}
`;