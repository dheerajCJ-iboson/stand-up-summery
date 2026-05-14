import { basename, join, resolve } from "@std/path";

export interface CommitInfo {
  hash: string;
  subject: string;
  branches: string[];
  repoPath: string;
  repoName: string;
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
): Promise<CommitInfo[]> {
  const { since, until } = formatDateRange(date);
  const args = [
    "log",
    `--since=${since}`,
    `--until=${until}`,
    "--pretty=format:%H%x1f%s",
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
  console.log("commitLines",commitLines);
  const commits: CommitInfo[] = [];

  for (const line of commitLines) {
    const [hash, subject = ""] = line.split("\x1f");
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

    commits.push({
      hash,
      subject,
      branches,
      repoPath,
      repoName: basename(repoPath),
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

    const allCommits: CommitInfo[] = [];
    for (const repository of repositories) {
      const repoCommits = await getGitCommitsFromRepo(repository, author, date);
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
