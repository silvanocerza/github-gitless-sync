import * as React from "react";
import CodeMirror, { RangeSetBuilder, StateField } from "@uiw/react-codemirror";
import { Decoration, EditorView } from "@codemirror/view";

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

const createInitialRanges = (
  doc: string,
  mappings: LineMapping[],
): ConflictRange[] => {
  const lines = doc.split("\n");
  return mappings.map((m) => {
    // Calculate line positions directly from text
    const lineStartPos = lines.slice(0, m.finalLine - 1).join("\n").length;
    // Add 1 for the newline except for first line
    const from = m.finalLine > 1 ? lineStartPos + 1 : 0;
    const to = from + lines[m.finalLine - 1].length;

    return {
      from,
      to,
      source:
        m.oldLine !== null && m.newLine !== null
          ? "both"
          : m.oldLine !== null
            ? "old"
            : "new",
    };
  });
};

const createRangesStateField = (
  initialRanges: ConflictRange[],
): StateField<ConflictRange[]> => {
  return StateField.define<ConflictRange[]>({
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

const UnifiedDiffView: React.FC<UnifiedDiffViewProps> = ({
  initialOldText,
  initialNewText,
  onConflictResolved,
}) => {
  const diffChunks = diff(initialOldText, initialNewText);
  const { doc, mapping } = createUnifiedDocument(
    initialOldText,
    initialNewText,
    diffChunks,
  );

  const initialRanges = createInitialRanges(doc, mapping);
  const conflictRangesField = createRangesStateField(initialRanges);

  const extensions = [
    conflictRangesField,
    createDecorationsExtension(conflictRangesField),
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
        value={doc}
        height="100%"
        theme="none"
        basicSetup={false}
        extensions={extensions}
      />
    </div>
  );
};

export default UnifiedDiffView;
