import * as React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";

import diff, { DiffChunk } from "../diff";
import { createRangesStateField } from "./ranges-state-field";
import {
  createLineDecorations,
  createResolutionDecorations,
} from "./decorations";

interface DiffViewProps {
  initialOldText: string;
  initialNewText: string;
  onConflictResolved: (content: string) => void;
}

/// Create a unique document that combines text from the remote
/// and the local document depending on the diff chunks.
/// This returns a single string of the combined documents and the
/// ranges that specify whether a certain document range comes from
/// remote, local or both documents, so we can highlight them.
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

const DiffView: React.FC<DiffViewProps> = ({
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
      createLineDecorations(conflictRangesField),
      createResolutionDecorations(
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

export default DiffView;
