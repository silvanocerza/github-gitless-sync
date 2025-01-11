import { Modal } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import GitHubSyncPlugin from "src/main";
import { PluginContext } from "../hooks";
import UploadDialogContent from "./component";

/**
 * Dialog shown when user tries to upload all local files to GitHub.
 */
export class UploadDialog extends Modal {
  root: Root | null = null;

  constructor(private plugin: GitHubSyncPlugin) {
    super(plugin.app);
  }

  onOpen() {
    this.root = createRoot(this.modalEl);
    this.root.render(
      <PluginContext.Provider value={this.plugin}>
        <UploadDialogContent onCancel={() => this.close()} />
      </PluginContext.Provider>,
    );
  }

  onClose() {
    const { contentEl } = this;
    // It's important to unmount the component so upload stops
    // in case it's running
    this.root?.unmount();
    contentEl.empty();
  }
}
