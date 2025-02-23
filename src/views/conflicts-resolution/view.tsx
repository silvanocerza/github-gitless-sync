import { IconName, ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import DiffView from "./component";
import GitHubSyncPlugin from "src/main";
import * as React from "react";
import FilesTabBar from "./files-tab-bar";
import { ConflictFile, ConflictResolution } from "src/sync-manager";

export const CONFLICTS_RESOLUTION_VIEW_TYPE = "conflicts-resolution-view";

// Test Case 1: Simple line changes
let oldText1 = `# My Document
This is a test
Some content here
Some line
Another line
Final line`;

let newText1 = `# My Document
This is a modified test
Some new content here
Some line
Final line`;

// Test Case 2: Markdown with formatting
let oldText2 = `# Title
## Subtitle
- List item 1
- List item 2

**Bold text** and *italic* text
Regular paragraph`;

let newText2 = `# Modified Title
## Subtitle
- List item 1
- List item 2
- New item

**Bold text** and *italic* text
Modified paragraph
New paragraph`;

let oldText3 = `# My Document
This is a modified test
Some new content here

This is a test
Some content here
Some line
Another line
Final line


asdfasdf`;

let newText3 = `# My Document
This is a modified test
Some new content here






This is a test
Some content here
Some line
Another line
Final line

asdfasdf`;

export class ConflictsResolutionView extends ItemView {
  icon: IconName = "merge";

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: GitHubSyncPlugin,
  ) {
    super(leaf);
    console.log(`Created ${CONFLICTS_RESOLUTION_VIEW_TYPE}`);
  }

  getViewType() {
    return CONFLICTS_RESOLUTION_VIEW_TYPE;
  }

  getDisplayText() {
    return "Conflicts Resolution";
  }

  onResolve(resolutions: ConflictResolution[]) {
    if (this.plugin.conflictsResolver) {
      this.plugin.conflictsResolver(resolutions);
      this.plugin.conflictsResolver = null;
    }
  }

  setConflictFiles(conflicts: ConflictFile[]) {
    const mockFiles: ConflictFile[] = [
      { filename: "this", remoteContent: oldText1, localContent: newText1 },
      { filename: "that", remoteContent: oldText2, localContent: newText2 },
      { filename: "those", remoteContent: oldText3, localContent: newText3 },
    ];
    this.render(mockFiles);
  }

  async onOpen() {
    console.log(`Opened ${CONFLICTS_RESOLUTION_VIEW_TYPE}`);

    // const mockFiles: ConflictFile[] = [
    //   { filename: "this", remoteContent: oldText1, localContent: newText1 },
    //   { filename: "that", remoteContent: oldText2, localContent: newText2 },
    //   { filename: "those", remoteContent: oldText3, localContent: newText3 },
    // ];
    // this.render(mockFiles);
  }

  private render(conflicts: ConflictFile[]) {
    const container = this.containerEl.children[1];
    container.empty();
    // We don't want any padding, the DiffView component will handle that
    (container as HTMLElement).style.padding = "0";
    const root: Root = createRoot(container);
    const App = ({ initialFiles }: { initialFiles: ConflictFile[] }) => {
      const [files, setFiles] = React.useState(initialFiles);
      const [resolvedConflicts, setResolvedConflicts] = React.useState<
        ConflictResolution[]
      >([]);
      const [currentFileIndex, setCurrentFileIndex] = React.useState(0);
      const currentFile = files.at(currentFileIndex);

      const onConflictResolved = () => {
        // Remove the file from the conflicts to resolve
        setFiles(files.filter((_, index) => index !== currentFileIndex));
        // Keep track of the resolved conflicts
        setResolvedConflicts([
          ...resolvedConflicts,
          {
            filename: currentFile!.filename,
            // We could get either the local or remote content at this point since
            // they're identical
            content: currentFile!.localContent,
          },
        ]);
        // Select the previous file only if we're not already at the start
        if (currentFileIndex > 0) {
          setCurrentFileIndex(currentFileIndex - 1);
        }
        if (files.length === 0) {
          // We solved all conflicts, we can resume syncing
          this.onResolve(resolvedConflicts);
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
                  files={files.map((f) => f.filename)}
                  currentFile={currentFile?.filename || ""}
                  setCurrentFileIndex={setCurrentFileIndex}
                />
                <DiffView
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
    root.render(<App initialFiles={conflicts} />);
  }

  async onClose() {
    // Nothing to clean up.
    console.log(`Closed ${CONFLICTS_RESOLUTION_VIEW_TYPE}`);
  }
}
