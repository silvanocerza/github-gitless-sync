import { requestUrl } from "obsidian";

export type RepoContent = {
  files: { [key: string]: GetTreeResponseItem };
  sha: string;
};

/**
 * Represents a single item in a tree response from the GitHub API.
 */
export type GetTreeResponseItem = {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size: number;
  url: string;
};

export type NewTreeRequestItem = {
  path: string;
  mode: string;
  type: string;
  sha?: string | null;
  content?: string;
};

/**
 * Represents a git blob response from the GitHub API.
 */
export type BlobFile = {
  sha: string;
  node_id: string;
  size: number;
  url: string;
  content: string;
  encoding: string;
};

export default class GithubClient {
  constructor(
    private token: string,
    private owner: string,
    private repo: string,
    private branch: string,
  ) {}

  headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /**
   * Gets the content of the repo.
   *
   * @returns Array of files in the directory in the remote repo
   */
  async getRepoContent(): Promise<RepoContent> {
    const res = await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${this.branch}?recursive=1`,
      headers: this.headers(),
    });
    const files = res.json.tree
      .filter((file: GetTreeResponseItem) => file.type === "blob")
      .reduce(
        (
          acc: { [key: string]: GetTreeResponseItem },
          file: GetTreeResponseItem,
        ) => ({ ...acc, [file.path]: file }),
        {},
      );
    return { files, sha: res.json.sha };
  }

  async createTree(tree: { tree: NewTreeRequestItem[]; base_tree: string }) {
    const res = await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees`,
      headers: this.headers(),
      method: "POST",
      body: JSON.stringify(tree),
    });
    return res.json.sha;
  }

  async createCommit(message: string, treeSha: string, parent: string) {
    const res = await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/git/commits`,
      headers: this.headers(),
      method: "POST",
      body: JSON.stringify({
        message: message,
        tree: treeSha,
        parents: [parent],
      }),
    });
    return res.json.sha;
  }

  async getBranchHeadSha() {
    const res = await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/git/refs/heads/${this.branch}`,
      headers: this.headers(),
    });
    return res.json.object.sha;
  }

  async updateBranchHead(sha: string) {
    await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/git/refs/heads/${this.branch}`,
      headers: this.headers(),
      method: "PATCH",
      body: JSON.stringify({
        sha: sha,
      }),
    });
  }

  /**
   * Gets a blob from a blob url
   * @param url blob url
   */
  async getBlob(url: string): Promise<BlobFile> {
    const res = await requestUrl({
      url: url,
      headers: this.headers(),
    });
    return res.json;
  }

  /**
   * Create a new file in the repo, the content must be base64 encoded or the request will fail.
   *
   * @param message commit message
   * @param path path to create in the repo
   * @param content base64 encoded content of the file
   */
  async createFile(path: string, content: string, message: string) {
    await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`,
      headers: this.headers(),
      method: "PUT",
      body: JSON.stringify({
        message: message,
        content: content,
        branch: this.branch,
      }),
    });
  }
}
