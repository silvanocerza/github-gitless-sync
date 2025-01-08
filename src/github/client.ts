import { Vault } from "obsidian";
import * as path from "path";

export default class GithubClient {
  constructor(
    private vault: Vault,
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
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${repoContentDir}?ref=${branch}`,
      {
        headers: this.headers(),
      },
    );

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
          path.join(localContentDir, dir.name),
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
        await this.downloadFile(url, destinationFile);
      }),
    );
  }

  async downloadFile(url: string, destinationFile: string) {
    // We're not setting auth headers here as we're not calling the Github API
    // directly but downloading the raw file, cause there are some size limitation
    // with the official API.
    // Using the headers above is not feasible as it triggers CORS preflight
    // and GH doesn't allow that for raw content endpoints. Thus breaking everything.
    // So this doesn't work with a private repo, will figure it out later.
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const destinationPath = path.dirname(destinationFile);
    if (!this.vault.getFolderByPath(destinationPath)) {
      this.vault.createFolder(destinationPath);
    }
    // This doesn't overwrite existing files
    this.vault.createBinary(destinationFile, buffer);
  }
}
