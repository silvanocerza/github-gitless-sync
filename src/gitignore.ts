import { Vault, normalizePath } from "obsidian";
import ignore, { Ignore } from "ignore";

export const GITIGNORE_FILE_NAME = ".gitignore" as const;

export function createGitignoreMatcher(patterns = ""): Ignore {
  return ignore().add(patterns);
}

/**
 * Carrega as regras da raiz do cofre e devolve um matcher equivalente ao gitignore.
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
 * Normaliza caminhos do Obsidian para o formato relativo esperado pelo parser.
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
