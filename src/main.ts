import { EventRef, Plugin, FileView } from "obsidian";
import { GitHubSyncSettings, DEFAULT_SETTINGS } from "./settings/settings";
import GitHubSyncSettingsTab from "./settings/tab";
import { UploadDialog } from "./views/upload-all-files-dialog/view";
import SyncManager from "./sync-manager";

export default class GitHubSyncPlugin extends Plugin {
  settings: GitHubSyncSettings;
  syncManager: SyncManager;

  statusBarItem: HTMLElement | null = null;
  downloadAllRibbonIcon: HTMLElement | null = null;
  uploadModifiedFilesRibbonIcon: HTMLElement | null = null;
  uploadCurrentFileRibbonIcon: HTMLElement | null = null;
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

    this.addSettingTab(new GitHubSyncSettingsTab(this.app, this));

    this.syncManager = new SyncManager(this.app.vault, this.settings);
    await this.syncManager.loadMetadata();

    if (this.settings.uploadStrategy == "interval") {
      this.restartSyncInterval();
    }

    // const res = await this.client.getRepoContent(
    // this.settings.githubOwner,
    // this.settings.githubRepo,
    // this.settings.repoContentDir,
    // this.settings.githubBranch,
    // );
    // console.log(res);

    this.app.workspace.onLayoutReady(async () => {
      // Create the events handling only after tha layout is ready to avoid
      // getting spammed with create events.
      // See the official Obsidian docs:
      // https://docs.obsidian.md/Reference/TypeScript+API/Vault/on('create')
      await this.syncManager.startEventsListener();

      // Load the ribbons after layout is ready so they're shown after the core
      // buttons
      if (this.settings.showStatusBarItem) {
        this.showStatusBarItem();
      }

      if (this.settings.showDownloadRibbonButton) {
        this.showDownloadAllRibbonIcon();
      }

      if (this.settings.showUploadModifiedFilesRibbonButton) {
        this.showUploadModifiedFilesRibbonIcon();
      }

      if (this.settings.showUploadActiveFileRibbonButton) {
        this.showUploadActiveFileRibbonIcon();
      }

      if (this.settings.showUploadAllFilesRibbonButton) {
        this.showUploadAllFilesRibbonIcon();
      }
    });

    this.addCommand({
      id: "download-all-files",
      name: "Download all files to GitHub",
      repeatable: false,
      icon: "arrow-down-from-line",
      callback: async () => {
        await this.syncManager.downloadAllFiles();
        this.updateStatusBarItem();
      },
    });

    this.addCommand({
      id: "upload-modified-files",
      name: "Upload modified files to GitHub",
      repeatable: false,
      icon: "refresh-cw",
      callback: async () => {
        await this.syncManager.uploadModifiedFiles();
        this.updateStatusBarItem();
      },
    });

    this.addCommand({
      id: "upload-active-file",
      name: "Upload active file to GitHub",
      repeatable: false,
      icon: "arrow-up",
      callback: async () => {
        const activeView = this.app.workspace.getActiveViewOfType(FileView);
        if (!activeView) {
          return;
        }
        const activeFile = activeView.file;
        if (!activeFile) {
          return;
        }
        // await this.syncManager.uploadFile(activeFile);
        this.updateStatusBarItem();
      },
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
    // TODO: Stop all the things here
    this.stopSyncInterval();
    console.log("GitHubSyncPlugin unloaded");
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
    const fileData = this.syncManager.getFileMetadata(activeFile.path);
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
      async () => {
        await this.syncManager.downloadAllFiles();
        this.updateStatusBarItem();
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
      "refresh-cw",
      "Upload modified files to GitHub",
      async () => {
        await this.syncManager.uploadModifiedFiles();
        this.updateStatusBarItem();
      },
    );
  }

  hideUploadModifiedFilesRibbonIcon() {
    this.uploadModifiedFilesRibbonIcon?.remove();
    this.uploadModifiedFilesRibbonIcon = null;
  }

  showUploadActiveFileRibbonIcon() {
    if (this.uploadCurrentFileRibbonIcon) {
      return;
    }

    this.uploadCurrentFileRibbonIcon = this.addRibbonIcon(
      "arrow-up",
      "Upload current file to GitHub",
      async () => {
        const activeView = this.app.workspace.getActiveViewOfType(FileView);
        if (!activeView) {
          return;
        }
        const activeFile = activeView.file;
        if (!activeFile) {
          return;
        }
        // await this.syncManager.uploadFile(activeFile);
        this.updateStatusBarItem();
      },
    );
  }

  hideUploadActiveFileRibbonIcon() {
    this.uploadCurrentFileRibbonIcon?.remove();
    this.uploadCurrentFileRibbonIcon = null;
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

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Proxy methods from sync manager to ease handling the interval
  // when settings are changed
  startSyncInterval() {
    const intervalID = this.syncManager.startSyncInterval(
      this.settings.uploadInterval,
    );
    this.registerInterval(intervalID);
  }

  stopSyncInterval() {
    this.syncManager.stopSyncInterval();
  }

  restartSyncInterval() {
    this.syncManager.stopSyncInterval();
    this.syncManager.startSyncInterval(this.settings.uploadInterval);
  }
}
