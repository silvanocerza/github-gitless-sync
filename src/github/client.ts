import { requestUrl } from "obsidian";
import Logger from "src/logger";
import { GitHubSyncSettings } from "src/settings/settings";
import { retryUntil } from "src/utils";

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
 * Response received when we create a new binary blob on GitHub
 */
export type CreatedBlob = {
  sha: string;
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

/**
 * Custom error to make some stuff easier
 */
class GithubAPIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export default class GithubClient {
  constructor(
    private settings: GitHubSyncSettings,
    private logger: Logger,
  ) {}

  headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.settings.githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /**
   * Gets the content of the repo.
   *
   * @param retry Whether to retry the request on failure (default: false)
   * @param maxRetries Maximum number of retry attempts (default: 5)
   * @returns Array of files in the directory in the remote repo
   */
  async getRepoContent({
    retry = false,
    maxRetries = 5,
  } = {}): Promise<RepoContent> {
    const response = await retryUntil(
      async () => {
        return requestUrl({
          url: `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}/git/trees/${this.settings.githubBranch}?recursive=1`,
          headers: this.headers(),
          throw: false,
        });
      },
      (res) => res.status !== 422, // Retry condition: only retry on 422 status
      retry ? maxRetries : 0, // Use 0 retries if retry is false
    );

    if (response.status < 200 || response.status >= 400) {
      await this.logger.error("Failed to get repo content", response);
      throw new GithubAPIError(
        response.status,
        `Failed to get repo content, status ${response.status}`,
      );
    }

    const files = response.json.tree
      .filter((file: GetTreeResponseItem) => file.type === "blob")
      .reduce(
        (
          acc: { [key: string]: GetTreeResponseItem },
          file: GetTreeResponseItem,
        ) => ({ ...acc, [file.path]: file }),
        {},
      );
    return { files, sha: response.json.sha };
  }

  /**
   * Creates a new tree in the GitHub repository.
   *
   * @param tree The tree object to create
   * @param retry Whether to retry the request on failure (default: false)
   * @param maxRetries Maximum number of retry attempts (default: 5)
   * @returns The SHA of the created tree
   */
  async createTree({
    tree,
    retry = false,
    maxRetries = 5,
  }: {
    tree: { tree: NewTreeRequestItem[]; base_tree: string };
    retry?: boolean;
    maxRetries?: number;
  }) {
    const response = await retryUntil(
      async () => {
        return requestUrl({
          url: `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}/git/trees`,
          headers: this.headers(),
          method: "POST",
          body: JSON.stringify(tree),
          throw: false,
        });
      },
      (res) => res.status !== 422,
      retry ? maxRetries : 0,
    );

    if (response.status < 200 || response.status >= 400) {
      await this.logger.error("Failed to create tree", response);
      throw new GithubAPIError(
        response.status,
        `Failed to create tree, status ${response.status}`,
      );
    }
    return response.json.sha;
  }

  /**
   * Creates a new commit in the repository.
   *
   * @param message The commit message
   * @param treeSha The SHA of the tree
   * @param parent The SHA of the parent commit
   * @param retry Whether to retry the request on failure (default: false)
   * @param maxRetries Maximum number of retry attempts (default: 5)
   * @returns The SHA of the created commit
   */
  async createCommit({
    message,
    treeSha,
    parent,
    retry = false,
    maxRetries = 5,
  }: {
    message: string;
    treeSha: string;
    parent: string;
    retry?: boolean;
    maxRetries?: number;
  }): Promise<string> {
    const response = await retryUntil(
      async () => {
        return requestUrl({
          url: `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}/git/commits`,
          headers: this.headers(),
          method: "POST",
          body: JSON.stringify({
            message: message,
            tree: treeSha,
            parents: [parent],
          }),
          throw: false,
        });
      },
      (res) => res.status !== 422,
      retry ? maxRetries : 0,
    );

    if (response.status < 200 || response.status >= 400) {
      await this.logger.error("Failed to create commit", response);
      throw new GithubAPIError(
        response.status,
        `Failed to create commit, status ${response.status}`,
      );
    }
    return response.json.sha;
  }

  /**
   * Gets the SHA of the branch head.
   *
   * @param retry Whether to retry the request on failure (default: false)
   * @param maxRetries Maximum number of retry attempts (default: 5)
   * @returns The SHA of the branch head
   */
  async getBranchHeadSha({ retry = false, maxRetries = 5 } = {}) {
    const response = await retryUntil(
      async () => {
        return requestUrl({
          url: `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}/git/refs/heads/${this.settings.githubBranch}`,
          headers: this.headers(),
          throw: false,
        });
      },
      (res) => res.status !== 422,
      retry ? maxRetries : 0,
    );

    if (response.status < 200 || response.status >= 400) {
      await this.logger.error("Failed to get branch head sha", response);
      throw new GithubAPIError(
        response.status,
        `Failed to get branch head sha, status ${response.status}`,
      );
    }
    return response.json.object.sha;
  }

  /**
   * Updates the branch head to point to a new commit.
   *
   * @param sha The SHA of the commit to point to
   * @param retry Whether to retry the request on failure (default: false)
   * @param maxRetries Maximum number of retry attempts (default: 5)
   */
  async updateBranchHead({
    sha,
    retry = false,
    maxRetries = 5,
  }: {
    sha: string;
    retry?: boolean;
    maxRetries?: number;
  }) {
    const response = await retryUntil(
      async () => {
        return requestUrl({
          url: `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}/git/refs/heads/${this.settings.githubBranch}`,
          headers: this.headers(),
          method: "PATCH",
          body: JSON.stringify({
            sha: sha,
          }),
          throw: false,
        });
      },
      (res) => res.status !== 422,
      retry ? maxRetries : 0,
    );

    if (response.status < 200 || response.status >= 400) {
      await this.logger.error("Failed to update branch head sha", response);
      throw new GithubAPIError(
        response.status,
        `Failed to update branch head sha, status ${response.status}`,
      );
    }
  }

  /**
   * Creates a new blob in the GitHub remote, this is mainly used to upload binary files.
   *
   * @param content The content of the blob to upload
   * @param encoding Content encoding, can be "utf-8" or "base64". Defaults to "base64"
   * @param retry Whether to retry the request on failure (default: false)
   * @param maxRetries Maximum number of retry attempts (default: 5)
   * @returns The SHA of the newly uploaded blob
   */
  async createBlob({
    content,
    encoding = "base64",
    retry = false,
    maxRetries = 5,
  }: {
    content: string;
    encoding?: "utf-8" | "base64";
    retry?: boolean;
    maxRetries?: number;
  }): Promise<CreatedBlob> {
    const response = await retryUntil(
      async () => {
        return requestUrl({
          url: `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}/git/blobs`,
          headers: this.headers(),
          method: "POST",
          body: JSON.stringify({ content, encoding }),
          throw: false,
        });
      },
      (res) => res.status !== 422,
      retry ? maxRetries : 0,
    );

    if (response.status < 200 || response.status >= 400) {
      await this.logger.error("Failed to create blob", response);
      throw new GithubAPIError(
        response.status,
        `Failed to create blob, status ${response.status}`,
      );
    }
    return {
      sha: response.json["sha"],
    };
  }

  /**
   * Gets a blob from its sha
   *
   * @param sha The SHA of the blob
   * @param retry Whether to retry the request on failure (default: false)
   * @param maxRetries Maximum number of retry attempts (default: 5)
   * @returns The blob file
   */
  async getBlob({
    sha,
    retry = false,
    maxRetries = 5,
  }: {
    sha: string;
    retry?: boolean;
    maxRetries?: number;
  }): Promise<BlobFile> {
    const response = await retryUntil(
      async () => {
        return requestUrl({
          url: `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}/git/blobs/${sha}`,
          headers: this.headers(),
          throw: false,
        });
      },
      (res) => res.status !== 422,
      retry ? maxRetries : 0,
    );

    if (response.status < 200 || response.status >= 400) {
      await this.logger.error("Failed to get blob", response);
      throw new GithubAPIError(
        response.status,
        `Failed to get blob, status ${response.status}`,
      );
    }
    return response.json;
  }

  /**
   * Create a new file in the repo, the content must be base64 encoded or the request will fail.
   *
   * @param path Path to create in the repo
   * @param content Base64 encoded content of the file
   * @param message Commit message
   * @param retry Whether to retry the request on failure (default: false)
   * @param maxRetries Maximum number of retry attempts (default: 5)
   */
  async createFile({
    path,
    content,
    message,
    retry = false,
    maxRetries = 5,
  }: {
    path: string;
    content: string;
    message: string;
    retry?: boolean;
    maxRetries?: number;
  }) {
    const response = await retryUntil(
      async () => {
        return requestUrl({
          url: `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}/contents/${path}`,
          headers: this.headers(),
          method: "PUT",
          body: JSON.stringify({
            message: message,
            content: content,
            branch: this.settings.githubBranch,
          }),
          throw: false,
        });
      },
      (res) => res.status !== 422,
      retry ? maxRetries : 0,
    );

    if (response.status < 200 || response.status >= 400) {
      await this.logger.error("Failed to create file", response);
      throw new GithubAPIError(
        response.status,
        `Failed to create file, status ${response.status}`,
      );
    }
  }

  /**
   * Downloads the repository as a ZIP archive from GitHub.
   *
   * @param retry Whether to retry the request on failure (default: false)
   * @param maxRetries Maximum number of retry attempts (default: 5)
   * @returns The archive contents as an ArrayBuffer
   */
  async downloadRepositoryArchive({
    retry = false,
    maxRetries = 5,
  } = {}): Promise<ArrayBuffer> {
    const response = await retryUntil(
      async () => {
        return requestUrl({
          url: `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}/zipball/${this.settings.githubBranch}`,
          headers: this.headers(),
          method: "GET",
          throw: false,
        });
      },
      (res) => res.status !== 422,
      retry ? maxRetries : 0,
    );

    if (response.status < 200 || response.status >= 400) {
      await this.logger.error("Failed to download zip archive", response);
      throw new GithubAPIError(
        response.status,
        `Failed to download zip archive, status ${response.status}`,
      );
    }
    return response.arrayBuffer;
  }
}
