import { Plugin } from "obsidian";

export default class GitHubSyncPlugin extends Plugin {
  async onload() {
    console.log("GitHubSyncPlugin loaded");
  }

  async onunload() {
    console.log("GitHubSyncPlugin unloaded");
  }
}
