import { basename, join, relative, resolve } from "@std/path";
import { config } from "./config/env.ts";
import { loadRepoConfig, RepoConfig } from "./config/repos.ts";
import { DateRange, rangeIncludesToday, toGitRange } from "./dates.ts";

export interface CommitInfo {
  hash: string;
  subject: string;
  date: string;
  branches: string[];
  repoPath: string;
  repoName: string;
  /** Human-friendly app name (repos.json name, package name, or path relative to the scan root). */
  appName: string;
  /** Changed files, trimmed to a reasonable count. */
  files: string[];
  /** Top-level areas/folders touched (e.g. "api", "docs", "deploy"). */
  areas: string[];
  /** Trimmed, noise-filtered diff. */
  diff: string;
  tickets: string[];
  patchId: string;
}

export interface InProgressInfo {
  appName: string;
  branch: string;
  files: string[];
}

export interface PullRequestInfo {
  appName: string;
  title: string;
  branch: string;
  state: string;
}

export interface GitData {
  commits: CommitInfo[];
  inProgress: InProgressInfo[];
  prs: PullRequestInfo[];
  repoCount: number;
}

const DEFAULT_IGNORE_DIRS = ["node_modules", ".git", "dist", "build"];
const DEFAULT_MAX_DEPTH = 5;
const MAX_FILES_PER_COMMIT = 15;
const MAX_WIP_FILES = 15;
const DIFF_EXCLUDES = [
  ":(exclude)*.lock",
  ":(exclude)*lock.json",
  ":(exclude)*lock.yaml",
  ":(exclude)*.svg",
  ":(exclude)*.min.js",
  ":(exclude)*.map",
];
const TICKET_RE = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;

const decoder = new TextDecoder();

async function git(
  cwd: string,
  args: string[],
  stdin?: string,
): Promise<{ ok: boolean; out: string }> {
  const cmd = new Deno.Command("git", {
    args,
    cwd,
    stdin: stdin === undefined ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  if (stdin !== undefined) {
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(stdin));
    await writer.close();
  }
  const res = await child.output();
  return { ok: res.success, out: decoder.decode(res.stdout).trim() };
}

function matchesConfig(list: string[], repoPath: string, rootPath: string): boolean {
  const rel = relative(rootPath, repoPath);
  return list.some((k) => k === basename(repoPath) || k === rel);
}

async function detectAppName(
  repoPath: string,
  rootPath: string,
  repoConfig: RepoConfig,
): Promise<string> {
  const rel = relative(rootPath, repoPath) || basename(repoPath);
  const friendly = repoConfig.names[basename(repoPath)] ?? repoConfig.names[rel];
  if (friendly) return friendly;
  for (const file of ["package.json", "deno.json"]) {
    try {
      const json = JSON.parse(await Deno.readTextFile(join(repoPath, file)));
      if (typeof json.name === "string" && json.name) {
        return json.name === rel ? json.name : `${json.name} (${rel})`;
      }
    } catch {
      // file missing or invalid, try next
    }
  }
  return rel;
}

/** Keeps only meaningful changed lines and collapses file headers. */
function condenseDiff(patch: string, maxChars: number): { files: string[]; diff: string } {
  const files: string[] = [];
  const lines: string[] = [];
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const path = line.split(" b/").at(-1) ?? "";
      files.push(path);
      lines.push(`# ${path}`);
    } else if (
      (line.startsWith("+") || line.startsWith("-")) &&
      !line.startsWith("+++") && !line.startsWith("---") && line.slice(1).trim()
    ) {
      lines.push(line.length > 160 ? `${line.slice(0, 160)}…` : line);
    }
  }
  let diff = lines.join("\n");
  if (diff.length > maxChars) diff = `${diff.slice(0, maxChars)}\n…(truncated)`;
  return { files, diff };
}

