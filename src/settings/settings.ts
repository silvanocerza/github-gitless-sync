export interface GitHubSyncSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  repoContentDir: string;
  localContentDir: string;
  uploadStrategy: "manual" | "interval";
  uploadInterval: number;
  syncOnStartup: boolean;
  conflictHandling: "ignore" | "ask" | "overwrite";
  showStatusBarItem: boolean;
  showDownloadRibbonButton: boolean;
  showUploadModifiedFilesRibbonButton: boolean;
  showUploadActiveFileRibbonButton: boolean;
  showUploadAllFilesRibbonButton: boolean;
}

export const DEFAULT_SETTINGS: GitHubSyncSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  repoContentDir: "",
  localContentDir: "",
  uploadStrategy: "manual",
  uploadInterval: 1,
  syncOnStartup: false,
  conflictHandling: "ask",
  showStatusBarItem: true,
  showDownloadRibbonButton: true,
  showUploadModifiedFilesRibbonButton: true,
  showUploadActiveFileRibbonButton: true,
  showUploadAllFilesRibbonButton: true,
};
