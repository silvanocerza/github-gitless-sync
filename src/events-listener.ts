import { Vault, TAbstractFile, TFolder } from "obsidian";
import MetadataStore from "./metadata-store";
import { GitHubSyncSettings } from "./settings/settings";

/**
 * Tracks changes to local sync directory and updates files metadata.
 */
export default class EventsListener {
  constructor(
    private vault: Vault,
    private metadataStore: MetadataStore,
    private settings: GitHubSyncSettings,
  ) {}

  start() {
    this.vault.on("create", this.onCreate.bind(this));
    this.vault.on("delete", this.onDelete.bind(this));
    this.vault.on("modify", this.onModify.bind(this));
    this.vault.on("rename", this.onRename.bind(this));
  }

  private async onCreate(file: TAbstractFile) {
    if (!this.isSyncable(file.path)) {
      // The file has not been created in directory that we're syncing with GitHub
      return;
    }
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }

    const data = this.metadataStore.data.files[file.path];
    if (data && data.justDownloaded) {
      // This file was just downloaded and not created by the user.
      // It's enough to mark it as non just downloaded.
      this.metadataStore.data.files[file.path].justDownloaded = false;
      await this.metadataStore.save();
      return;
    }

    this.metadataStore.data.files[file.path] = {
      path: file.path,
      sha: null,
      dirty: true,
      // This file has been created by the user
      justDownloaded: false,
      lastModified: Date.now(),
    };
    await this.metadataStore.save();
  }

  private async onDelete(file: TAbstractFile | string) {
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }
    const filePath = file instanceof TAbstractFile ? file.path : file;
    if (!this.isSyncable(filePath)) {
      // The file was not in directory that we're syncing with GitHub
      return;
    }

    this.metadataStore.data.files[filePath].deleted = true;
    this.metadataStore.data.files[filePath].deletedAt = Date.now();
    await this.metadataStore.save();
  }

  private async onModify(file: TAbstractFile) {
    if (!this.isSyncable(file.path)) {
      // The file has not been create in directory that we're syncing with GitHub
      return;
    }
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }
    const data = this.metadataStore.data.files[file.path];
    if (data && data.justDownloaded) {
      // This file was just downloaded and not modified by the user.
      // It's enough to makr it as non just downloaded.
      this.metadataStore.data.files[file.path].justDownloaded = false;
      await this.metadataStore.save();
      return;
    }
    this.metadataStore.data.files[file.path].lastModified = Date.now();
    this.metadataStore.data.files[file.path].dirty = true;
    await this.metadataStore.save();
  }

  private async onRename(file: TAbstractFile, oldPath: string) {
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }
    if (!this.isSyncable(file.path) && !this.isSyncable(oldPath)) {
      // Both are not in directory that we're syncing with GitHub
      return;
    }

    if (this.isSyncable(file.path) && this.isSyncable(oldPath)) {
      // Both files are in the synced directory
      // First create the new one
      await this.onCreate(file);
      // Then delete the old one
      await this.onDelete(oldPath);
      return;
    } else if (this.isSyncable(file.path)) {
      // Only the new file is in the local directory
      await this.onCreate(file);
      return;
    } else if (this.isSyncable(oldPath)) {
      // Only the old file was in the local directory
      await this.onDelete(oldPath);
      return;
    }
  }

  private isSyncable(filePath: string) {
    if (filePath === `${this.vault.configDir}/github-sync-metadata.json`) {
      // Manifest file must always be synced
      return true;
    } else if (
      filePath === `${this.vault.configDir}/workspace.json` ||
      filePath === `${this.vault.configDir}/workspace-mobile.json`
    ) {
      // Obsidian recommends not syncing the workspace files
      return false;
    } else if (
      this.settings.syncConfigDir &&
      filePath.startsWith(this.vault.configDir)
    ) {
      // Sync configs only if the user explicitly wants to
      return true;
    } else {
      // All other files can be synced
      return true;
    }
  }
}
