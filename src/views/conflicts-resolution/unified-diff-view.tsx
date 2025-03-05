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
  const { doc, lineRanges } = createUnifiedDocument(
    initialOldText,
    initialNewText,
    diffChunks,
  );
  const conflictRangesField = createRangesStateField(lineRanges);

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
