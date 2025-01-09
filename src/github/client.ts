import { Vault, requestUrl } from "obsidian";
import MetadataStore from "../metadata-store";

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
    const res = await requestUrl({
      url: `https://api.github.com/repos/${owner}/${repo}/contents/${repoContentDir}?ref=${branch}`,
      headers: this.headers(),
    });

    const content = await res.json();
    const directories = content.filter((file: any) => file.type === "dir");
    // As specified in the Github docs also submodules are specified as "file".
    // For the time being we're going to let this slide cause I don't really
    // want to handle this right now. I'll figure out a way to do this later. Maybe.
    // More info in the official docs:
    // https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content
    const files = content.filter((file: any) => file.type === "file");

    await Promise.all(
      directories.map((dir: any) =>
        this.downloadRepoContent(
          owner,
          repo,
          dir.path,
          branch,
          `${localContentDir}/${dir.name}`,
        ),
      ),
    );

    await Promise.all(
      files.map(async (file: any) => {
        const url = file.download_url;
        const destinationFile = file.path.replace(
          repoContentDir,
          localContentDir,
        );
        const fileMetadata = this.metadataStore.data[destinationFile];
        if (fileMetadata && fileMetadata.sha === file.sha) {
          // File already exists and has the same SHA, no need to download it again.
          return;
        }

        await this.downloadFile(url, destinationFile);
        this.metadataStore.data[destinationFile] = {
          localPath: destinationFile,
          remotePath: file.path,
          sha: file.sha,
          dirty: false,
        };
        await this.metadataStore.save();
      }),
    );
  }

  /**
   * Downloads a single file from GitHub. This doesn't use the API but the raw
   * file content endpoint that we receive from the API.
   * This makes some things slightly easier to handle.
   *
   * @param url URL to raw file content
   * @param destinationFile Local path where to save the file, relative to the vault
   */
  async downloadFile(url: string, destinationFile: string) {
    // We're not setting auth headers here as we're not calling the Github API
    // directly but downloading the raw file, cause there are some size limitation
    // with the official API.
    // Using the headers above is not feasible as it triggers CORS preflight
    // and GH doesn't allow that for raw content endpoints. Thus breaking everything.
    // So this doesn't work with a private repo, will figure it out later.
    const res = await requestUrl({
      url: url,
    });
    const destinationPath = destinationFile.split("/").slice(0, -1).join("/");
    if (!this.vault.getFolderByPath(destinationPath)) {
      this.vault.createFolder(destinationPath);
    }

    const existingFile = this.vault.getFileByPath(destinationFile);
    if (existingFile) {
      this.vault.modifyBinary(existingFile, res.arrayBuffer);
    } else {
      this.vault.createBinary(destinationFile, res.arrayBuffer);
    }
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
    const file = this.vault.getFileByPath(filePath);
    if (!file) {
      throw new Error(`Can't find file ${filePath}`);
    }

    const buffer = await this.vault.readBinary(file);
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
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Failed to upload file: ${res.status}`);
    }
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
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Failed to delete file: ${res.status}`);
    }
  }
}
