import * as React from "react";
import CodeMirror, {
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
  Transaction,
} from "@uiw/react-codemirror";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";

import diff, { DiffChunk } from "./diff";
import { createRoot } from "react-dom/client";
import UnifiedResolutionBar from "./unified-resolution-bar";

interface UnifiedDiffViewProps {
  initialOldText: string;
  initialNewText: string;
  onConflictResolved: (content: string) => void;
}

const createUnifiedDocument = (
  oldText: string,
  newText: string,
  diffChunks: DiffChunk[],
): { doc: string; lineRanges: ConflictRange[] } => {
  const sortedChunks = [...diffChunks].sort(
    (a, b) => a.startLeftLine - b.startLeftLine,
  );

  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  let result: string[] = [];
  let lineRanges: ConflictRange[] = [];
  let linePosition = 0;
  let currentRange: ConflictRange | null = null;

  let oldTextLine = 1;
  let newTextLine = 1;

  const addLine = (line: string, source: "old" | "new" | "both") => {
    result.push(line);

    const startPos = linePosition;
    const endPos = linePosition + line.length;

    if (currentRange && currentRange.source === source) {
      // Extend existing range
      currentRange.to = endPos;
    } else {
      // Create new range
      if (currentRange) {
        lineRanges.push(currentRange);
      }
      currentRange = { from: startPos, to: endPos, source };
    }

    // Move position to start of next line
    linePosition = endPos + 1; // +1 for newline
  };

  // Process each chunk
  for (const chunk of sortedChunks) {
    // Add common lines before the chunk
    while (
      oldTextLine < chunk.startLeftLine &&
      newTextLine < chunk.startRightLine
    ) {
      addLine(oldLines[oldTextLine - 1], "both");
      oldTextLine++;
      newTextLine++;
    }

    // Add removed lines (from old text)
    for (let i = oldTextLine; i < chunk.endLeftLine; i++) {
      addLine(oldLines[i - 1], "old");
    }

    // Add added lines (from new text)
    for (let i = newTextLine; i < chunk.endRightLine; i++) {
      addLine(newLines[i - 1], "new");
    }

    // Update line pointers
    oldTextLine = chunk.endLeftLine;
    newTextLine = chunk.endRightLine;
  }

  // Add remaining common lines after the last chunk
  while (oldTextLine <= oldLines.length && newTextLine <= newLines.length) {
    if (oldTextLine > oldLines.length || newTextLine > newLines.length) break;
    addLine(oldLines[oldTextLine - 1], "both");
    oldTextLine++;
    newTextLine++;
  }

  // Add the final range if there is one
  if (currentRange) {
    lineRanges.push(currentRange);
  }

  return { doc: result.join("\n"), lineRanges };
};

type RangeChangeSourceOperation = {
  index: number;
  newSource: "old" | "new" | "both";
};

type RangeRemoveOperation = {
  index: number;
};

type RangeUpdateOperation = RangeChangeSourceOperation | RangeRemoveOperation;

const updateRangesEffect = StateEffect.define<RangeUpdateOperation>();

const createRangesStateField = (
  initialRanges: ConflictRange[],
): StateField<ConflictRange[]> => {
  return StateField.define<ConflictRange[]>({
    create: () => initialRanges,
    update: (ranges, tr) => {
      const rangeEffects = tr.effects
        .filter((e) => e.is(updateRangesEffect))
        .reduce((acc, e) => {
          const operation = e.value as RangeUpdateOperation;
          acc.set(operation.index, operation);
          return acc;
        }, new Map<number, RangeUpdateOperation>());

      if (!tr.docChanged && rangeEffects.size === 0) {
        return ranges;
      }

      // Map all positions through the changes and apply any effect
      let newRanges = ranges
        .map((range, index) => {
          let source = range.source;
          const effect = rangeEffects.get(index) as RangeChangeSourceOperation;
          if (effect) {
            source = effect.newSource;
          }
          return {
            from: tr.changes.mapPos(range.from),
            to: tr.changes.mapPos(range.to, 1),
            source,
          };
        })
        .filter((range, index) => {
          return range.from !== range.to && !rangeEffects.has(index);
        });

      // Sort ranges by start position (leftmost first)
      newRanges.sort((a, b) => a.from - b.from);

      // Process ranges line by line
      const lineToRangeMap = new Map(); // Maps line number to controlling range

      // First pass: determine which range controls each line
      for (const range of newRanges) {
        const startLine = tr.newDoc.lineAt(range.from).number;
        const endLine = tr.newDoc.lineAt(range.to).number;

        for (let line = startLine; line <= endLine; line++) {
          // If this line isn't claimed yet, the leftmost range (processed first) gets it
          if (!lineToRangeMap.has(line)) {
            lineToRangeMap.set(line, range);
          }
        }
      }

      // Second pass: merge ranges that control consecutive lines
      const mergedRanges = [];
      let currentRange = null;

      // Process lines in order
      const allLines = Array.from(lineToRangeMap.keys()).sort((a, b) => a - b);

      for (const line of allLines) {
        const rangeForLine = lineToRangeMap.get(line);

        if (!currentRange) {
          // Start a new merged range
          currentRange = {
            from: tr.newDoc.line(line).from,
            to: tr.newDoc.line(line).to,
            source: rangeForLine.source,
          };
        } else if (
          currentRange.source === rangeForLine.source &&
          line === tr.newDoc.lineAt(currentRange.to).number + 1
        ) {
          // Extend current range if it's the same source and consecutive line
          currentRange.to = tr.newDoc.line(line).to;
        } else {
          // Finish current range and start a new one
          mergedRanges.push(currentRange);
          currentRange = {
            from: tr.newDoc.line(line).from,
            to: tr.newDoc.line(line).to,
            source: rangeForLine.source,
          };
        }
      }

      // Add the last range
      if (currentRange) {
        mergedRanges.push(currentRange);
      }

      return mergedRanges;
    },
  });
};

