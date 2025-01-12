import { Vault, requestUrl, normalizePath } from "obsidian";
import MetadataStore from "../metadata-store";

/**
 * Represents a single item in a tree response from the GitHub API.
 */
type TreeItem = {
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
type BlobFile = {
  sha: string;
  node_id: string;
  size: number;
  url: string;
  content: string;
  encoding: string;
};

export default class GithubClient {
  constructor(
    private vault: Vault,
    private metadataStore: MetadataStore,
    private token: string,
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
   * If repoContentDir is an empty string all files in the repo will be returned.
   *
   * @param owner Owner of the repo
   * @param repo Name of the repo
   * @param repoContentDir Directory in the repo to download relative to the root of the repo
   * @param branch Branch to download from
   * @returns Array of files in the directory in the remote repo
   */
  async getRepoContent(
    owner: string,
    repo: string,
    repoContentDir: string,
    branch: string,
  ): Promise<TreeItem[]> {
    const res = await requestUrl({
      url: `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      headers: this.headers(),
    });
    const files = res.json["tree"].filter(
      (file: TreeItem) =>
        file.type === "blob" && file.path.startsWith(repoContentDir),
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
   * Downloads a single file from GitHub. If the file already exists locally it will be overwritten.
   *
   * @param file file info from the GitHub API
   * @param repoContentDir directory in the repo to download relative to the root of the repo
   * @param localContentDir local directory to download to
   */
  async downloadFile(
    file: TreeItem,
    repoContentDir: string,
    localContentDir: string,
  ) {
    const url = file.url;
    const destinationFile = file.path.replace(repoContentDir, localContentDir);
    const fileMetadata = this.metadataStore.data[destinationFile];
    if (fileMetadata && fileMetadata.sha === file.sha) {
      // File already exists and has the same SHA, no need to download it again.
      return;
    }

    const blob = await this.getBlob(url);
    const destinationFolder = normalizePath(
      destinationFile.split("/").slice(0, -1).join("/"),
    );
    if (!(await this.vault.adapter.exists(destinationFolder))) {
      await this.vault.adapter.mkdir(destinationFolder);
    }
    this.vault.adapter.writeBinary(
      normalizePath(destinationFile),
      Buffer.from(blob.content, "base64"),
    );
    this.metadataStore.data[destinationFile] = {
      localPath: destinationFile,
      remotePath: file.path,
      sha: file.sha,
      dirty: false,
      justDownloaded: true,
    };
    await this.metadataStore.save();
  }

  /**
   * Recursively downloads the repo content to the local vault.
   * The repository directory structure is kept as is.
   *
   * @param owner Owner of the repo
   * @param repo Name of the repo
   * @param repoContentDir Directory in the repo to download relative to the root of the repo
   * @param branch Branch to download from
   * @param localContentDir Local directory to download to
   */
  async downloadRepoContent(
    owner: string,
    repo: string,
    repoContentDir: string,
    branch: string,
    localContentDir: string,
  ) {
    const files = await this.getRepoContent(
      owner,
      repo,
      repoContentDir,
      branch,
    );

    await Promise.all(
      files.map(async (file: TreeItem) =>
        this.downloadFile(file, repoContentDir, localContentDir),
      ),
    );
  }

  /**
   * Upload a single file to GitHub.
   * All the file information needed to upload the file is take form the metadata store.
   *
   * @param owner Owner of the repo
   * @param repo Name of the repo
   * @param branch Branch to download from
   * @param filePath local file path to upload
   */
  async uploadFile(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ) {
    const { remotePath } = this.metadataStore.data[filePath];

    const normalizedFilePath = normalizePath(filePath);
    if (!(await this.vault.adapter.exists(normalizedFilePath))) {
      throw new Error(`Can't find file ${filePath}`);
    }

    const buffer = await this.vault.adapter.readBinary(normalizedFilePath);
    const content = Buffer.from(buffer).toString("base64");
    const res = await requestUrl({
      url: `https://api.github.com/repos/${owner}/${repo}/contents/${remotePath}`,
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        message: `Edit ${remotePath}`,
        branch: branch,
        content: content,
        sha: this.metadataStore.data[filePath].sha,
      }),
    });
  }

  /**
   * Gets the SHA of a file in the remote repo given its local path.
   *
   * @param owner Owner of the repo
   * @param repo Name of the repo
   * @param branch Branch to download from
   * @param filePath local file path to upload
   * @returns sha of the file as string
   */
  async getFileSha(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ) {
    const { remotePath } = this.metadataStore.data[filePath];
    const res = await requestUrl({
      url: `https://api.github.com/repos/${owner}/${repo}/contents/${remotePath}?ref=${branch}`,
      headers: this.headers(),
    });
    return res.json.sha;
  }

  /**
   * Delete a single file from GitHub.
   * All the file information needed to delete the file is take form the metadata store.
   *
   * @param owner Owner of the repo
   * @param repo Name of the repo
   * @param branch Branch to download from
   * @param filePath local file path that has been deleted
   */
  async deleteFile(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ) {
    const { remotePath } = this.metadataStore.data[filePath];
    const res = await requestUrl({
      url: `https://api.github.com/repos/${owner}/${repo}/contents/${remotePath}`,
      method: "DELETE",
      headers: this.headers(),
      body: JSON.stringify({
        message: `Delete ${remotePath}`,
        branch: branch,
        sha: this.metadataStore.data[filePath].sha,
      }),
    });
  }
}
