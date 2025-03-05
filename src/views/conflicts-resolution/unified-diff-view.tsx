import * as React from "react";
import CodeMirror, {
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@uiw/react-codemirror";
import { unifiedMergeView } from "@codemirror/merge";
import {
  Decoration,
  DecorationSet,
  EditorView,
  GutterMarker,
  keymap,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { ChangeSet, Prec, RangeSet, Text } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import diff, { DiffChunk } from "./diff";

const styles = document.createElement("style");
styles.innerHTML = `
  .cm-changedLine {
    background-color: rgba(var(--color-yellow-rgb), 0.1);
  }
  .cm-addedLine {
    background-color: rgba(var(--color-green-rgb), 0.1);
  }
  .cm-deletedLine {
    background-color: rgba(var(--color-red-rgb), 0.1);
  }
`;
document.head.appendChild(styles);

interface UnifiedDiffViewProps {
  initialOldText: string;
  initialNewText: string;
  onConflictResolved: () => void;
}

interface LineMapping {
  oldLine: number | null;
  finalLine: number;
  newLine: number | null;
}

const createUnifiedDocument = (
  oldText: string,
  newText: string,
  diffChunks: DiffChunk[],
): { doc: string; mapping: LineMapping[] } => {
  const sortedChunks = [...diffChunks].sort(
    (a, b) => a.startLeftLine - b.startLeftLine,
  );

  let lineMappings = [];

  let result = [];
  let oldTextLine = 1;
  let newTextLine = 1;

  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  let chunkIndex = 0;
  // Used to check if a line is in a chunk
  const isInChunk = (
    line: number,
    chunk: DiffChunk | undefined,
    side: "left" | "right",
  ) => {
    if (!chunk) {
      return false;
    }
    if (side === "left") {
      return line >= chunk.startLeftLine && line < chunk.endLeftLine;
    } else if (side === "right") {
      return line >= chunk.startRightLine && line < chunk.endRightLine;
    }
  };

  let closestChunk = sortedChunks[chunkIndex];
  while (oldTextLine <= oldLines.length || newTextLine <= newLines.length) {
    const leftLineInChunk = isInChunk(oldTextLine, closestChunk, "left");
    const rightLineInChunk = isInChunk(newTextLine, closestChunk, "right");

    if (!leftLineInChunk && !rightLineInChunk) {
      // Neither line is part of a chunk, they must be identical
      if (oldLines[oldTextLine - 1] !== newLines[newTextLine - 1]) {
        // TODO: Remove this, just verifying stuff works
        throw Error("Lines are different");
      }

      result.push(oldLines[oldTextLine - 1]);
      lineMappings.push({
        oldLine: oldTextLine,
        finalLine: result.length,
        newLine: newTextLine,
      });
      oldTextLine += 1;
      newTextLine += 1;
      continue;
    }

    if (leftLineInChunk && !rightLineInChunk) {
      // Old text is in a chunk, new text is not
      // We add the old text line to the result
      result.push(oldLines[oldTextLine - 1]);
      lineMappings.push({
        oldLine: oldTextLine,
        finalLine: result.length,
        newLine: null,
      });
      oldTextLine += 1;
      continue;
    }

    if (!leftLineInChunk && rightLineInChunk) {
      // New text is in a chunk, old text is not
      // We add the new text line to the result
      result.push(newLines[newTextLine - 1]);
      lineMappings.push({
        oldLine: null,
        finalLine: result.length,
        newLine: newTextLine,
      });
      newTextLine += 1;
      continue;
    }

    if (leftLineInChunk && rightLineInChunk) {
      // Both lines are in a chunk.
      // First we add all the lines from the old text

      let oldLinesToAdd = closestChunk.endLeftLine - closestChunk.startLeftLine;

      while (oldLinesToAdd !== 0) {
        result.push(oldLines[oldTextLine - 1]);
        lineMappings.push({
          oldLine: oldTextLine,
          finalLine: result.length,
          newLine: null,
        });
        oldTextLine += 1;
        oldLinesToAdd -= 1;
      }

      // Then we add all the lines from the new text
      let newLinesToAdd =
        closestChunk.endRightLine - closestChunk.startRightLine;

      while (newLinesToAdd !== 0) {
        result.push(newLines[newTextLine - 1]);
        lineMappings.push({
          oldLine: null,
          finalLine: result.length,
          newLine: newTextLine,
        });
        newTextLine += 1;
        newLinesToAdd -= 1;
      }

      // We consumed the chunk, get the next one
      chunkIndex += 1;
      closestChunk = sortedChunks[chunkIndex];
    }
  }

  return { doc: result.join("\n"), mapping: lineMappings };
};

const getLineDecoration = (mapping: LineMapping) => {
  if (mapping.oldLine !== null && mapping.newLine !== null) {
    // No decoration for this case
    return null;
  }

  if (mapping.oldLine === null) {
    // The line comes from the new document, it's an addition
    return Decoration.line({ class: "cm-addedLine" });
  } else if (mapping.newLine === null) {
    // The line comes from the old document, it's a deletion
    return Decoration.line({ class: "cm-deletedLine" });
  }
  return null;
};

function findMappingsRanges(mappings: LineMapping[]): number[][] {
  const ranges: number[][] = [];
  let currentRange: number[] | null = null;

  for (const mapping of mappings) {
    // If either oldLine or newLine is null
    if (mapping.oldLine === null || mapping.newLine === null) {
      if (!currentRange) {
        currentRange = [mapping.finalLine, mapping.finalLine];
      } else {
        currentRange[1] = mapping.finalLine;
      }
    } else if (currentRange) {
      ranges.push(currentRange);
      currentRange = null;
    }
  }

  if (currentRange) {
    ranges.push(currentRange);
  }

  // Return the first range found
  return ranges;
}

const buildDecorations = (mappings: LineMapping[]) => {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      mappings: LineMapping[];

      constructor(view: EditorView) {
        this.mappings = mappings;
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (!update.docChanged) {
          // Ignore non text changes
          return;
        }
        // console.log("Previous selection\n", update.startState.selection);
        // console.log("Current selection\n", update.state.selection);
        const ranges = findMappingsRanges(this.mappings);
        const affectedRanges = ranges.filter((range) => {
          return (
            update.changes.touchesRange(
              update.startState.doc.line(range[0]).from,
              update.startState.doc.line(range[1]).to,
            ) !== false
          );
        });
        console.log(affectedRanges);
        // update.changes.touchesRange(from);

        update.changes.iterChanges(
          (
            fromA: number,
            toA: number,
            fromB: number,
            toB: number,
            inserted: Text,
          ) => {
            // update.startState.doc.lineAt(fromA);
            // update.startState.doc.lineAt(toA);
            // console.log("fromA", fromA);
            // console.log("toA", toA);
            // console.log("fromB", fromB);
            // console.log("toB", toB);
            // console.log("inserted", inserted);
          },
        );
        this.decorations = this.buildDecorations(update.view);
      }

      buildDecorations(view: EditorView): DecorationSet {
        const decorations = [];
        const doc = view.state.doc;
        for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
          const mapping = this.mappings.find((m) => m.finalLine === lineNumber);
          if (!mapping) {
            // Unlikely
            continue;
          }
          const deco = getLineDecoration(mapping);
          if (deco) {
            const line = doc.line(lineNumber);
            decorations.push(deco.range(line.from));
          }
        }
        return Decoration.set(decorations, true);
      }
    },
    { decorations: (v) => v.decorations },
  );
};

