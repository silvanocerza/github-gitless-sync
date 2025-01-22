export interface GitHubSyncSettings {
  firstStart: boolean;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  repoContentDir: string;
  localContentDir: string;
  syncStrategy: "manual" | "interval";
  syncInterval: number;
  syncOnStartup: boolean;
  syncConfigDir: boolean;
  conflictHandling: "ignore" | "ask" | "overwrite";
  showStatusBarItem: boolean;
  showSyncRibbonButton: boolean;
}

export const DEFAULT_SETTINGS: GitHubSyncSettings = {
  firstStart: true,
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  repoContentDir: "",
  localContentDir: "",
  syncStrategy: "manual",
  syncInterval: 1,
  syncOnStartup: false,
  syncConfigDir: true,
  conflictHandling: "ask",
  showStatusBarItem: true,
  showSyncRibbonButton: true,
};
