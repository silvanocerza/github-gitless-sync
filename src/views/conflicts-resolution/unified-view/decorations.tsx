import {
  EditorState,
  Range,
  RangeSetBuilder,
  StateField,
} from "@uiw/react-codemirror";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";

import { createRoot } from "react-dom/client";
import UnifiedResolutionBar from "./unified-resolution-bar";
import { UpdateRangesEffect } from "./ranges-state-field";

interface ResolutionWidgetProps {
  onAccept?: () => void;
  onDiscard?: () => void;
  onAcceptAbove?: () => void;
  onAcceptBelow?: () => void;
  onAcceptBoth?: () => void;
  onDiscardBoth?: () => void;
}

/// Widget that show some buttons to the user so they can resolve the conflicts.
/// This is usually drawn between two conflicting ranges in the document, if
/// the conflict comes only from a single document this will be shown on top.
///
/// If onAccept and onDiscard are set only the accept and discard buttons will be shown,
/// this is used when the conflict comes from a single document.
/// If either is not set all the other buttons will be shown.
class ResolutionWidget extends WidgetType {
  onAccept?: () => void;
  onDiscard?: () => void;
  onAcceptAbove?: () => void;
  onAcceptBelow?: () => void;
  onAcceptBoth?: () => void;
  onDiscardBoth?: () => void;

  constructor(props: ResolutionWidgetProps) {
    super();
    ({
      onAccept: this.onAccept,
      onDiscard: this.onDiscard,
      onAcceptAbove: this.onAcceptAbove,
      onAcceptBelow: this.onAcceptBelow,
      onAcceptBoth: this.onAcceptBoth,
      onDiscardBoth: this.onDiscardBoth,
    } = props);
  }

  toDOM(): HTMLElement {
    const div = document.createElement("div");
    const root = createRoot(div);
    root.render(
      <UnifiedResolutionBar
        onAccept={this.onAccept}
        onDiscard={this.onDiscard}
        onAcceptAbove={this.onAcceptAbove}
        onAcceptBelow={this.onAcceptBelow}
        onAcceptBoth={this.onAcceptBoth}
        onDiscardBoth={this.onDiscardBoth}
      />,
    );
    return div;
  }
}

/// Create a line decoration for CodeMirror editor that highlights
/// the ranges set by the ranges state field to show where the text comes from.
/// Text coming from remote will be shown as red and local as green.
export const createLineDecorations = (
  rangesStateField: StateField<ConflictRange[]>,
) => {
  return EditorView.decorations.compute(["doc", rangesStateField], (state) => {
    const ranges = state.field(rangesStateField);
    const builder = new RangeSetBuilder<Decoration>();

    for (const range of ranges) {
      const startLine = state.doc.lineAt(range.from);
      const endLine = state.doc.lineAt(range.to);
      for (let i = 0; i <= endLine.number - startLine.number; i += 1) {
        const line = state.doc.line(startLine.number + i);
        if (range.source === "remote") {
          builder.add(
            line.from,
            line.from,
            Decoration.line({ class: "cm-deletedLine" }),
          );
        } else if (range.source === "local") {
          builder.add(
            line.from,
            line.from,
            Decoration.line({ class: "cm-addedLine" }),
          );
        }
      }
    }

    return builder.finish();
  });
};

/// Create the resolution buttons depending on the ranges state field.
/// We need the view to dispatch the transaction to update the document
/// and delete the ranges when the user click the buttons.
export const createResolutionDecorations = (
  rangesStateField: StateField<ConflictRange[]>,
  getView: () => EditorView,
) => {
  return EditorView.decorations.compute(
    [rangesStateField],
    (state: EditorState) => {
      const ranges = state.field(rangesStateField);
      let widgets: Range<Decoration>[] = [];

      ranges.forEach((range: ConflictRange, index: number) => {
        if (range.source === "both") {
          return;
        }
        const previousRange = ranges.at(index - 1);
        const nextRange = ranges.at(index + 1);

        if (range.source === "remote") {
          const nextRangeIsNew = nextRange?.source === "local";
          if (nextRangeIsNew) {
            const deco = Decoration.widget({
              widget: new ResolutionWidget({
                onAcceptAbove: () => {
                  getView().dispatch({
                    changes: {
                      from: range.to,
                      to: nextRange.to,
                      insert: "",
                    },
                    effects: [
                      UpdateRangesEffect.of({
                        index,
                        newSource: "both",
                      }),
                      UpdateRangesEffect.of({
                        index: index + 1,
                      }),
                    ],
                  });
                },
                onAcceptBelow: () => {
                  getView().dispatch({
                    changes: {
                      from: range.from,
                      to: nextRange?.from || range.to,
                      insert: "",
                    },
                    effects: [
                      UpdateRangesEffect.of({
                        index,
                      }),
                      UpdateRangesEffect.of({
                        index: index + 1,
                        newSource: "both",
                      }),
                    ],
                  });
                },
                onAcceptBoth: () => {
                  getView().dispatch({
                    effects: [
                      UpdateRangesEffect.of({
                        index,
                        newSource: "both",
                      }),
                      UpdateRangesEffect.of({
                        index: index + 1,
                        newSource: "both",
                      }),
                    ],
                  });
                },
                onDiscardBoth: () => {
                  getView().dispatch({
                    changes: {
                      from: Math.max(range.from - 1, 0),
                      to: ranges.at(index + 2)?.from || nextRange.to,
                      insert: "",
                    },
                    effects: [
                      UpdateRangesEffect.of({
                        index,
                      }),
                      UpdateRangesEffect.of({
                        index: index + 1,
                      }),
                    ],
                  });
                },
              }),
              side: 1,
              block: true,
            });
            widgets.push(deco.range(range.to));
          } else {
            const deco = Decoration.widget({
              widget: new ResolutionWidget({
                onAccept: () => {
                  getView().dispatch({
                    effects: UpdateRangesEffect.of({
                      index: index,
                      newSource: "both",
                    }),
                  });
                },
                onDiscard: () => {
                  getView().dispatch({
                    changes: {
                      from: Math.max(range.from - 1, 0),
                      to: nextRange?.from || range.to,
                      insert: "",
                    },
                    effects: UpdateRangesEffect.of({
                      index: index,
                    }),
                  });
                },
              }),
              side: -1,
              block: true,
            });
            widgets.push(deco.range(range.from));
          }
        } else if (
          range.source === "local" &&
          previousRange?.source !== "remote"
        ) {
          // We draw this only in case the previous range doesn't come from the old document
          // since we handle that above
          const deco = Decoration.widget({
            widget: new ResolutionWidget({
              onAccept: () => {
                getView().dispatch({
                  effects: UpdateRangesEffect.of({
                    index: index,
                    newSource: "both",
                  }),
                });
              },
              onDiscard: () => {
                getView().dispatch({
                  changes: {
                    from: Math.max(range.from - 1, 0),
                    to: nextRange?.from || range.to,
                    insert: "",
                  },
                  effects: UpdateRangesEffect.of({
                    index: index,
                  }),
                });
              },
            }),
            side: -1,
            block: true,
          });
          widgets.push(deco.range(range.from));
        }
      });

      return Decoration.set(widgets);
    },
  );
};
