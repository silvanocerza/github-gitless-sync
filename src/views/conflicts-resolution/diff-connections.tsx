import { App, setIcon } from "obsidian";
import { useEffect, useState } from "react";
import { EditorView } from "@codemirror/view";
import { DiffResult } from "./diff";
import { usePlugin } from "../hooks";

interface DiffConnectionProps {
  differences: DiffResult[];
  originalEditor: EditorView | null;
  modifiedEditor: EditorView | null;
}

type ConnectionType = "add" | "remove" | "modify";

type ConnectionChunk = {
  startTop: number;
  startBottom: number;
  endTop: number;
  endBottom: number;
  type: ConnectionType;
};

const DiffConnections: React.FC<DiffConnectionProps> = ({
  differences,
  originalEditor,
  modifiedEditor,
}) => {
  const [connections, setConnections] = useState<ConnectionChunk[]>([]);
  const plugin = usePlugin();
  if (!plugin) {
    // Unlikely to happen, makes TS happy though
    throw new Error("Plugin is not initialized");
  }

  useEffect(() => {
    if (!originalEditor || !modifiedEditor) return;

    const updateConnections = () => {
      requestAnimationFrame(() => {
        const originalContainer =
          originalEditor.scrollDOM.getBoundingClientRect();
        const modifiedContainer =
          modifiedEditor.scrollDOM.getBoundingClientRect();

        // Group consecutive diffs into chunks
        const chunks: ConnectionChunk[] = [];
        let currentChunk: DiffResult[] = [];

        differences.forEach((diff, i) => {
          if (diff.type === "equal") {
            if (currentChunk.length > 0) {
              // Process the chunk
              const chunk = processChunk(
                currentChunk,
                originalEditor,
                modifiedEditor,
                originalContainer,
                modifiedContainer,
              );
              if (chunk) chunks.push(chunk);
              currentChunk = [];
            }
          } else {
            currentChunk.push(diff);
          }
        });

        // Process last chunk if exists
        if (currentChunk.length > 0) {
          const chunk = processChunk(
            currentChunk,
            originalEditor,
            modifiedEditor,
            originalContainer,
            modifiedContainer,
          );
          if (chunk) chunks.push(chunk);
        }

        setConnections(chunks);
      });
    };

    // Initial update
    updateConnections();

    // Setup resize observer
    const resizeObserver = new ResizeObserver(updateConnections);
    resizeObserver.observe(originalEditor.scrollDOM);
    resizeObserver.observe(modifiedEditor.scrollDOM);

    // Listen to Obsidian layout changes
    const layoutChangeHandler = () => {
      updateConnections();
    };
    plugin.app.workspace.on("layout-change", layoutChangeHandler);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      plugin.app.workspace.off("layout-change", layoutChangeHandler);
    };
  }, [differences, originalEditor, modifiedEditor, plugin]);

  const processChunk = (
    chunk: DiffResult[],
    originalEditor: EditorView,
    modifiedEditor: EditorView,
    originalContainer: DOMRect,
    modifiedContainer: DOMRect,
  ): ConnectionChunk | null => {
    let startTop = Infinity;
    let startBottom = -Infinity;
    let endTop = Infinity;
    let endBottom = -Infinity;

    chunk.forEach((diff) => {
      if (diff.type === "modify" || diff.type === "remove") {
        // Find position in original editor
        const line = findLineByContent(
          originalEditor,
          diff.oldValue || diff.value,
        );
        if (line) {
          startTop = Math.min(startTop, line.top - originalContainer.top);
          startBottom = Math.max(
            startBottom,
            line.bottom - originalContainer.top,
          );
        }
      }

      if (diff.type === "modify" || diff.type === "add") {
        // Find position in modified editor
        const line = findLineByContent(modifiedEditor, diff.value);
        if (line) {
          endTop = Math.min(endTop, line.top - modifiedContainer.top);
          endBottom = Math.max(endBottom, line.bottom - modifiedContainer.top);
        }
      }
    });

    if (startTop === Infinity && endTop === Infinity) return null;

    // For pure additions, position start at the previous equal line's bottom
    if (startTop === Infinity) {
      const prevEqual = findPreviousEqual(differences, chunk[0]);
      if (prevEqual) {
        const line = findLineByContent(originalEditor, prevEqual.value);
        if (line) {
          startTop = startBottom = line.bottom - originalContainer.top;
        }
      }
    }

    return {
      startTop: startTop === Infinity ? endTop : startTop,
      startBottom: startBottom === -Infinity ? endBottom : startBottom,
      endTop: endTop === Infinity ? startTop : endTop,
      endBottom: endBottom === -Infinity ? startBottom : endBottom,
      type: (chunk.some((d) => d.type === "modify")
        ? "modify"
        : chunk[0].type) as ConnectionType,
    };
  };

  return (
    <svg
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        overflow: "visible",
      }}
    >
      {connections.map((chunk, i) => {
        const color = getConnectionStyle(chunk.type);
        return (
          <g key={i}>
            <path
              d={`
                M 0 ${chunk.startTop}
                C 20 ${chunk.startTop}, 30 ${chunk.endTop}, 50 ${chunk.endTop}
                L 50 ${chunk.endBottom}
                C 30 ${chunk.endBottom}, 20 ${chunk.startBottom}, 0 ${chunk.startBottom}
                Z
              `}
              fill={color}
              fillOpacity="0.1"
              stroke={color}
              strokeWidth="1"
            />
            <ConnectionButtons
              chunk={chunk}
              onAction={(action) => {
                console.log("Action:", action, "for chunk:", chunk);
                // TODO: Implement actual resolution actions
              }}
            />
          </g>
        );
      })}
    </svg>
  );
};

