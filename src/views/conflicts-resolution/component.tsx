import { useEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import diff from "./diff";
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
        />
      </div>
      <div style={{ minWidth: "160px", width: "auto" }}>
        <ActionsGutter diffChunks={diffs} lineHeight={lineHeight} />
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <EditorPane
          content={newText}
          highlightPluginSpec={{
            diff: diffs,
            isOriginal: false,
          }}
          onContentChange={onNewTextChange}
        />
      </div>
    </div>
  );
};

// const DiffView: React.FC<DiffViewProps> = ({ oldText, newText, onResolve }) => {
//   const [originalEditorView, setOriginalEditorView] =
//     useState<EditorView | null>(null);
//   const [modifiedEditorView, setModifiedEditorView] =
//     useState<EditorView | null>(null);

//   const containerRef = useRef<HTMLDivElement>(null);
//   const editorViewsRef = useRef<EditorView[]>([]);

//   useEffect(() => {
//     if (!containerRef.current) return;

//     const createEditor = (
//       container: HTMLElement,
//       content: string,
//       readOnly: boolean = false,
//       isOriginal: boolean = false,
//     ) => {
//       const differences = diff(oldText || "", newText || "");

//       const highlightPlugin = createDiffHighlightPlugin({
//         diff: differences,
//         isOriginal,
//       });

//       const changeListener = !readOnly
//         ? [
//             EditorView.updateListener.of((update) => {
//               if (update.docChanged) {
//                 onResolve(update.state.doc.toString());
//               }
//             }),
//           ]
//         : [];

//       const editorState = EditorState.create({
//         doc: content,
//         extensions: [
//           // basicSetup minus line numbers
//           EditorView.lineWrapping,
//           EditorView.editable.of(!readOnly),
//           highlightPlugin,
//           EditorView.theme({
//             "&": {
//               backgroundColor: "var(--background-primary)",
//               color: "var(--text-normal)",
//             },
//             ".cm-line": {
//               padding: "0 4px",
//             },
//             "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
//               background: "var(--text-selection)",
//             },
//             "&.cm-focused .cm-cursor": {
//               borderLeftColor: "var(--text-normal)",
//             },
//           }),
//           markdown(),
//           ...changeListener,
//         ],
//       });

//       const view = new EditorView({
//         state: editorState,
//         parent: container,
//       });

//       if (isOriginal) {
//         setOriginalEditorView(view);
//       } else if (readOnly) {
//         setModifiedEditorView(view);
//       }

//       editorViewsRef.current.push(view);
//       return view;
//     };

//     // Create the three editors
//     const originalView = createEditor(
//       containerRef.current.querySelector(".original-editor")!,
//       oldText,
//       true,
//       true,
//     );

//     const modifiedView = createEditor(
//       containerRef.current.querySelector(".modified-editor")!,
//       newText,
//       true,
//       false,
//     );

//     const resultView = createEditor(
//       containerRef.current.querySelector(".result-editor")!,
//       newText,
//       false,
//     );

//     return () => {
//       editorViewsRef.current.forEach((view) => view.destroy());
//       editorViewsRef.current = [];
//     };
//   }, [oldText, newText]);

//   const handleMerge = (direction: "left" | "right", chunk: ConnectionChunk) => {
//     if (!originalEditorView || !modifiedEditorView) {
//       return;
//     }

//     const sourceEditor =
//       direction === "left" ? modifiedEditorView : originalEditorView;
//     const targetEditor =
//       direction === "left" ? originalEditorView : modifiedEditorView;

//     const sourceLine =
//       direction === "left" ? chunk.targetStartLine : chunk.startLine;
//     const sourceEndLine =
//       direction === "left" ? chunk.targetEndLine : chunk.endLine;
//     const targetLine =
//       direction === "left" ? chunk.startLine : chunk.targetStartLine;
//     const targetEndLine =
//       direction === "left" ? chunk.endLine : chunk.targetEndLine;

//     const sourceDoc = sourceEditor.state.doc;
//     const targetDoc = targetEditor.state.doc;

//     // Handle source content
//     let contentToInsert = "";
//     if (sourceLine > sourceDoc.lines) {
//       // Adding new lines at the end
//       contentToInsert = "\n" + chunk.content.join("\n");
//     } else {
//       const sourceFrom = sourceDoc.line(sourceLine).from;
//       const sourceTo =
//         sourceEndLine <= sourceDoc.lines
//           ? sourceDoc.line(sourceEndLine).to
//           : sourceDoc.length;
//       contentToInsert = sourceEditor.state.sliceDoc(sourceFrom, sourceTo);
//     }

//     // Handle target position
//     let targetFrom = 0;
//     let targetTo = 0;

//     if (targetLine > targetDoc.lines) {
//       // Appending to end of file
//       targetFrom = targetTo = targetDoc.length;
//       if (!contentToInsert.startsWith("\n") && targetDoc.length > 0) {
//         contentToInsert = "\n" + contentToInsert;
//       }
//     } else {
//       targetFrom = targetDoc.line(targetLine).from;
//       targetTo =
//         targetEndLine <= targetDoc.lines
//           ? targetDoc.line(targetEndLine).to
//           : targetDoc.length;
//     }

//     // Apply the change
//     const change = {
//       from: targetFrom,
//       to: targetTo,
//       insert: contentToInsert,
//     };

//     targetEditor.dispatch({ changes: change });

//     // Update result editor if it exists
//     // if (resultEditor) {
//     //   const resultDoc = resultEditor.state.doc;
//     //   let resultFrom = targetFrom;
//     //   let resultTo = targetTo;

//     //   // Handle case where result editor might have different content length
//     //   if (resultFrom > resultDoc.length) {
//     //     resultFrom = resultTo = resultDoc.length;
//     //     if (!contentToInsert.startsWith("\n") && resultDoc.length > 0) {
//     //       contentToInsert = "\n" + contentToInsert;
//     //     }
//     //   }

//     //   resultEditor.dispatch({
//     //     changes: {
//     //       from: resultFrom,
//     //       to: resultTo,
//     //       insert: contentToInsert,
//     //     },
//     //   });
//     // }

//     // Notify parent
//     onResolve(targetEditor.state.doc.toString());
//   };

//   return (
//     <div
//       ref={containerRef}
//       style={{
//         display: "grid",
//         gridTemplateColumns: "1fr auto 1fr",
//         gridTemplateRows: "1fr 1fr",
//         gap: "10px",
//         height: "100%",
//       }}
//     >
//       <div
//         className="original-editor"
//         style={{
//           border: "1px solid var(--background-modifier-border)",
//           backgroundColor: "var(--background-primary)",
//         }}
//       />
//       <div
//         className="diff-overlay"
//         style={{
//           gridRow: "1 / 2",
//           gridColumn: "2 / 3",
//           position: "relative",
//           width: "50px",
//         }}
//       >
//         <DiffConnections
//           differences={diff(oldText, newText)}
//           originalEditor={originalEditorView}
//           modifiedEditor={modifiedEditorView}
//           onMerge={handleMerge}
//         />
//       </div>
//       <div
//         className="modified-editor"
//         style={{
//           border: "1px solid var(--background-modifier-border)",
//           backgroundColor: "var(--background-primary)",
//         }}
//       />
//       <div
//         className="result-editor"
//         style={{
//           gridColumn: "1 / 4",
//           border: "1px solid var(--background-modifier-border)",
//           backgroundColor: "var(--background-primary)",
//         }}
//       />
//     </div>
//   );
// };

export default DiffView;
