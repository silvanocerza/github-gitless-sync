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

    const syncStrategies = {
      manual: "Manually",
      interval: "On Interval",
    };
    const uploadStrategySetting = new Setting(containerEl)
      .setName("Sync strategy")
      .setDesc("How to sync files with remote repository");

    let syncInterval = "1";
    if (this.plugin.settings.syncInterval) {
      syncInterval = this.plugin.settings.syncInterval.toString();
    }
    const intervalSettings = new Setting(containerEl)
      .setName("Sync interval")
      .setDesc("Interval in minutes between automatic syncs")
      .addText((text) =>
        text
          .setPlaceholder("Interval in minutes")
          .setValue(syncInterval)
          .onChange(async (value) => {
            this.plugin.settings.syncInterval = parseInt(value) || 1;
            await this.plugin.saveSettings();
            // We need to restart the interval if the value is changed
            this.plugin.restartSyncInterval();
          }),
      );
    intervalSettings.setDisabled(
      this.plugin.settings.syncStrategy !== "interval",
    );

    uploadStrategySetting.addDropdown((dropdown) =>
      dropdown
        .addOptions(syncStrategies)
        .setValue(this.plugin.settings.syncStrategy)
        .onChange(async (value: keyof typeof syncStrategies) => {
          intervalSettings.setDisabled(value !== "interval");
          this.plugin.settings.syncStrategy = value;
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

    new Setting(containerEl)
      .setName("Sync configs")
      .setDesc("Sync Vault config folder with remote repository")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.syncConfigDir)
          .onChange(async (value) => {
            this.plugin.settings.syncConfigDir = value;
            if (value) {
              await this.plugin.syncManager.addConfigDirToMetadata();
            } else {
              await this.plugin.syncManager.removeConfigDirFromMetadata();
            }
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
      .setName("Show sync button")
      .setDesc("Displays a ribbon button to sync files")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showSyncRibbonButton)
          .onChange((value) => {
            this.plugin.settings.showSyncRibbonButton = value;
            this.plugin.saveSettings();
            if (value) {
              this.plugin.showSyncRibbonIcon();
            } else {
              this.plugin.hideUploadModifiedFilesRibbonIcon();
            }
          });
      });

    containerEl.createEl("h2", { text: "Extra" });

    new Setting(containerEl)
      .setName("Enable logging")
      .setDesc(
        "If enabled logs from this plugin will be saved in a file in your config directory.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableLogging)
          .onChange((value) => {
            this.plugin.settings.enableLogging = value;
            if (value) {
              this.plugin.logger.enable();
            } else {
              this.plugin.logger.disable();
            }
            this.plugin.saveSettings();
          });
      });
  }
}
