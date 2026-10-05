import { basename, join, relative, resolve } from "@std/path";

export interface CommitInfo {
  hash: string;
  subject: string;
  branches: string[];
  repoPath: string;
  repoName: string;
  /** Human-friendly app name (package name, or path relative to the scan root). */
  appName: string;
  /** Changed files, trimmed to a reasonable count. */
  files: string[];
  /** Top-level areas/folders touched (e.g. "api", "docs", "deploy"). */
  areas: string[];
  isMerge: boolean;
}

const MAX_FILES_PER_COMMIT = 15;

async function runGit(cwd: string, args: string[]): Promise<string> {
  const out = await new Deno.Command("git", { args, cwd }).output();
  return new TextDecoder().decode(out.stdout).trim();
}

async function detectAppName(repoPath: string, rootPath: string): Promise<string> {
  const fallback = relative(rootPath, repoPath) || basename(repoPath);
  for (const file of ["package.json", "deno.json"]) {
    try {
      const json = JSON.parse(await Deno.readTextFile(join(repoPath, file)));
      if (typeof json.name === "string" && json.name) {
        return json.name === fallback ? json.name : `${json.name} (${fallback})`;
      }
    } catch {
      // file missing or invalid, try next
    }
  }
  return fallback;
}

const DEFAULT_IGNORE_DIRS = ["node_modules", ".git", "dist", "build"];
const DEFAULT_MAX_DEPTH = 5;

function formatDateRange(date: string) {
  const [day, month, year] = date.split("-");
  if (!day || !month || !year) {
    throw new Error("Date must be in dd-mm-yyyy format.");
  }
  return {
    since: `${year}-${month}-${day} 00:00:00`,
    until: `${year}-${month}-${day} 23:59:59`,
  };
}

async function getGitCommitsFromRepo(
  repoPath: string,
  author: string,
  date: string,
  rootPath: string,
): Promise<CommitInfo[]> {
  const appName = await detectAppName(repoPath, rootPath);
  const { since, until } = formatDateRange(date);
  const args = [
    "log",
    `--since=${since}`,
    `--until=${until}`,
    "--pretty=format:%H%x1f%s%x1f%P",
  ];
  if (author) {
    args.push(`--author=${author}`);
  }

  const command = new Deno.Command("git", {
    args,
    cwd: repoPath,
  });

  const { stdout, stderr, success } = await command.output();
  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Git log failed in ${repoPath}: ${error}`);
  }

  const output = new TextDecoder().decode(stdout).trim();
  if (!output) return [];

  const commitLines = output.split("\n").filter((line) => line.length > 0);
  const commits: CommitInfo[] = [];

  for (const line of commitLines) {
    const [hash, subject = "", parents = ""] = line.split("\x1f");
    if (!hash) continue;

    const branchCommand = new Deno.Command("git", {
      args: ["branch", "--contains", hash, "--format=%(refname:short)"],
      cwd: repoPath,
    });
    const branchOutput = await branchCommand.output();
    const branches = new TextDecoder()
      .decode(branchOutput.stdout)
      .split("\n")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const isMerge = parents.trim().split(/\s+/).filter(Boolean).length > 1;
    const allFiles = isMerge
      ? []
      : (await runGit(repoPath, ["show", "--name-only", "--pretty=format:", hash]))
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);
    const areas = [
      ...new Set(allFiles.map((f) => (f.includes("/") ? f.split("/")[0] : "(root)"))),
    ];

    commits.push({
      hash,
      subject,
      branches,
      repoPath,
      repoName: basename(repoPath),
      appName,
      files: allFiles.slice(0, MAX_FILES_PER_COMMIT),
      areas,
      isMerge,
    });
  }

  return commits;
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
      for await (const entry of Deno.readDir(currentPath)) {
        entries.push(entry);
      }
    } catch {
      return;
    }

    if (entries.some((entry) => entry.isDirectory && entry.name === ".git")) {
      repos.add(currentPath);
    }

    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      if (ignoreDirs.includes(entry.name)) continue;
      await walk(join(currentPath, entry.name), depth + 1);
    }
  }

  await walk(rootPath, 0);
  return [...repos].sort();
}

export async function getGitCommits(
  repoPath: string,
  author: string,
  date: string,
  maxDepth = DEFAULT_MAX_DEPTH,
): Promise<CommitInfo[]> {
  try {
    const repositories = await findGitRepositories(repoPath, maxDepth);
    if (repositories.length === 0) {
      throw new Error(`No git repositories found in ${repoPath}`);
    }

    const rootPath = resolve(repoPath === "." ? Deno.cwd() : repoPath);
    const allCommits: CommitInfo[] = [];
    for (const repository of repositories) {
      const repoCommits = await getGitCommitsFromRepo(repository, author, date, rootPath);
      allCommits.push(...repoCommits);
    }

    return allCommits;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch git commits: ${error.message}`);
    }
    throw error;
  }
}