async function getCommitsFromRepo(
  repoPath: string,
  author: string,
  range: DateRange,
  appName: string,
): Promise<CommitInfo[]> {
  const { since, until } = toGitRange(range);
  const args = [
    "log",
    "--all",
    "--no-merges",
    `--since=${since}`,
    `--until=${until}`,
    "--date=short",
    "--pretty=format:%H%x1f%s%x1f%ad",
  ];
  if (author) args.push(`--author=${author}`);

  const log = await git(repoPath, args);
  if (!log.ok) throw new Error(`Git log failed in ${repoPath}`);
  if (!log.out) return [];

  const commits: CommitInfo[] = [];
  for (const line of log.out.split("\n").filter(Boolean)) {
    const [hash, subject = "", date = ""] = line.split("\x1f");
    if (!hash) continue;

    const branches = (await git(repoPath, [
      "branch",
      "--contains",
      hash,
      "--format=%(refname:short)",
    ])).out.split("\n").map((b) => b.trim()).filter(Boolean);

    const patch = (await git(repoPath, [
      "show",
      "--unified=0",
      "--no-color",
      "--pretty=format:",
      hash,
      "--",
      ".",
      ...DIFF_EXCLUDES,
    ])).out;

    const { files, diff } = condenseDiff(patch, config.diffChars);
    const patchId = patch
      ? (await git(repoPath, ["patch-id", "--stable"], patch + "\n")).out.split(" ")[0] || hash
      : hash;
    const areas = [...new Set(files.map((f) => (f.includes("/") ? f.split("/")[0] : "(root)")))];
    const tickets = [...new Set(`${subject} ${branches.join(" ")}`.match(TICKET_RE) ?? [])];

    commits.push({
      hash,
      subject,
      date,
      branches,
      repoPath,
      repoName: basename(repoPath),
      appName,
      files: files.slice(0, MAX_FILES_PER_COMMIT),
      areas,
      diff,
      tickets,
      patchId,
    });
  }
  return commits;
}

/** Cheap scan for long ranges: titles and file names only, no diffs or branch lookups. */
async function getCompactCommitsFromRepo(
  repoPath: string,
  author: string,
  range: DateRange,
  appName: string,
): Promise<CommitInfo[]> {
  const { since, until } = toGitRange(range);
  const args = [
    "log", "--all", "--no-merges", `--since=${since}`, `--until=${until}`,
    "--date=short", "--name-only", "--pretty=format:%x1e%H%x1f%s%x1f%ad",
  ];
  if (author) args.push(`--author=${author}`);

  const log = await git(repoPath, args);
  if (!log.ok) throw new Error(`Git log failed in ${repoPath}`);
  if (!log.out) return [];

  const noise = /(\.lock|lock\.json|lock\.yaml|\.svg|\.min\.js|\.map)$/;
  const commits: CommitInfo[] = [];
  for (const block of log.out.split("\x1e").filter((b) => b.trim())) {
    const [header, ...rest] = block.split("\n");
    const [hash, subject = "", date = ""] = header.split("\x1f");
    if (!hash) continue;
    const files = rest.map((f) => f.trim()).filter((f) => f && !noise.test(f));
    commits.push({
      hash,
      subject,
      date,
      branches: [],
      repoPath,
      repoName: basename(repoPath),
      appName,
      files: files.slice(0, 8),
      areas: [...new Set(files.map((f) => (f.includes("/") ? f.split("/")[0] : "(root)")))],
      diff: "",
      tickets: [...new Set(subject.match(TICKET_RE) ?? [])],
      // No patch-id here (too slow over long ranges); same repo + day + title is a good enough key.
      patchId: `${appName}|${date}|${subject}`,
    });
  }
  return commits;
}

