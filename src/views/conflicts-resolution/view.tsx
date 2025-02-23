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
      const [currentFileIndex, setCurrentFileIndex] = React.useState(0);
      const currentFile = files.at(currentFileIndex);
      return (
        <React.StrictMode>
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
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
            />
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
