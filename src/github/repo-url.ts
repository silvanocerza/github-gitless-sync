/**
 * Everything needed to build the REST API URLs of a repository.
 * The API base URL never ends with a slash.
 */
export type RepoTarget = {
  owner: string;
  repo: string;
  apiBaseUrl: string;
};

/**
 * Result of resolving the repository settings, the error is meant to be shown to the user.
 */
export type ResolvedRepoTarget =
  { valid: true; target: RepoTarget } | { valid: false; error: string };

const GITHUB_COM_HOSTNAMES = ["github.com", "www.github.com"];

// GitHub only allows these characters in owner and repository names
const OWNER_OR_REPO_PATTERN = /^[A-Za-z0-9._-]+$/;

const HAS_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

/**
 * Parses an HTTP URL, assuming HTTPS if the scheme is missing.
 *
 * @param rawUrl URL to parse, can be surrounded by whitespace
 * @returns The parsed URL, or null if it's not a valid HTTP URL
 */
function parseHttpUrl(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (trimmed === "") {
    return null;
  }
  try {
    const url = new URL(
      HAS_SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Derives the REST API base URL of the instance hosting a repository.
 * This is different for self-hosted ghe vs github hosted by github itself
 */
function deriveApiBaseUrl(url: URL): string {
  const hostname = url.hostname.toLowerCase();
  if (GITHUB_COM_HOSTNAMES.includes(hostname)) {
    return "https://api.github.com"; // main github
  }
  if (hostname.endsWith(".ghe.com")) { // github-hosted enterprise cloud
    return `https://api.${hostname}`;
  }
  return `${url.protocol}//${url.host}/api/v3`; // someone's self-hosted ghe server
}

/**
 * Resolves the repository and API base URL to use for requests.
 *
 * Extra path segments are ignored so that the URL of any repository page works,
 * same goes for the `.git` suffix of clone URLs.
 *
 * @param repoUrl Full URL of the repository to sync
 * @param apiBaseUrlOverride API base URL to use instead of the derived one, can be empty
 * @returns The resolved target, or the reason why the settings are not valid
 */
export function resolveRepoTarget(
  repoUrl: string,
  apiBaseUrlOverride: string,
): ResolvedRepoTarget {
  const url = parseHttpUrl(repoUrl);
  if (url === null) {
    return {
      valid: false,
      error:
        "Invalid repository URL, it must look like https://github.com/owner/repository",
    };
  }

  const segments = url.pathname.split("/").filter((s) => s !== "");
  if (segments.length < 2) {
    return {
      valid: false,
      error:
        "The repository URL must contain both owner and repository name, " +
        "like https://github.com/owner/repository",
    };
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/, "");
  if (!OWNER_OR_REPO_PATTERN.test(owner) || !OWNER_OR_REPO_PATTERN.test(repo)) {
    return {
      valid: false,
      error: `Invalid owner or repository name in the repository URL: "${owner}/${repo}"`,
    };
  }

  let apiBaseUrl = deriveApiBaseUrl(url);
  if (apiBaseUrlOverride.trim() !== "") {
    const override = parseHttpUrl(apiBaseUrlOverride);
    if (override === null) {
      return {
        valid: false,
        error:
          "Invalid API base URL, it must look like https://github.example.com/api/v3",
      };
    }
    // A trailing slash would end up in the middle of every request URL
    apiBaseUrl = `${override.protocol}//${override.host}${override.pathname.replace(/\/+$/, "")}`;
  }

  return { valid: true, target: { owner, repo, apiBaseUrl } };
}
