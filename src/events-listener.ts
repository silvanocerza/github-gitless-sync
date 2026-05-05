import { Vault, TAbstractFile, TFolder } from "obsidian";
import MetadataStore, { MANIFEST_FILE_NAME } from "./metadata-store";
import { GitHubSyncSettings } from "./settings/settings";
import Logger, { LOG_FILE_NAME } from "./logger";
import GitHubSyncPlugin from "./main";
import { isGitignored, loadGitignoreMatcher } from "./gitignore";

/**
 * Tracks changes to local sync directory and updates files metadata.
 */
export default class EventsListener {
  constructor(
    private vault: Vault,
    private metadataStore: MetadataStore,
    private settings: GitHubSyncSettings,
    private logger: Logger,
  ) {}

  start(plugin: GitHubSyncPlugin) {
    // We need to register all the events we subscribe to so they can
    // be correctly detached when the plugin is unloaded too.
    // If we don't they might be left hanging and cause issues.
    plugin.registerEvent(this.vault.on("create", this.onCreate.bind(this)));
    plugin.registerEvent(this.vault.on("delete", this.onDelete.bind(this)));
    plugin.registerEvent(this.vault.on("modify", this.onModify.bind(this)));
    plugin.registerEvent(this.vault.on("rename", this.onRename.bind(this)));
  }

  private async onCreate(file: TAbstractFile) {
    await this.logger.info("Received create event", file.path);
    if (!(await this.isSyncable(file.path))) {
      // The file has not been created in directory that we're syncing with GitHub
      await this.logger.info("Skipped created file", file.path);
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
      await this.logger.info("Updated just downloaded created file", file.path);
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
    await this.logger.info("Updated created file", file.path);
  }

  private async onDelete(file: TAbstractFile | string) {
    const filePath = file instanceof TAbstractFile ? file.path : file;
    await this.logger.info("Received delete event", filePath);
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }
    if (!(await this.isSyncable(filePath))) {
      // The file was not in directory that we're syncing with GitHub
      return;
    }

    this.metadataStore.data.files[filePath].deleted = true;
    this.metadataStore.data.files[filePath].deletedAt = Date.now();
    await this.metadataStore.save();
    await this.logger.info("Updated deleted file", filePath);
  }

  private async onModify(file: TAbstractFile) {
    await this.logger.info("Received modify event", file.path);
    if (!(await this.isSyncable(file.path))) {
      // The file has not been create in directory that we're syncing with GitHub
      await this.logger.info("Skipped modified file", file.path);
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
      await this.logger.info(
        "Updated just downloaded modified file",
        file.path,
      );
      return;
    }
    this.metadataStore.data.files[file.path].lastModified = Date.now();
    this.metadataStore.data.files[file.path].dirty = true;
    await this.metadataStore.save();
    await this.logger.info("Updated modified file", file.path);
  }

  private async onRename(file: TAbstractFile, oldPath: string) {
    await this.logger.info("Received rename event", file.path);
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }
    const newFileIsSyncable = await this.isSyncable(file.path);
    const oldFileIsSyncable = await this.isSyncable(oldPath);

    if (!newFileIsSyncable && !oldFileIsSyncable) {
      // Both are not in directory that we're syncing with GitHub
      return;
    }

    if (newFileIsSyncable && oldFileIsSyncable) {
      // Both files are in the synced directory
      // First create the new one
      await this.onCreate(file);
      // Then delete the old one
      await this.onDelete(oldPath);
      return;
    } else if (newFileIsSyncable) {
      // Only the new file is in the local directory
      await this.onCreate(file);
      return;
    } else if (oldFileIsSyncable) {
      // Only the old file was in the local directory
      await this.onDelete(oldPath);
      return;
    }
  }

  private async isSyncable(filePath: string) {
    if (filePath === `${this.vault.configDir}/${MANIFEST_FILE_NAME}`) {
      // Manifest file must always be synced
      return true;
    } else if (
      filePath === `${this.vault.configDir}/workspace.json` ||
      filePath === `${this.vault.configDir}/workspace-mobile.json`
    ) {
      // Obsidian recommends not syncing the workspace files
      return false;
    } else if (filePath === `${this.vault.configDir}/${LOG_FILE_NAME}`) {
      // Don't sync the log file, doesn't make sense
      return false;
    } else if (
      this.settings.syncConfigDir &&
      filePath.startsWith(this.vault.configDir)
    ) {
      // Sync configs only if the user explicitly wants to
      return !(await this.isIgnored(filePath));
    } else {
      // All other files can be synced
      return !(await this.isIgnored(filePath));
    }
  }

  private async isIgnored(filePath: string): Promise<boolean> {
    if (!this.settings.useGitignore) {
      return false;
    }

    // The file can change during the session, so events always read
    // the current version before deciding whether to update local metadata.
    return isGitignored(await loadGitignoreMatcher(this.vault), filePath);
  }
}