const findLineByContent = (
  editor: EditorView,
  content?: string,
): { top: number; bottom: number } | null => {
  if (!content) return null;

  const doc = editor.state.doc;
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (line.text === content) {
      const fromCoords = editor.coordsAtPos(line.from);
      const toCoords = editor.coordsAtPos(line.to);
      if (fromCoords && toCoords) {
        return {
          top: fromCoords.top,
          bottom: toCoords.bottom,
        };
      }
    }
  }
  return null;
};

const findPreviousEqual = (
  differences: DiffResult[],
  currentDiff: DiffResult,
): DiffResult | null => {
  const currentIndex = differences.findIndex((d) => d === currentDiff);
  if (currentIndex === -1) return null;

  for (let i = currentIndex - 1; i >= 0; i--) {
    if (differences[i].type === "equal") {
      return differences[i];
    }
  }
  return null;
};

const getConnectionStyle = (type: ConnectionType): string => {
  switch (type) {
    case "add":
      return "var(--color-green)";
    case "remove":
      return "var(--color-red)";
    case "modify":
      return "var(--color-yellow)";
  }
};

const ConnectionButtons: React.FC<{
  chunk: ConnectionChunk;
  onAction: (action: "left" | "right") => void;
}> = ({ chunk, onAction }) => {
  const showLeftArrow = chunk.type === "modify" || chunk.type === "add";
  const showRightArrow = chunk.type === "modify" || chunk.type === "remove";

  return (
    <>
      {showRightArrow && (
        <foreignObject x="0" y={chunk.startTop} width="16" height="16">
          <div
            style={{ cursor: "pointer", width: 16, height: 16 }}
            onClick={() => onAction("right")}
            ref={(node) => {
              if (node) setIcon(node, "arrow-right");
            }}
          />
        </foreignObject>
      )}

      {showLeftArrow && (
        <foreignObject x="34" y={chunk.endTop} width="16" height="16">
          <div
            style={{ cursor: "pointer", width: 16, height: 16 }}
            onClick={() => onAction("left")}
            ref={(node) => {
              if (node) setIcon(node, "arrow-left");
            }}
          />
        </foreignObject>
      )}
    </>
  );
};

export default DiffConnections;
