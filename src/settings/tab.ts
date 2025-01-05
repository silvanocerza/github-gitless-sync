import { PluginSettingTab, App, Setting } from "obsidian";
import GitHubSyncPlugin from "src/main";
import { GitHubSyncSettings } from "./settings";

const SETTINGS_DATA: {
  Name: string;
  Description: string;
  Field: keyof GitHubSyncSettings;
  Placeholder: string;
}[] = [
  {
    Name: "GitHub Token",
    Description:
      "A personal access token or a fine-grained token with read and write access to your repository",
    Field: "githubToken",
    Placeholder: "Token",
  },
  {
    Name: "Owner",
    Description: "Owner of the repository to sync",
    Field: "githubOwner",
    Placeholder: "Owner",
  },
  {
    Name: "Repository",
    Description: "Name of the repository to sync",
    Field: "githubRepo",
    Placeholder: "Repository",
  },
  {
    Name: "Repository branch",
    Description: "Branch to sync",
    Field: "githubBranch",
    Placeholder: "Branch name",
  },
];

export default class GitHubSyncSettingsTab extends PluginSettingTab {
  plugin: GitHubSyncPlugin;

  constructor(app: App, plugin: GitHubSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings for GitHub Sync" });

    SETTINGS_DATA.forEach((setting) => {
      new Setting(containerEl)
        .setName(setting.Name)
        .setDesc(setting.Description)
        .addText((text) =>
          text
            .setPlaceholder(setting.Placeholder)
            .setValue(this.plugin.settings[setting.Field])
            .onChange(async (value) => {
              this.plugin.settings[setting.Field] = value;
              await this.plugin.saveSettings();
            }),
        );
    });
  }
}
