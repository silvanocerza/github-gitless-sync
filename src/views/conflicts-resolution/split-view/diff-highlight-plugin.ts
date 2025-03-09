import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  EditorView,
  ViewUpdate,
} from "@codemirror/view";
import { DiffChunk } from "../diff";

export interface DiffHighlightPluginSpec {
  diff: DiffChunk[];
  isOriginal: boolean;
}

export function createDiffHighlightPlugin(spec: DiffHighlightPluginSpec) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const decorations = [];
        const doc = view.state.doc;

        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);

          const diffResult = spec.diff.find((chunk) => {
            if (spec.isOriginal) {
              return (
                (chunk.type === "remove" || chunk.type === "modify") &&
                i >= chunk.startLeftLine &&
                i < chunk.endLeftLine
              );
            }
            return (
              (chunk.type === "add" || chunk.type === "modify") &&
              i >= chunk.startRightLine &&
              i < chunk.endRightLine
            );
          });

          if (diffResult) {
            const className =
              diffResult.type === "modify"
                ? "diff-modify-background"
                : diffResult.type === "add"
                  ? "diff-add-background"
                  : "diff-remove-background";

            decorations.push(
              Decoration.line({
                class: className,
              }).range(line.from),
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
