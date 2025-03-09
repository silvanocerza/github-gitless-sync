export interface GitHubSyncSettings {
  firstSync: boolean;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  syncStrategy: "manual" | "interval";
  syncInterval: number;
  syncOnStartup: boolean;
  syncConfigDir: boolean;
  conflictHandling: "overwriteLocal" | "ask" | "overwriteRemote";
  conflictViewMode: "default" | "unified" | "split";
  showStatusBarItem: boolean;
  showSyncRibbonButton: boolean;
  showConflictsRibbonButton: boolean;
  enableLogging: boolean;
}

export const DEFAULT_SETTINGS: GitHubSyncSettings = {
  firstSync: true,
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  syncStrategy: "manual",
  syncInterval: 1,
  syncOnStartup: false,
  syncConfigDir: false,
  conflictHandling: "ask",
  conflictViewMode: "default",
  showStatusBarItem: true,
  showSyncRibbonButton: true,
  showConflictsRibbonButton: true,
  enableLogging: false,
};
