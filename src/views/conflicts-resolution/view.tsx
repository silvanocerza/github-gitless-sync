import { IconName, ItemView, Menu, Platform, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import GitHubSyncPlugin from "src/main";
import { ConflictFile, ConflictResolution } from "src/sync-manager";
import SplitView from "./split-view/split-view";
import UnifiedView from "./unified-view/unified-view";

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

    let diffMode = "default";
    if (this.plugin.settings.conflictViewMode === "default") {
      if (Platform.isMobile) {
        diffMode = "unified";
      } else {
        diffMode = "split";
      }
    } else if (this.plugin.settings.conflictViewMode === "split") {
      diffMode = "split";
    } else if (this.plugin.settings.conflictViewMode === "unified") {
      diffMode = "unified";
    }

    if (diffMode === "split") {
      this.root.render(
        <SplitView
          initialFiles={conflicts}
          onResolveAllConflicts={this.resolveAllConflicts.bind(this)}
        />,
      );
    } else {
      this.root.render(
        <UnifiedView
          initialFiles={conflicts}
          onResolveAllConflicts={this.resolveAllConflicts.bind(this)}
        />,
      );
    }
  }

  async onClose() {
    // Nothing to clean up.
  }
}
