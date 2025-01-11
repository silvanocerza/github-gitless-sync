import { EventRef, Plugin } from "obsidian";
import { GitHubSyncSettings, DEFAULT_SETTINGS } from "./settings/settings";
import GithubClient from "./github/client";
import GitHubSyncSettingsTab from "./settings/tab";
import MetadataStore from "./metadata-store";
import EventsListener from "./events/listener";
import EventsConsumer from "./events/consumer";
import { type Event } from "./events/types";
import { UploadDialog } from "./views/upload-all-files-dialog/view";

export default class GitHubSyncPlugin extends Plugin {
  settings: GitHubSyncSettings;
  metadataStore: MetadataStore;
  client: GithubClient;
  eventsListener: EventsListener;
  eventsConsumer: EventsConsumer;
  syncIntervalId: number | null = null;

  statusBarItem: HTMLElement | null = null;
  downloadAllRibbonIcon: HTMLElement | null = null;
  uploadModifiedFilesRibbonIcon: HTMLElement | null = null;
  uploadAllFilesRibbonIcon: HTMLElement | null = null;

  activeLeafChangeListener: EventRef | null = null;
  vaultCreateListener: EventRef | null = null;
  vaultModifyListener: EventRef | null = null;

  async onUserEnable() {
    // TODO: Add onboarding
    console.log("Enabled!");
  }

  async onload() {
    await this.loadSettings();
    await this.loadMetadata();

    this.addSettingTab(new GitHubSyncSettingsTab(this.app, this));

    if (this.settings.showStatusBarItem) {
      this.showStatusBarItem();
    }

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
      id: "download-all-files",
      name: "Download all files to GitHub",
      repeatable: false,
      icon: "arrow-down-from-line",
      callback: async () => await this.downloadAllFiles(),
    });

    this.addCommand({
      id: "upload-modified-files",
      name: "Upload modified files to GitHub",
      repeatable: false,
      icon: "arrow-up",
      callback: async () => await this.uploadModifiedFiles(),
    });

    this.addCommand({
      id: "upload-all-files",
      name: "Upload all files to GitHub",
      repeatable: false,
      icon: "arrow-up-from-line",
      callback: async () => await this.openUploadAllFilesDialog(),
    });
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
      () => this.uploadModifiedFiles(),
      // Sync interval is set in minutes but setInterval expects milliseconds
      this.settings.uploadInterval * 60 * 1000,
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

  private async downloadAllFiles() {
    await this.client.downloadRepoContent(
      this.settings.githubOwner,
      this.settings.githubRepo,
      this.settings.repoContentDir,
      this.settings.githubBranch,
      this.settings.localContentDir,
    );
    this.updateStatusBarItem();
  }

  private async uploadModifiedFiles() {
    await Promise.all(
      this.eventsListener.flush().map(async (event: Event) => {
        await this.eventsConsumer.process(event);
      }),
    );
    this.updateStatusBarItem();
  }

  /**
   * Opens dialog to upload all file in the tracked folder.
   * This doesn't take into account the state of the files and uploads
   * ALL files whether they've been modified or not.
   */
  private async openUploadAllFilesDialog() {
    new UploadDialog(this).open();
    this.updateStatusBarItem();
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
    if (this.settings.uploadStrategy == "interval") {
      this.restartSyncInterval();
    }
  }

  showStatusBarItem() {
    if (this.statusBarItem) {
      return;
    }
    this.statusBarItem = this.addStatusBarItem();

    if (!this.activeLeafChangeListener) {
      this.activeLeafChangeListener = this.app.workspace.on(
        "active-leaf-change",
        () => this.updateStatusBarItem(),
      );
    }
    if (!this.vaultCreateListener) {
      this.vaultCreateListener = this.app.vault.on("create", () => {
        this.updateStatusBarItem();
      });
    }
    if (!this.vaultModifyListener) {
      this.vaultModifyListener = this.app.vault.on("modify", () => {
        this.updateStatusBarItem();
      });
    }
  }

  hideStatusBarItem() {
    this.statusBarItem?.remove();
    this.statusBarItem = null;
  }

  updateStatusBarItem() {
    if (!this.statusBarItem) {
      return;
    }
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return;
    }

    let state = "Unknown";
    const fileData = this.metadataStore.data[activeFile.path];
    if (!fileData) {
      state = "Untracked";
    } else if (fileData.dirty) {
      state = "Outdated";
    } else if (!fileData.dirty) {
      state = "Up to date";
    }

    this.statusBarItem.setText(`GitHub: ${state}`);
  }

  showDownloadAllRibbonIcon() {
    if (this.downloadAllRibbonIcon) {
      return;
    }
    this.downloadAllRibbonIcon = this.addRibbonIcon(
      "arrow-down-from-line",
      "Download all files from GitHub",
      async () => await this.downloadAllFiles(),
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
      async () => await this.uploadModifiedFiles(),
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
      async () => await this.openUploadAllFilesDialog(),
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