async function getInProgress(repoPath: string, appName: string): Promise<InProgressInfo | undefined> {
  const status = await git(repoPath, ["status", "--porcelain"]);
  if (!status.ok || !status.out) return undefined;
  const files = status.out.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  if (!files.length) return undefined;
  const branch = (await git(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"])).out;
  return { appName, branch, files: files.slice(0, MAX_WIP_FILES) };
}

async function getPullRequests(
  repoPath: string,
  appName: string,
  range: DateRange,
): Promise<PullRequestInfo[]> {
  try {
    const res = await new Deno.Command("gh", {
      args: [
        "pr", "list", "--author", "@me", "--state", "all", "--limit", "30",
        "--json", "title,headRefName,updatedAt,state",
      ],
      cwd: repoPath,
      stdout: "piped",
      stderr: "null",
    }).output();
    if (!res.success) return [];
    const list = JSON.parse(decoder.decode(res.stdout)) as {
      title: string;
      headRefName: string;
      updatedAt: string;
      state: string;
    }[];
    return list
      .filter((pr) => {
        const updated = new Date(pr.updatedAt);
        return pr.state === "OPEN" || (updated >= range.from && updated < new Date(range.to.getTime() + 86_400_000));
      })
      .map((pr) => ({ appName, title: pr.title, branch: pr.headRefName, state: pr.state }));
  } catch {
    return []; // gh not installed or not authenticated
  }
}

export async function findGitRepositories(
  repoPath: string,
  maxDepth = DEFAULT_MAX_DEPTH,
  ignoreDirs: string[] = DEFAULT_IGNORE_DIRS,
): Promise<string[]> {
  const rootPath = resolve(repoPath === "." ? Deno.cwd() : repoPath);
  const repos = new Set<string>();
  const visited = new Set<string>();

  async function walk(currentPath: string, depth: number) {
    if (depth > maxDepth || visited.has(currentPath)) return;
    visited.add(currentPath);

    const entries: Deno.DirEntry[] = [];
    try {
      for await (const entry of Deno.readDir(currentPath)) entries.push(entry);
    } catch {
      return;
    }

    if (entries.some((entry) => entry.isDirectory && entry.name === ".git")) {
      repos.add(currentPath);
    }

    for (const entry of entries) {
      if (!entry.isDirectory || ignoreDirs.includes(entry.name)) continue;
      await walk(join(currentPath, entry.name), depth + 1);
    }
  }

  await walk(rootPath, 0);
  return [...repos].sort();
}

export async function getGitData(
  repoPath: string,
  author: string,
  range: DateRange,
  options: { maxDepth?: number; includePrs?: boolean; detail?: "full" | "compact" } = {},
): Promise<GitData> {
  const { maxDepth = DEFAULT_MAX_DEPTH, includePrs = false, detail = "full" } = options;
  const compact = detail === "compact";
  try {
    const rootPath = resolve(repoPath === "." ? Deno.cwd() : repoPath);
    const repoConfig = await loadRepoConfig();
    const repositories = (await findGitRepositories(repoPath, maxDepth)).filter(
      (r) => !matchesConfig(repoConfig.ignore, r, rootPath),
    );
    if (repositories.length === 0) {
      throw new Error(`No git repositories found in ${repoPath}`);
    }

    const wantWip = !compact && rangeIncludesToday(range);
    const all: CommitInfo[] = [];
    const inProgress: InProgressInfo[] = [];
    const prs: PullRequestInfo[] = [];

    for (const repository of repositories) {
      const appName = await detectAppName(repository, rootPath, repoConfig);
      all.push(
        ...await (compact ? getCompactCommitsFromRepo : getCommitsFromRepo)(repository, author, range, appName),
      );
      if (wantWip) {
        const wip = await getInProgress(repository, appName);
        if (wip) inProgress.push(wip);
      }
      if (includePrs && !compact) prs.push(...await getPullRequests(repository, appName, range));
    }

    // Same change cherry-picked / rebased onto several branches counts once.
    const seen = new Set<string>();
    const commits = all.filter((c) => {
      if (seen.has(c.patchId)) return false;
      seen.add(c.patchId);
      return true;
    });

    return { commits, inProgress, prs, repoCount: repositories.length };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch git commits: ${error.message}`);
    }
    throw error;
  }
}
