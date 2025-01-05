export interface GitHubSyncSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  repoContentPath: string;
  localPath: string;
  syncStrategy: "save" | "manual" | "interval";
  syncInterval: number;
}

export const DEFAULT_SETTINGS: GitHubSyncSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  repoContentPath: "",
  localPath: "",
  syncStrategy: "save",
  syncInterval: 1,
};
