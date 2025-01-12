import { Vault, requestUrl, normalizePath } from "obsidian";
import MetadataStore from "../metadata-store";

/**
 * Represents a single item in a tree response from the GitHub API.
 */
export type TreeItem = {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size: number;
  url: string;
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
    private repoContentDir: string,
  ) {}

  headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /**
   * Gets the content of a directory in the repo.
   * Or the whole repo if repoContentDir is an empty string.
   *
   * @returns Array of files in the directory in the remote repo
   */
  async getRepoContent(): Promise<TreeItem[]> {
    const res = await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${this.branch}?recursive=1`,
      headers: this.headers(),
    });
    const files = res.json["tree"].filter(
      (file: TreeItem) =>
        file.type === "blob" && file.path.startsWith(this.repoContentDir),
    );
    return files;
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
   * Create or edit a remote file to GitHub.
   *
   * @param remoteFilePath Path to remote file
   * @param fileContent Content of the file
   * @param sha SHA of the file
   */
  async uploadFile(
    remoteFilePath: string,
    fileContent: ArrayBuffer,
    sha: string | null,
  ) {
    await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${remoteFilePath}`,
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        message: `Edit ${remoteFilePath}`,
        branch: this.branch,
        content: Buffer.from(fileContent).toString("base64"),
        sha: sha,
      }),
    });
  }

  /**
   * Gets the SHA of a file in the remote repo.
   *
   * @param remoteFilePath Path to remote file
   * @returns sha of the file as string
   */
  async getFileSha(remoteFilePath: string) {
    const res = await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${remoteFilePath}?ref=${this.branch}`,
      headers: this.headers(),
    });
    return res.json.sha;
  }

  /**
   * Delete a single file from GitHub.
   *
   * @param remoteFilePath Path to remote file
   * @param sha SHA of the file
   */
  async deleteFile(remoteFilePath: string, sha: string) {
    await requestUrl({
      url: `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${remoteFilePath}`,
      method: "DELETE",
      headers: this.headers(),
      body: JSON.stringify({
        message: `Delete ${remoteFilePath}`,
        branch: this.branch,
        sha: sha,
      }),
    });
  }
}
