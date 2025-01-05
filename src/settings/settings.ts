export interface GitHubSyncSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  repoContentDir: string;
  localContentDir: string;
  syncStrategy: "save" | "manual" | "interval";
  syncInterval: number;
}

export const DEFAULT_SETTINGS: GitHubSyncSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  repoContentDir: "",
  localContentDir: "",
  syncStrategy: "save",
  syncInterval: 1,
};
