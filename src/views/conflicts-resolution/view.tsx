import { IconName, ItemView, Menu, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import GitHubSyncPlugin from "src/main";
import { ConflictFile, ConflictResolution } from "src/sync-manager";
import DesktopApp from "./desktop-app";
import MobileApp from "./mobile-app";

export const CONFLICTS_RESOLUTION_VIEW_TYPE = "conflicts-resolution-view";

export class ConflictsResolutionView extends ItemView {
  icon: IconName = "merge";
  private root: Root | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: GitHubSyncPlugin,
    private conflicts: ConflictFile[],
  ) {
    super(leaf);
  }

  getViewType() {
    return CONFLICTS_RESOLUTION_VIEW_TYPE;
  }

  getDisplayText() {
    return "Conflicts Resolution";
  }

  private resolveAllConflicts(resolutions: ConflictResolution[]) {
    if (this.plugin.conflictsResolver) {
      this.plugin.conflictsResolver(resolutions);
      this.plugin.conflictsResolver = null;
    }
  }

  setConflictFiles(conflicts: ConflictFile[]) {
    this.conflicts = conflicts;
    this.render(conflicts);
  }

  async onOpen() {
    this.render(this.conflicts);
  }

  private render(conflicts: ConflictFile[]) {
    if (!this.root) {
      // Hides the navigation header
      (this.containerEl.children[0] as HTMLElement).style.display = "none";
      const container = this.containerEl.children[1];
      container.empty();
      // We don't want any padding, the DiffView component will handle that
      (container as HTMLElement).style.padding = "0";
      this.root = createRoot(container);
    }

    this.root.render(
      <>
        <MobileApp
          initialFiles={conflicts}
          onResolveAllConflicts={this.resolveAllConflicts.bind(this)}
        />
        <DesktopApp
          initialFiles={conflicts}
          onResolveAllConflicts={this.resolveAllConflicts.bind(this)}
        />
      </>,
    );
  }

  async onClose() {
    // Nothing to clean up.
  }
}
