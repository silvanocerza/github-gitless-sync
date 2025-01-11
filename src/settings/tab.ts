import { PluginSettingTab, App, Setting, TextComponent } from "obsidian";
import GitHubSyncPlugin from "src/main";

export default class GitHubSyncSettingsTab extends PluginSettingTab {
  plugin: GitHubSyncPlugin;

  constructor(app: App, plugin: GitHubSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h1", { text: "GitHub Sync Settings" });

    containerEl.createEl("h2", { text: "Remote Repository" });

    let tokenInput: TextComponent;
    new Setting(containerEl)
      .setName("GitHub Token")
      .setDesc(
        "A personal access token or a fine-grained token with read and write access to your repository",
      )
      .addButton((button) =>
        button.setIcon("eye-off").onClick((e) => {
          if (tokenInput.inputEl.type === "password") {
            tokenInput.inputEl.type = "text";
            button.setIcon("eye");
          } else {
            tokenInput.inputEl.type = "password";
            button.setIcon("eye-off");
          }
        }),
      )
      .addText((text) => {
        text
          .setPlaceholder("Token")
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value;
            await this.plugin.saveSettings();
          }).inputEl.type = "password";
        tokenInput = text;
      });

    new Setting(containerEl)
      .setName("Owner")
      .setDesc("Owner of the repository to sync")
      .addText((text) =>
        text
          .setPlaceholder("Owner")
          .setValue(this.plugin.settings.githubOwner)
          .onChange(async (value) => {
            this.plugin.settings.githubOwner = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Repository")
      .setDesc("Name of the repository to sync")
      .addText((text) =>
        text
          .setPlaceholder("Repository")
          .setValue(this.plugin.settings.githubRepo)
          .onChange(async (value) => {
            this.plugin.settings.githubRepo = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Repository branch")
      .setDesc("Branch to sync")
      .addText((text) =>
        text
          .setPlaceholder("Branch name")
          .setValue(this.plugin.settings.githubBranch)
          .onChange(async (value) => {
            this.plugin.settings.githubBranch = value;
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h2", { text: "Sync" });

    new Setting(containerEl)
      .setName("Repository content directory")
      .setDesc(
        `The repository directory to sync, relative to the repository root.
        If not set the whole repository will be synced.`,
      )
      .addText((text) =>
        text
          .setPlaceholder("Exaple: blog/content")
          .setValue(this.plugin.settings.repoContentDir)
          .onChange(async (value) => {
            // TODO: Change the local path if already fetched
            this.plugin.settings.repoContentDir = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Local content directory")
      .setDesc(
        `The local directory to sync, relative to the vault root.
        If not set the whole vault will be synced.`,
      )
      .addText((text) =>
        text
          .setPlaceholder("Exaple: folder/blog-posts")
          .setValue(this.plugin.settings.localContentDir)
          .onChange(async (value) => {
            // TODO: Move the folder if already fetched
            this.plugin.settings.localContentDir = value;
            await this.plugin.saveSettings();
          }),
      );

    const uploadStrategies = {
      manual: "Manually",
      interval: "On Interval",
    };
    const uploadStrategySetting = new Setting(containerEl)
      .setName("Upload strategy")
      .setDesc("When to upload local files to remote repository");

    let syncInterval = "1";
    if (this.plugin.settings.uploadInterval) {
      syncInterval = this.plugin.settings.uploadInterval.toString();
    }
    const intervalSettings = new Setting(containerEl)
      .setName("Upload interval")
      .setDesc("Upload interval in minutes between automatic uploads")
      .addText((text) =>
        text
          .setPlaceholder("Interval in minutes")
          .setValue(syncInterval)
          .onChange(async (value) => {
            this.plugin.settings.uploadInterval = parseInt(value) || 1;
            await this.plugin.saveSettings();
            // We need to restart the interval if the value is changed
            this.plugin.restartSyncInterval();
          }),
      );
    intervalSettings.setDisabled(
      this.plugin.settings.uploadStrategy !== "interval",
    );

    uploadStrategySetting.addDropdown((dropdown) =>
      dropdown
        .addOptions(uploadStrategies)
        .setValue(this.plugin.settings.uploadStrategy)
        .onChange(async (value: keyof typeof uploadStrategies) => {
          intervalSettings.setDisabled(value !== "interval");
          this.plugin.settings.uploadStrategy = value;
          await this.plugin.saveSettings();
          if (value === "interval") {
            this.plugin.startSyncInterval();
          } else {
            this.plugin.stopSyncInterval();
          }
        }),
    );

    new Setting(containerEl)
      .setName("Sync on startup")
      .setDesc("Download up to date files from remote on startup")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.syncOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.syncOnStartup = value;
            await this.plugin.saveSettings();
          });
      });

    const conflictHandlingOptions = {
      ignore: "Ignore remote file",
      ask: "Ask",
      overwrite: "Overwrite local file",
    };
    new Setting(containerEl)
      .setName("Conflict handling")
      .setDesc(
        `What to do in case remote and local files conflict
        when downloading from GitHub repository
        `,
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(conflictHandlingOptions)
          .setValue(this.plugin.settings.conflictHandling)
          .onChange(async (value: keyof typeof conflictHandlingOptions) => {
            this.plugin.settings.conflictHandling = value;
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl("h2", { text: "Interface" });

    new Setting(containerEl)
      .setName("Show status bar item")
      .setDesc("Displays the status bar item that show the file sync status")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showStatusBarItem)
          .onChange((value) => {
            this.plugin.settings.showStatusBarItem = value;
            this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Show download all files button")
      .setDesc(
        "Displays a ribbon button to download all files from the remote repository",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showDownloadRibbonButton)
          .onChange((value) => {
            this.plugin.settings.showDownloadRibbonButton = value;
            this.plugin.saveSettings();
            if (value) {
              this.plugin.showDownloadAllRibbonIcon();
            } else {
              this.plugin.hideDownloadAllRibbonIcon();
            }
          });
      });

    new Setting(containerEl)
      .setName("Show upload modified files button")
      .setDesc("Displays a ribbon button to upload modified files")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showUploadModifiedFilesRibbonButton)
          .onChange((value) => {
            this.plugin.settings.showUploadModifiedFilesRibbonButton = value;
            this.plugin.saveSettings();
            if (value) {
              this.plugin.showUploadModifiedFilesRibbonIcon();
            } else {
              this.plugin.hideUploadModifiedFilesRibbonIcon();
            }
          });
      });

    new Setting(containerEl)
      .setName("Show upload all files button")
      .setDesc("Displays a ribbon button to upload all files")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showUploadAllFilesRibbonButton)
          .onChange((value) => {
            this.plugin.settings.showUploadAllFilesRibbonButton = value;
            this.plugin.saveSettings();
            if (value) {
              this.plugin.showUploadAllFilesRibbonIcon();
            } else {
              this.plugin.hideUploadAllFilesRibbonIcon();
            }
          });
      });
  }
}
