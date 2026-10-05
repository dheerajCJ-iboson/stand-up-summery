import { dirname, fromFileUrl, join } from "@std/path";

export interface RepoConfig {
  /** Repo folder names or paths (relative to the scan root) to skip. */
  ignore: string[];
  /** Friendly names, keyed by folder name or relative path. */
  names: Record<string, string>;
}

export async function loadRepoConfig(): Promise<RepoConfig> {
  const file = join(dirname(fromFileUrl(import.meta.url)), "../../repos.json");
  try {
    const raw = JSON.parse(await Deno.readTextFile(file));
    return {
      ignore: Array.isArray(raw.ignore) ? raw.ignore.map(String) : [],
      names: raw.names && typeof raw.names === "object" ? raw.names : {},
    };
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`⚠️  Could not read repos.json: ${(error as Error).message}`);
    }
    return { ignore: [], names: {} };
  }
}
