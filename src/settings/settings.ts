export interface GitHubSyncSettings {
  firstStart: boolean;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  syncStrategy: "manual" | "interval";
  syncInterval: number;
  syncOnStartup: boolean;
  syncConfigDir: boolean;
  conflictHandling: "ignore" | "ask" | "overwrite";
  showStatusBarItem: boolean;
  showSyncRibbonButton: boolean;
  enableLogging: boolean;
}

export const DEFAULT_SETTINGS: GitHubSyncSettings = {
  firstStart: true,
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  syncStrategy: "manual",
  syncInterval: 1,
  syncOnStartup: false,
  syncConfigDir: true,
  conflictHandling: "ask",
  showStatusBarItem: true,
  showSyncRibbonButton: true,
  enableLogging: true,
};
