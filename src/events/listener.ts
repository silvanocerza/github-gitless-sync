import { Vault, TAbstractFile, TFolder, TFile } from "obsidian";
import { Event } from "./types";
import MetadataStore from "../metadata-store";
import EventsQueue from "./queue";

/**
 * Tracks changes to local sync directory and updates files metadata.
 */
export default class EventsListener {
  private eventsQueue: EventsQueue = new EventsQueue();

  constructor(
    private vault: Vault,
    private metadataStore: MetadataStore,
    private localContentDir: string,
    private repoContentDir: string,
  ) {}

  start() {
    this.vault.on("create", this.onCreate.bind(this));
    this.vault.on("delete", this.onDelete.bind(this));
    this.vault.on("modify", this.onModify.bind(this));
    this.vault.on("rename", this.onRename.bind(this));
  }

  /**
   * Returns and empties the events queue.
   */
  flush(): Event[] {
    return this.eventsQueue.flush();
  }

  private async onCreate(file: TAbstractFile) {
    if (!file.path.startsWith(this.localContentDir)) {
      // The file has not been created in directory that we're syncing with GitHub
      return;
    }
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }

    const data = this.metadataStore.data[file.path];
    if (data && data.justDownloaded) {
      // This file was just downloaded and not created by the user.
      // It's enough to mark it as non just downloaded.
      this.metadataStore.data[file.path].justDownloaded = false;
      await this.metadataStore.save();
      return;
    }

    this.metadataStore.data[file.path] = {
      localPath: file.path,
      remotePath: file.path.replace(this.localContentDir, this.repoContentDir),
      sha: null,
      dirty: true,
      // This file has been created by the user
      justDownloaded: false,
    };
    await this.metadataStore.save();
    this.eventsQueue.enqueue({
      type: "create",
      file: file as TFile,
    });
  }

  private async onDelete(file: TAbstractFile | string) {
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }
    const filePath = file instanceof TAbstractFile ? file.path : file;
    if (!filePath.startsWith(this.localContentDir)) {
      // The file was not in directory that we're syncing with GitHub
      return;
    }

    // We don't delete metadata as we need that info when calling the API
    // to delete the file.
    // We'll delete them later.
    this.eventsQueue.enqueue({
      type: "delete",
      filePath: filePath,
    });
  }

  private async onModify(file: TAbstractFile) {
    if (!file.path.startsWith(this.localContentDir)) {
      // The file has not been create in directory that we're syncing with GitHub
      return;
    }
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }
    const data = this.metadataStore.data[file.path];
    if (data && data.justDownloaded) {
      // This file was just downloaded and not modified by the user.
      // It's enough to makr it as non just downloaded.
      this.metadataStore.data[file.path].justDownloaded = false;
      await this.metadataStore.save();
      return;
    }
    this.metadataStore.data[file.path].dirty = true;
    await this.metadataStore.save();
    this.eventsQueue.enqueue({
      type: "modify",
      file: file as TFile,
    });
  }

  private async onRename(file: TAbstractFile, oldPath: string) {
    if (file instanceof TFolder) {
      // Skip folders
      return;
    }
    if (
      !file.path.startsWith(this.localContentDir) &&
      !oldPath.startsWith(this.localContentDir)
    ) {
      // Both are not in directory that we're syncing with GitHub
      return;
    }

    if (
      file.path.startsWith(this.localContentDir) &&
      oldPath.startsWith(this.localContentDir)
    ) {
      // Both files are in the synced directory
      // First create the new one
      await this.onCreate(file);
      // Then delete the old one
      await this.onDelete(oldPath);
      return;
    } else if (file.path.startsWith(this.localContentDir)) {
      // Only the new file is in the local directory
      await this.onCreate(file);
      return;
    } else if (oldPath.startsWith(this.localContentDir)) {
      // Only the old file was in the local directory
      await this.onDelete(oldPath);
      return;
    }
  }
}
