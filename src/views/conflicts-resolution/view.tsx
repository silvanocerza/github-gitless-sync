import { IconName, ItemView, Menu, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import SplitDiffView from "./split-diff-view";
import GitHubSyncPlugin from "src/main";
import * as React from "react";
import FilesTabBar from "./files-tab-bar";
import { ConflictFile, ConflictResolution } from "src/sync-manager";

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
    const App = ({ initialFiles }: { initialFiles: ConflictFile[] }) => {
      const [files, setFiles] = React.useState(initialFiles);
      const [resolvedConflicts, setResolvedConflicts] = React.useState<
        ConflictResolution[]
      >([]);
      const [currentFileIndex, setCurrentFileIndex] = React.useState(0);
      const currentFile = files.at(currentFileIndex);

      const onConflictResolved = () => {
        // Remove the file from the conflicts to resolve
        const remainingFiles = files.filter(
          (_, index) => index !== currentFileIndex,
        );
        setFiles(remainingFiles);
        // Keep track of the resolved conflicts
        const newResolvedConflicts = [
          ...resolvedConflicts,
          {
            filePath: currentFile!.filePath,
            content: currentFile!.localContent,
          },
        ];
        setResolvedConflicts(newResolvedConflicts);
        // Select the previous file only if we're not already at the start
        if (currentFileIndex > 0) {
          setCurrentFileIndex(currentFileIndex - 1);
        }
        if (remainingFiles.length === 0) {
          // We solved all conflicts, we can resume syncing
          this.resolveAllConflicts(newResolvedConflicts);
        }
      };

      return (
        <React.StrictMode>
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {files.length === 0 ? (
              <div
                style={{
                  position: "relative",
                  textAlign: "center",
                  alignSelf: "center",
                }}
              >
                <div
                  style={{
                    margin: "20px 0",
                    fontWeight: "var(--h2-weight)",
                    fontSize: "var(--h2-size)",
                    lineHeight: "var(--line-height-tight)",
                  }}
                >
                  No conflicts to resolve
                </div>
                <div
                  style={{
                    margin: "20px 0",
                    fontSize: "var(--font-text-size)",
                    color: "var(--text-muted)",
                    lineHeight: "var(--line-height-tight)",
                  }}
                >
                  That's good, keep going
                </div>
              </div>
            ) : (
              <>
                <FilesTabBar
                  files={files.map((f) => f.filePath)}
                  currentFile={currentFile?.filePath || ""}
                  setCurrentFileIndex={setCurrentFileIndex}
                />
                <SplitDiffView
                  oldText={currentFile?.remoteContent || ""}
                  newText={currentFile?.localContent || ""}
                  onOldTextChange={(content: string) => {
                    const tempFiles = [...files];
                    tempFiles[currentFileIndex].remoteContent = content;
                    setFiles(tempFiles);
                  }}
                  onNewTextChange={(content: string) => {
                    const tempFiles = [...files];
                    tempFiles[currentFileIndex].localContent = content;
                    setFiles(tempFiles);
                  }}
                  onConflictResolved={onConflictResolved}
                />
              </>
            )}
          </div>
        </React.StrictMode>
      );
    };
    this.root.render(<App initialFiles={conflicts} />);
  }

  async onClose() {
    // Nothing to clean up.
  }
}
