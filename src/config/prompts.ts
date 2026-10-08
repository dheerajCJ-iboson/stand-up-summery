export interface StandupPromptInput {
  label: string;
  commitData: string;
  inProgressData: string;
  prData: string;
  previousSummary?: string;
}

export const STANDUP_PROMPT_TEMPLATE = (i: StandupPromptInput): string => `
You are an expert software engineer assistant.

I will provide git activity for ${i.label} across multiple repositories. Write a concise **Stand-up Summary** focused only on meaningful work.

### Input:
Commits are grouped under "## APP: <name>". Each has its message, branch (intent hint), ticket IDs, areas touched, changed files and a condensed diff. Commit messages are often vague, so use the diff, files and areas to work out WHAT really changed.
There may also be "In progress" (uncommitted changes) and "Pull requests" sections.

### Instructions:
- Write 5 to 10 bullets MAXIMUM under accomplishments (never 15 or more).
- Each bullet is ONE short, plain sentence, the way a person would say it out loud in a stand-up. Max ~20 words.
- Organize by TASK/THEME, not by app. If one piece of work touched several apps, write it as a single bullet ("across services" is fine).
- Only name an app when it is specific to that piece of work and helps the listener (e.g. "in the CRM agent"). No "App (Sub-area):" prefixes, no bold labels, never a list of many app names.
- Mention a ticket ID only if it clearly identifies the work.
- Merge related commits. Skip minor items (tiny config tweaks, comments, test-only tweaks) unless part of a bigger bullet.
- Never include commit hashes, branch names, or file paths in the output.
- Do not invent work that isn't supported by the input.
${i.previousSummary ? `- A previous summary is given below. Do not repeat work already reported there; if today's work clearly continues it, say "continued"/"finished".\n` : ""}
### Output Format:

**What I accomplished on ${i.label}:**
- <short, human sentence>

**Next / In progress:**
- <1 to 3 short lines inferred ONLY from the in-progress changes and open pull requests. Omit this whole section if there is no such evidence.>

**Blockers:**
- <Only if the input shows real evidence (reverts, repeated fixes of the same thing, "WIP", failing/unfinished work). If there is none, omit this whole section, including its heading; never write "None".>

**Key Highlights:**
- <1 to 2 short lines, the most impactful items>

### Tone:
- Casual-professional, like speaking to teammates
- No raw commit text, no jargon dumps
- Slack/Teams ready
${i.previousSummary ? `\n### Previous summary:\n${i.previousSummary}\n` : ""}
### Commit Log:
${i.commitData || "(no commits in this range)"}
${i.inProgressData ? `\n### In progress (uncommitted changes):\n${i.inProgressData}\n` : ""}${i.prData ? `\n### Pull requests:\n${i.prData}\n` : ""}`;

export const VERIFY_PROMPT_TEMPLATE = (draft: string, evidence: string): string => `
You are a strict fact-checker for a developer's stand-up summary.

Below are a DRAFT summary and the EVIDENCE (the real git activity). Remove or correct any statement in the draft that is not supported by the evidence. Do not add new work. Keep the exact same format, tone and brevity. Return ONLY the final summary text, starting directly with the first heading. Do not output the words DRAFT or EVIDENCE or any extra heading.

### DRAFT:
${draft}

### EVIDENCE:
${evidence}
`;

export const ROLLUP_PROMPT_TEMPLATE = (label: string, entries: string): string => `
You are an expert software engineer assistant.

Below are summaries of the smaller periods (weeks or months) that make up ${label}. Merge them into ONE short roll-up for the whole period.

### Instructions:
- 5 to 15 bullets MAXIMUM, each one short plain sentence (max ~20 words).
- Merge repeated or continued work into a single bullet; organize by theme, not by period or app.
- Do not invent anything that isn't in the period summaries.

### Output Format:

**What I accomplished (${label}):**
- <short, human sentence>

**Key Highlights:**
- <1 to 2 short lines>

### Period summaries:
${entries}
`;

export const CHUNK_PROMPT_TEMPLATE = (label: string, commitData: string): string => `
You are an expert software engineer assistant.

Summarize the work done during ${label} from the git activity below (commit titles, areas and files only).

### Instructions:
- 4 to 6 bullets, each one short plain sentence (max ~20 words).
- Group by theme/task, not by app or by commit. Merge related commits.
- Use areas/files only to understand what changed; never output hashes, branch names or file paths.
- Skip trivial items. Do not invent anything.

### Output Format:
- <short, human sentence>

### Commit Log:
${commitData}
`;