interface ConflictRange {
  from: number;
  to: number;
  source: "old" | "new" | "both"; // where the content originated
}

const UnifiedDiffView: React.FC<UnifiedDiffViewProps> = ({
  initialOldText,
  initialNewText,
  onConflictResolved,
}) => {
  const diffChunks = diff(initialOldText, initialNewText);
  const { doc: unified, mapping } = createUnifiedDocument(
    initialOldText,
    initialNewText,
    diffChunks,
  );

  const unifiedLines = unified.split("\n");

  const initialRanges: ConflictRange[] = mapping.map((m) => {
    // Calculate line positions directly from text
    const lineStartPos = unifiedLines
      .slice(0, m.finalLine - 1)
      .join("\n").length;
    // Add 1 for the newline except for first line
    const fromPos = m.finalLine > 1 ? lineStartPos + 1 : 0;
    const toPos = fromPos + unifiedLines[m.finalLine - 1].length;

    return {
      from: fromPos,
      to: toPos,
      source:
        m.oldLine !== null && m.newLine !== null
          ? "both"
          : m.oldLine !== null
            ? "old"
            : "new",
    };
  });

  const conflictRangesField = StateField.define<ConflictRange[]>({
    create: () => initialRanges,
    update: (ranges, tr) => {
      if (!tr.docChanged) {
        return ranges;
      }

      // Map all positions through the changes
      const newRanges = ranges
        .map((range) => ({
          from: tr.changes.mapPos(range.from),
          // mapPos by default tries to keep the new position close to the char
          // before it.
          // Since we need to know when a new line is added at the end of a range
          // we set `assoc` to 1 so the new position is close to the char after it.
          to: tr.changes.mapPos(range.to, 1),
          source: range.source,
        }))
        .filter((range) => range.from !== range.to); // Remove empty ranges

      return newRanges;
    },
  });

  const buildDecorationsAlternate = EditorView.decorations.compute(
    ["doc", conflictRangesField],
    (state) => {
      const ranges = state.field(conflictRangesField);
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
    },
  );

  const extensions = [
    conflictRangesField,
    buildDecorationsAlternate,
    EditorView.editable.of(true),
    EditorView.theme({
      "&": {
        backgroundColor: "var(--background-primary)",
        color: "var(--text-normal)",
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
    }),
  ];

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <CodeMirror
        // value={newText}
        value={unified}
        height="100%"
        theme="none"
        basicSetup={false}
        extensions={extensions}
      />
    </div>
  );
};

export default UnifiedDiffView;
