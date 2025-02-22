import { IconName, ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import DiffView from "./component";
import GitHubSyncPlugin from "src/main";
import * as React from "react";
import FilesTabBar from "./files-tab-bar";

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
  }

  getViewType() {
    return CONFLICTS_RESOLUTION_VIEW_TYPE;
  }

  getDisplayText() {
    return "Conflicts Resolution";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    // We don't want any padding, the DiffView component will handle that
    (container as HTMLElement).style.padding = "0";
    const root: Root = createRoot(container);
    const App = () => {
      const [oldText, setOldText] = React.useState(oldText3);
      const [newText, setNewText] = React.useState(newText3);

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
              files={["this", "that", "those"]}
              onTabChange={(filename: string) =>
                console.log(`Clicked ${filename}`)
              }
            />
            <DiffView
              oldText={oldText}
              newText={newText}
              onOldTextChange={setOldText}
              onNewTextChange={setNewText}
            />
          </div>
        </React.StrictMode>
      );
    };
    root.render(<App />);
  }

  async onClose() {
    // Nothing to clean up.
  }
}
