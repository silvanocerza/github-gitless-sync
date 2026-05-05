import { Vault, normalizePath } from "obsidian";
import ignore, { Ignore } from "ignore";

export const GITIGNORE_FILE_NAME = ".gitignore" as const;

export function createGitignoreMatcher(patterns = ""): Ignore {
  return ignore().add(patterns);
}

/**
 * Loads root vault rules and returns a matcher equivalent to gitignore.
 */
export async function loadGitignoreMatcher(vault: Vault): Promise<Ignore> {
  const matcher = createGitignoreMatcher();
  const gitignorePath = normalizePath(GITIGNORE_FILE_NAME);

  if (await vault.adapter.exists(gitignorePath)) {
    matcher.add(await vault.adapter.read(gitignorePath));
  }

  return matcher;
}

/**
 * Normalizes Obsidian paths to the relative format expected by the parser.
 */
export function isGitignored(
  matcher: Ignore | null,
  filePath: string,
  isDirectory = false,
): boolean {
  if (!matcher || filePath === "") {
    return false;
  }

  const normalizedPath = normalizePath(filePath);
  const pathToTest =
    isDirectory && !normalizedPath.endsWith("/")
      ? `${normalizedPath}/`
      : normalizedPath;

  return matcher.ignores(pathToTest);
}
