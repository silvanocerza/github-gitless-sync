import { Modal } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import GitHubSyncPlugin from "src/main";
import { PluginContext } from "src/views/hooks";
import OnboardingDialogComponent from "./component";

export class OnboardingDialog extends Modal {
  root: Root | null = null;

  constructor(private plugin: GitHubSyncPlugin) {
    super(plugin.app);
  }

  onOpen() {
    this.root = createRoot(this.modalEl);
    // Make the dialog look like the settings modal
    this.modalEl.addClass("mod-settings");
    this.modalEl.addClass("mod-sidebar-layout");
    // Make the dialog slightly smaller than Obsidian settings
    this.modalEl.setCssProps({
      width: "60vw",
      height: "50vh",
    });

    this.root.render(
      <PluginContext.Provider value={this.plugin}>
        <OnboardingDialogComponent />
      </PluginContext.Provider>,
    );
  }

  onClose() {
    const { contentEl } = this;
    this.root?.unmount();
    contentEl.empty();
  }
}
