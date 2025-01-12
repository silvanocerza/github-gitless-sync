import { Vault, TFile, normalizePath } from "obsidian";
import GithubClient, { TreeItem } from "./github/client";
import MetadataStore, { FileMetadata } from "./metadata-store";
import EventsListener from "./events/listener";
import EventsConsumer from "./events/consumer";
import { GitHubSyncSettings } from "./settings/settings";

export default class SyncManager {
  private metadataStore: MetadataStore;
  private client: GithubClient;
  private eventsListener: EventsListener;
  private eventsConsumer: EventsConsumer;
  private syncIntervalId: number | null = null;

  constructor(
    private vault: Vault,
    private settings: GitHubSyncSettings,
  ) {
    this.metadataStore = new MetadataStore(this.vault);
    this.client = new GithubClient(
      this.settings.githubToken,
      this.settings.githubOwner,
      this.settings.githubRepo,
      this.settings.githubBranch,
      this.settings.repoContentDir,
    );
    this.eventsListener = new EventsListener(
      this.vault,
      this.metadataStore,
      this.settings.localContentDir,
      this.settings.repoContentDir,
    );
    this.eventsConsumer = new EventsConsumer(this);
  }

  async sync() {
    // TODO
  }

  async uploadFile(file: TFile) {
    // TODO: Remove the file from eventsListener if it's there
    const { remotePath, sha } = this.metadataStore.data[file.path];
    const normalizedFilePath = normalizePath(file.path);
    if (!(await this.vault.adapter.exists(normalizedFilePath))) {
      throw new Error(`Can't find file ${file.path}`);
    }
    const fileContent = await this.vault.adapter.readBinary(normalizedFilePath);
    await this.client.uploadFile(remotePath, fileContent, sha);
    // Reset dirty state
    this.metadataStore.data[file.path].dirty = false;
    // Gets the new SHA of the file
    const newSha = await this.client.getFileSha(remotePath);
    this.metadataStore.data[file.path].sha = newSha;
    this.metadataStore.save();
  }

  async downloadFile(file: TreeItem) {
    const url = file.url;
    const destinationFile = file.path.replace(
      this.settings.repoContentDir,
      this.settings.localContentDir,
    );
    const fileMetadata = this.metadataStore.data[destinationFile];
    if (fileMetadata && fileMetadata.sha === file.sha) {
      // File already exists and has the same SHA, no need to download it again.
      return;
    }

    const blob = await this.client.getBlob(url);
    const destinationFolder = normalizePath(
      destinationFile.split("/").slice(0, -1).join("/"),
    );
    if (!(await this.vault.adapter.exists(destinationFolder))) {
      await this.vault.adapter.mkdir(destinationFolder);
    }
    this.vault.adapter.writeBinary(
      normalizePath(destinationFile),
      Buffer.from(blob.content, "base64"),
    );
    this.metadataStore.data[destinationFile] = {
      localPath: destinationFile,
      remotePath: file.path,
      sha: file.sha,
      dirty: false,
      justDownloaded: true,
    };
    await this.metadataStore.save();
  }

  async deleteFile(filePath: string) {
    const { remotePath, sha } = this.metadataStore.data[filePath];
    if (!sha) {
      // File was never uploaded, no need to delete it
      return;
    }
    await this.client.deleteFile(remotePath, sha);
    // File has been deleted, no need to keep track of it anymore
    delete this.metadataStore.data[filePath];
    this.metadataStore.save();
  }

  async downloadAllFiles() {
    const files = await this.client.getRepoContent();

    await Promise.all(
      files.map(async (file: TreeItem) => await this.downloadFile(file)),
    );
  }

  async uploadModifiedFiles() {
    // We upload files sequentially to avoid conflicts.
    // GitHub rejects commits if they're made in fast succession, thus
    // forcing us to retry the failed upload.
    // So parallelization is not an option.
    for (const event of this.eventsListener.flush()) {
      await this.eventsConsumer.process(event);
    }
  }

  async loadMetadata() {
    await this.metadataStore.load();
  }

  getFileMetadata(filePath: string): FileMetadata {
    return this.metadataStore.data[filePath];
  }

  async startEventsListener() {
    this.eventsListener.start();
  }

  /**
   * Starts a new sync interval.
   * Raises an error if the interval is already running.
   */
  startSyncInterval(minutes: number): number {
    if (this.syncIntervalId) {
      throw new Error("Sync interval is already running");
    }
    this.syncIntervalId = window.setInterval(
      () => this.uploadModifiedFiles(),
      // Sync interval is set in minutes but setInterval expects milliseconds
      minutes * 60 * 1000,
    );
    return this.syncIntervalId;
  }

  /**
   * Stops the currently running sync interval
   */
  stopSyncInterval() {
    if (this.syncIntervalId) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Util function that stops and restart the sync interval
   */
  restartSyncInterval(minutes: number) {
    this.stopSyncInterval();
    return this.startSyncInterval(minutes);
  }
}
