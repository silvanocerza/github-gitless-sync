import { Plugin } from "obsidian";
import { GitHubSyncSettings, DEFAULT_SETTINGS } from "./settings/settings";
import GitHubSyncSettingsTab from "./settings/tab";

export default class GitHubSyncPlugin extends Plugin {
  settings: GitHubSyncSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new GitHubSyncSettingsTab(this.app, this));

    console.log("GitHubSyncPlugin loaded");
  }

  async onunload() {
    console.log("GitHubSyncPlugin unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
