import { IconName, ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import DiffView from "./component";
import GitHubSyncPlugin from "src/main";
import { PluginContext } from "../hooks";

export const CONFLICTS_RESOLUTION_VIEW_TYPE = "conflicts-resolution-view";

// Test Case 1: Simple line changes
const oldText1 = `# My Document
This is a test
Some content here
Some line
Another line
Final line`;

const newText1 = `# My Document
This is a modified test
Some new content here
Some line
Final line`;

// Test Case 2: Markdown with formatting
const oldText2 = `# Title
## Subtitle
- List item 1
- List item 2

**Bold text** and *italic* text
Regular paragraph`;

const newText2 = `# Modified Title
## Subtitle
- List item 1
- List item 2
- New item

**Bold text** and *italic* text
Modified paragraph
New paragraph`;

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
    const root: Root = createRoot(container);
    root.render(
      <PluginContext.Provider value={this.plugin}>
        <DiffView
          oldText={oldText1}
          newText={newText1}
          onResolve={(text) => console.log("Resolved:", text)}
        />
      </PluginContext.Provider>,
    );
  }

  async onClose() {
    // Nothing to clean up.
  }
}
