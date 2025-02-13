import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  EditorView,
} from "@codemirror/view";
import { DiffResult } from "./diff";

interface DiffHighlightPluginSpec {
  diff: DiffResult[];
  isOriginal: boolean;
}

export function createDiffHighlightPlugin(spec: DiffHighlightPluginSpec) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      buildDecorations(view: EditorView): DecorationSet {
        const decorations = [];
        const doc = view.state.doc;

        // Go through the document line by line
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          const lineText = line.text;

          // Find matching diff for this line
          const diff = spec.diff.find((d) => d.value === lineText);

          if (
            diff &&
            ((spec.isOriginal && diff.type === "remove") ||
              (!spec.isOriginal && diff.type === "add"))
          ) {
            decorations.push(
              Decoration.mark({
                class: spec.isOriginal
                  ? "diff-remove-background"
                  : "diff-add-background",
              }).range(line.from, line.to),
            );
          }
        }

        return Decoration.set(decorations, true);
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
}
