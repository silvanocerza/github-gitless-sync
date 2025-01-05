export interface GitHubSyncSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
}

export const DEFAULT_SETTINGS: GitHubSyncSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
};