const createDecorationsExtension = (
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
        if (range.source === "old") {
          builder.add(
            line.from,
            line.from,
            Decoration.line({ class: "cm-deletedLine" }),
          );
        } else if (range.source === "new") {
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

interface ConflictRange {
  from: number;
  to: number;
  source: "old" | "new" | "both"; // where the content originated
}

interface ResolutionWidgetProps {
  onAccept?: () => void;
  onDiscard?: () => void;
  onAcceptAbove?: () => void;
  onAcceptBelow?: () => void;
  onAcceptBoth?: () => void;
  onDiscardBoth?: () => void;
}

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

const createBlockDecorations = (
  rangesStateField: StateField<ConflictRange[]>,
  getView: () => EditorView,
) => {
  return EditorView.decorations.compute(
    [rangesStateField],
    (state: EditorState) => {
      const ranges = state.field(rangesStateField);
      let widgets = [];

      ranges.forEach((range: ConflictRange, index: number) => {
        if (range.source === "both") {
          return;
        }
        const previousRange = ranges.at(index - 1);
        const nextRange = ranges.at(index + 1);

        if (range.source === "old") {
          const nextRangeIsNew = nextRange?.source === "new";
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
                      updateRangesEffect.of({
                        index,
                        newSource: "both",
                      }),
                      updateRangesEffect.of({
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
                      updateRangesEffect.of({
                        index,
                      }),
                      updateRangesEffect.of({
                        index: index + 1,
                        newSource: "both",
                      }),
                    ],
                  });
                },
                onAcceptBoth: () => {
                  getView().dispatch({
                    effects: [
                      updateRangesEffect.of({
                        index,
                        newSource: "both",
                      }),
                      updateRangesEffect.of({
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
                      updateRangesEffect.of({
                        index,
                      }),
                      updateRangesEffect.of({
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
                    effects: updateRangesEffect.of({
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
                    effects: updateRangesEffect.of({
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
        } else if (range.source === "new" && previousRange?.source !== "old") {
          // We draw this only in case the previous range doesn't come from the old document
          // since we handle that above
          const deco = Decoration.widget({
            widget: new ResolutionWidget({
              onAccept: () => {
                getView().dispatch({
                  effects: updateRangesEffect.of({
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
                  effects: updateRangesEffect.of({
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

const UnifiedDiffView: React.FC<UnifiedDiffViewProps> = ({
  initialOldText,
  initialNewText,
  onConflictResolved,
}) => {
  const editorViewRef = React.useRef<EditorView | null>(null);

  const diffChunks = diff(initialOldText, initialNewText);
  const { doc, lineRanges } = createUnifiedDocument(
    initialOldText,
    initialNewText,
    diffChunks,
  );

  const [hasConflicts, setHasConflicts] = React.useState(diffChunks.length > 0);

  const extensions = React.useMemo(() => {
    const conflictRangesField = createRangesStateField(lineRanges);
    return [
      conflictRangesField,
      createDecorationsExtension(conflictRangesField),
      createBlockDecorations(
        conflictRangesField,

        () => editorViewRef.current!,
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const conflictRanges = update.state.field(conflictRangesField);
          const allConflictsSolved = conflictRanges.some(
            (range) => range.source === "old" || range.source === "new",
          );

          if (!allConflictsSolved) {
            setHasConflicts(allConflictsSolved);
          }
        }
      }),
      EditorView.editable.of(true),
      EditorView.theme({
        "&": {
          backgroundColor: "var(--background-primary)",
          color: "var(--text-normal)",
          borderTop: "1px solid var(--background-modifier-border)",
          borderBottom: "1px solid var(--background-modifier-border)",
        },
        ".cm-content": {
          padding: 0,
          caretColor: "var(--caret-color)",
          fontSize: "var(--font-text-size)",
          fontFamily: "var(--font-text)",
        },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
          background: "var(--text-selection)",
        },
        "&.cm-focused": {
          outline: 0,
        },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "var(--text-normal)",
        },
        ".cm-addedLine": {
          backgroundColor: "rgba(var(--color-green-rgb), 0.1)",
        },
        ".cm-deletedLine": {
          backgroundColor: "rgba(var(--color-red-rgb), 0.1)",
        },
      }),
    ];
  }, [initialOldText, initialNewText]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <CodeMirror
        value={doc}
        height="100%"
        theme="none"
        basicSetup={false}
        extensions={extensions}
        onCreateEditor={(view: EditorView) => {
          editorViewRef.current = view;
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: "var(--size-4-4)",
        }}
      >
        <button
          style={
            hasConflicts
              ? {}
              : {
                  backgroundColor: "var(--interactive-accent)",
                  color: "var(--text-on-accent)",
                }
          }
          disabled={hasConflicts}
          onClick={() => {
            const content = editorViewRef.current!.state.doc.toString();
            onConflictResolved(content);
          }}
        >
          Resolve conflict
        </button>
      </div>
    </div>
  );
};

export default UnifiedDiffView;
