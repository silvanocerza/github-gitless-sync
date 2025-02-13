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

        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          const diffResult = spec.diff.find((d) => {
            if (spec.isOriginal) {
              return (
                d.oldValue === line.text ||
                (d.type === "remove" && d.value === line.text)
              );
            } else {
              return d.type !== "remove" && d.value === line.text;
            }
          });

          if (diffResult && diffResult.type !== "equal") {
            let className = "";
            if (diffResult.type === "modify") {
              className = "diff-modify-background";
            } else if (diffResult.type === "add" && !spec.isOriginal) {
              className = "diff-add-background";
            } else if (diffResult.type === "remove" && spec.isOriginal) {
              className = "diff-remove-background";
            }

            if (className) {
              decorations.push(
                Decoration.line({
                  class: className,
                }).range(line.from),
              );
            }
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
