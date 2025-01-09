export interface GitHubSyncSettings {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  repoContentDir: string;
  localContentDir: string;
  syncStrategy: "manual" | "interval";
  syncInterval: number;
  showStatusBarItem: boolean;
  showDownloadRibbonButton: boolean;
  showUploadModifiedFilesRibbonButton: boolean;
  showUploadAllFilesRibbonButton: boolean;
}

export const DEFAULT_SETTINGS: GitHubSyncSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  repoContentDir: "",
  localContentDir: "",
  syncStrategy: "manual",
  syncInterval: 1,
  showStatusBarItem: true,
  showDownloadRibbonButton: true,
  showUploadModifiedFilesRibbonButton: true,
  showUploadAllFilesRibbonButton: true,
};
