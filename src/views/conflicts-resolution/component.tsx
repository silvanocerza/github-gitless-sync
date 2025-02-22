import { useEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import diff, { DiffChunk } from "./diff";
import { createDiffHighlightPlugin } from "./diff-highlight-plugin";
import EditorPane from "./editor-pane";
import ActionsGutter from "./actions-gutter";
import * as React from "react";

// Add styles for diff highlighting
const styles = document.createElement("style");
styles.innerHTML = `
  .diff-modify-background {
    background-color: rgba(var(--color-yellow-rgb), 0.1);
  }
  .diff-add-background {
    background-color: rgba(var(--color-green-rgb), 0.1);
  }
  .diff-remove-background {
    background-color: rgba(var(--color-red-rgb), 0.1);
  }
`;
document.head.appendChild(styles);

interface DiffViewProps {
  oldText: string;
  newText: string;
  onOldTextChange: (content: string) => void;
  onNewTextChange: (content: string) => void;
}

const DiffView: React.FC<DiffViewProps> = ({
  oldText,
  newText,
  onOldTextChange,
  onNewTextChange,
}) => {
  // We need to know the line height to correctly draw the ribbon between the left
  // and right editor in the actions gutter
  const [lineHeight, setLineHeight] = React.useState<number>(0);
  const handleEditorReady = (editor: EditorView) => {
    setLineHeight(editor.defaultLineHeight);
  };

  const [leftEditorTopOffset, setLeftEditorTopOffset] =
    React.useState<number>(0);
  const [rightEditorTopOffset, setRightEditorTopOffset] =
    React.useState<number>(0);

  const diffs = diff(oldText, newText);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, overflow: "hidden" }}>
        <EditorPane
          content={oldText}
          highlightPluginSpec={{
            diff: diffs,
            isOriginal: true,
          }}
          onEditorUpdate={handleEditorReady}
          onContentChange={onOldTextChange}
          onScrollTopUpdate={setLeftEditorTopOffset}
        />
      </div>
      <div style={{ minWidth: "160px", width: "auto" }}>
        <ActionsGutter
          diffChunks={diffs}
          lineHeight={lineHeight}
          leftEditorTopOffset={leftEditorTopOffset}
          rightEditorTopLineOffset={rightEditorTopOffset}
          onAcceptLeft={(chunk: DiffChunk) => {
            if (chunk.type === "add") {
              const oldLines = oldText.split("\n");
              oldLines.splice(
                chunk.startLeftLine - 1,
                0,
                ...newText
                  .split("\n")
                  .slice(chunk.startRightLine - 1, chunk.endRightLine - 1),
              );
              onOldTextChange(oldLines.join("\n"));
            } else if (chunk.type === "modify") {
              const oldLines = oldText.split("\n");
              oldLines.splice(
                chunk.startLeftLine - 1,
                chunk.endLeftLine - chunk.startLeftLine,
                ...newText
                  .split("\n")
                  .slice(chunk.startRightLine - 1, chunk.endRightLine - 1),
              );
              onOldTextChange(oldLines.join("\n"));
            }
          }}
          onAcceptRight={(chunk: DiffChunk) => {
            if (chunk.type === "remove") {
              const newLines = newText.split("\n");
              newLines.splice(
                chunk.startRightLine - 1,
                0,
                ...oldText
                  .split("\n")
                  .slice(chunk.startLeftLine - 1, chunk.endLeftLine - 1),
              );
              onNewTextChange(newLines.join("\n"));
            } else if (chunk.type === "modify") {
              const newLines = newText.split("\n");
              newLines.splice(
                chunk.startRightLine - 1,
                chunk.endRightLine - chunk.startRightLine,
                ...oldText
                  .split("\n")
                  .slice(chunk.startLeftLine - 1, chunk.endLeftLine - 1),
              );
              onNewTextChange(newLines.join("\n"));
            }
          }}
          onReject={(chunk: DiffChunk) => {
            if (chunk.type === "add") {
              const newLines = newText.split("\n");
              newLines.splice(
                chunk.startRightLine - 1,
                chunk.endRightLine - chunk.startRightLine,
              );
              onNewTextChange(newLines.join("\n"));
            } else if (chunk.type === "remove") {
              const oldLines = oldText.split("\n");
              oldLines.splice(
                chunk.startLeftLine - 1,
                chunk.endLeftLine - chunk.startLeftLine,
              );
              onOldTextChange(oldLines.join("\n"));
            }
          }}
        />
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <EditorPane
          content={newText}
          highlightPluginSpec={{
            diff: diffs,
            isOriginal: false,
          }}
          onContentChange={onNewTextChange}
          onScrollTopUpdate={setRightEditorTopOffset}
        />
      </div>
    </div>
  );
};

export default DiffView;
