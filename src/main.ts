import { Plugin } from "obsidian";
import { GitHubSyncSettings, DEFAULT_SETTINGS } from "./settings/settings";
import GithubClient from "./github/client";
import GitHubSyncSettingsTab from "./settings/tab";
import MetadataStore from "./metadata-store";
import EventsListener from "./events/listener";
import EventsConsumer from "./events/consumer";
import { type Event } from "./events/types";

export default class GitHubSyncPlugin extends Plugin {
  settings: GitHubSyncSettings;
  metadataStore: MetadataStore;
  client: GithubClient;
  eventsListener: EventsListener;
  eventsConsumer: EventsConsumer;
  syncIntervalId: number | null = null;

  downloadAllRibbonIcon: HTMLElement | null = null;
  uploadModifiedFilesRibbonIcon: HTMLElement | null = null;
  uploadAllFilesRibbonIcon: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    await this.loadMetadata();

    this.addSettingTab(new GitHubSyncSettingsTab(this.app, this));

    if (this.settings.showDownloadRibbonButton) {
      this.showDownloadAllRibbonIcon();
    }

    if (this.settings.showUploadModifiedFilesRibbonButton) {
      this.showUploadModifiedFilesRibbonIcon();
    }

    if (this.settings.showUploadAllFilesRibbonButton) {
      this.showUploadAllFilesRibbonIcon();
    }

    this.client = new GithubClient(
      this.app.vault,
      this.metadataStore,
      this.settings.githubToken,
    );

    this.app.workspace.onLayoutReady(async () => {
      // Create the events handling only after tha layout is ready to avoid
      // getting spammed with create events.
      // See the official Obsidian docs:
      // https://docs.obsidian.md/Reference/TypeScript+API/Vault/on('create')
      await this.startEventsHandlers();
    });

    this.addCommand({
      id: "github-sync-modified-files",
      name: "Sync modified files to GitHub",
      repeatable: false,
      icon: "arrow-up",
      callback: () => this.syncModifiedFiles(),
    });

    // this.addCommand({
    //   id: "github-sync-all-files",
    //   name: "Sync all files to GitHub",
    //   repeatable: false,
    //   icon: "arrow-up-from-line",
    //   callback: () => {},
    // });

    // this.addRibbonIcon("arrow-up-from-line", "Upload all", async () => {
    //   const activeFile = this.app.workspace.getActiveFile();
    //   if (!activeFile) {
    //     return;
    //   }
    //   client.uploadFile(
    //     this.settings.githubOwner,
    //     this.settings.githubRepo,
    //     this.settings.githubBranch,
    //     activeFile.path,
    //   );
    // });
  }

  async onunload() {
    console.log("GitHubSyncPlugin unloaded");
  }

  /**
   * Starts a new sync interval.
   * Raises an error if the interval is already running.
   */
  startSyncInterval() {
    if (this.syncIntervalId) {
      throw new Error("Sync interval is already running");
    }
    this.syncIntervalId = window.setInterval(
      () => this.syncModifiedFiles(),
      // Sync interval is set in minutes but setInterval expects milliseconds
      this.settings.syncInterval * 60 * 1000,
    );
    this.registerInterval(this.syncIntervalId);
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

  private async syncModifiedFiles() {
    await Promise.all(
      this.eventsListener.flush().map(async (event: Event) => {
        await this.eventsConsumer.process(event);
      }),
    );
  }

  /**
   * Util function that stops and restart the sync interval
   */
  restartSyncInterval() {
    this.stopSyncInterval();
    this.startSyncInterval();
  }

  /**
   * Starts events listener and consumer.
   * If the sync strategy is set to "interval", starts the sync interval.
   */
  private async startEventsHandlers() {
    if (this.eventsListener && this.eventsConsumer) {
      // They've been already started
      return;
    }
    this.eventsListener = new EventsListener(
      this.app.vault,
      this.metadataStore,
      this.settings.localContentDir,
      this.settings.repoContentDir,
    );
    this.eventsConsumer = new EventsConsumer(
      this.client,
      this.metadataStore,
      this.settings.githubOwner,
      this.settings.githubRepo,
      this.settings.githubBranch,
    );
    if (this.settings.syncStrategy == "interval") {
      this.restartSyncInterval();
    }
  }

  showDownloadAllRibbonIcon() {
    if (this.downloadAllRibbonIcon) {
      return;
    }
    this.downloadAllRibbonIcon = this.addRibbonIcon(
      "arrow-down-from-line",
      "Download all files from GitHub",
      async () => {
        await this.client.downloadRepoContent(
          this.settings.githubOwner,
          this.settings.githubRepo,
          this.settings.repoContentDir,
          this.settings.githubBranch,
          this.settings.localContentDir,
        );
      },
    );
  }

  hideDownloadAllRibbonIcon() {
    this.downloadAllRibbonIcon?.remove();
    this.downloadAllRibbonIcon = null;
  }

  showUploadModifiedFilesRibbonIcon() {
    if (this.uploadModifiedFilesRibbonIcon) {
      return;
    }
    this.uploadModifiedFilesRibbonIcon = this.addRibbonIcon(
      "arrow-up",
      "Upload modified files to GitHub",
      async () => this.syncModifiedFiles(),
    );
  }

  hideUploadModifiedFilesRibbonIcon() {
    this.uploadModifiedFilesRibbonIcon?.remove();
    this.uploadModifiedFilesRibbonIcon = null;
  }

  showUploadAllFilesRibbonIcon() {
    if (this.uploadAllFilesRibbonIcon) {
      return;
    }
    this.uploadAllFilesRibbonIcon = this.addRibbonIcon(
      "arrow-up-from-line",
      "Upload all files to GitHub",
      async () => {
        // TODO
      },
    );
  }

  hideUploadAllFilesRibbonIcon() {
    this.uploadAllFilesRibbonIcon?.remove();
    this.uploadAllFilesRibbonIcon = null;
  }

  private async loadMetadata() {
    this.metadataStore = new MetadataStore(this.app.vault);
    await this.metadataStore.load();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
