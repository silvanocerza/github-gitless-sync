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
        const doc = view.state.doc.toString();

        const decorations = spec.diff
          .map((d) => {
            if (
              (spec.isOriginal && d.type === "remove") ||
              (!spec.isOriginal && d.type === "add")
            ) {
              // Find the text position in the actual document
              const pos = doc.indexOf(d.value);
              if (pos !== -1) {
                return Decoration.mark({
                  class: spec.isOriginal
                    ? "diff-remove-background"
                    : "diff-add-background",
                }).range(pos, pos + d.value.length);
              }
            }
            return null;
          })
          .filter((d): d is NonNullable<typeof d> => d !== null);

        return Decoration.set(decorations, true);
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
}
