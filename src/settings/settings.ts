import { resolveRepoTarget } from "src/github/repo-url";

export interface GitHubSyncSettings {
  firstSync: boolean;
  githubToken: string;
  githubRepoUrl: string;
  githubApiBaseUrl: string;
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
  githubRepoUrl: "",
  githubApiBaseUrl: "",
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

/**
 * Settings replaced by `githubRepoUrl`, they're still found in data saved by older versions.
 */
interface LegacyRepoSettings {
  githubOwner?: string;
  githubRepo?: string;
}

/**
 * Converts settings saved by older versions, that only supported github.com,
 * to the current format.
 *
 * @param settings Settings to migrate in place
 * @returns True if anything changed and the settings must be saved
 */
export function migrateSettings(settings: GitHubSyncSettings): boolean {
  const legacy = settings as GitHubSyncSettings & LegacyRepoSettings;
  if (legacy.githubOwner === undefined && legacy.githubRepo === undefined) {
    return false;
  }

  // A missing owner or repository means the setup was never completed
  if (
    settings.githubRepoUrl === "" &&
    legacy.githubOwner &&
    legacy.githubRepo
  ) {
    settings.githubRepoUrl = `https://github.com/${legacy.githubOwner}/${legacy.githubRepo}`;
  }
  delete legacy.githubOwner;
  delete legacy.githubRepo;
  return true;
}

/**
 * Returns true if all the settings necessary to sync are set and valid.
 */
export function isSyncConfigured(settings: GitHubSyncSettings): boolean {
  return (
    settings.githubToken !== "" &&
    settings.githubBranch !== "" &&
    resolveRepoTarget(settings.githubRepoUrl, settings.githubApiBaseUrl).valid
  );
}
