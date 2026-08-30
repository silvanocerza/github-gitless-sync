import test from "node:test";
import * as assert from "node:assert/strict";
import { resolveRepoTarget } from "./repo-url";

test("resolves repository URLs", () => {
  const cases: [string, string][] = [
    ["https://github.com/owner/repo", "https://api.github.com"],
    ["https://www.github.com/owner/repo", "https://api.github.com"],
    // Enterprise Server serves the API on the same host
    [
      "https://github.example.com/owner/repo",
      "https://github.example.com/api/v3",
    ],
    [
      "http://github.internal:8443/owner/repo",
      "http://github.internal:8443/api/v3",
    ],
    // Enterprise Cloud tenants have a dedicated API subdomain
    ["https://acme.ghe.com/owner/repo", "https://api.acme.ghe.com"],
    // Forms users are likely to paste: clone URL, trailing slash, no scheme,
    // surrounding whitespace, URL of a page inside the repository, query and fragment
    ["https://github.com/owner/repo.git", "https://api.github.com"],
    ["https://github.com/owner/repo/", "https://api.github.com"],
    ["github.com/owner/repo", "https://api.github.com"],
    ["  https://github.com/owner/repo  ", "https://api.github.com"],
    ["https://github.com/owner/repo/tree/main/notes", "https://api.github.com"],
    ["https://github.com/owner/repo?tab=readme#top", "https://api.github.com"],
  ];
  for (const [repoUrl, apiBaseUrl] of cases) {
    assert.deepEqual(
      resolveRepoTarget(repoUrl, ""),
      { valid: true, target: { owner: "owner", repo: "repo", apiBaseUrl } },
      repoUrl,
    );
  }
});

test("keeps the case of owner and repository", () => {
  assert.deepEqual(
    resolveRepoTarget("https://GitHub.com/Owner/My.Repo-1_2", ""),
    {
      valid: true,
      target: {
        owner: "Owner",
        repo: "My.Repo-1_2",
        apiBaseUrl: "https://api.github.com",
      },
    },
  );
});

test("refuses URLs that don't point to a repository", () => {
  const cases = [
    "",
    "   ",
    "not a url",
    "ftp://github.com/owner/repo",
    // SSH remotes can't be used with the REST API
    "git@github.com:owner/repo.git",
    "https://github.com",
    "https://github.com/owner",
    "https://github.com//repo",
    // Characters GitHub doesn't allow in owner and repository names
    "https://github.com/ow ner/repo",
    "https://github.com/owner/re%20po",
  ];
  for (const repoUrl of cases) {
    assert.equal(resolveRepoTarget(repoUrl, "").valid, false, repoUrl);
  }
});

test("prefers the API base URL override over the derived one", () => {
  const overridden = (override: string) =>
    resolveRepoTarget("https://github.example.com/owner/repo", override);

  assert.deepEqual(overridden("https://api.example.com/v3/"), {
    valid: true,
    target: {
      owner: "owner",
      repo: "repo",
      apiBaseUrl: "https://api.example.com/v3",
    },
  });
  // A blank override is ignored, an unparsable one is refused instead
  assert.deepEqual(overridden("   "), {
    valid: true,
    target: {
      owner: "owner",
      repo: "repo",
      apiBaseUrl: "https://github.example.com/api/v3",
    },
  });
  assert.equal(overridden("ftp://api.example.com").valid, false);
});
