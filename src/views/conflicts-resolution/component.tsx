import { App } from "obsidian";
import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { basicSetup } from "codemirror";
import diff from "./diff";
import { createDiffHighlightPlugin } from "./diff-highlight-plugin";

// Add styles for diff highlighting
const styles = document.createElement("style");
styles.innerHTML = `
  .diff-remove-background {
    background-color: rgba(255, 0, 0, 0.1);
  }
  .diff-add-background {
    background-color: rgba(0, 255, 0, 0.1);
  }
`;
document.head.appendChild(styles);

interface DiffViewProps {
  oldText: string;
  newText: string;
  onResolve: (resolvedText: string) => void;
  app: App;
}

const DiffView: React.FC<DiffViewProps> = ({
  oldText,
  newText,
  onResolve,
  app,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewsRef = useRef<EditorView[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const createEditor = (
      container: HTMLElement,
      content: string,
      readOnly: boolean = false,
      isOriginal: boolean = false,
    ) => {
      const differences = diff(oldText, newText);

      const highlightPlugin = createDiffHighlightPlugin({
        diff: differences,
        isOriginal,
      });

      const changeListener = !readOnly
        ? [
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onResolve(update.state.doc.toString());
              }
            }),
          ]
        : [];

      const state = EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          markdown(),
          EditorView.lineWrapping,
          EditorView.editable.of(!readOnly),
          highlightPlugin,
          ...changeListener,
        ],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      editorViewsRef.current.push(view);
      return view;
    };

    // Create the three editors
    const originalView = createEditor(
      containerRef.current.querySelector(".original-editor")!,
      oldText,
      true,
      true,
    );

    const modifiedView = createEditor(
      containerRef.current.querySelector(".modified-editor")!,
      newText,
      true,
      false,
    );

    const resultView = createEditor(
      containerRef.current.querySelector(".result-editor")!,
      newText,
      false,
    );

    return () => {
      editorViewsRef.current.forEach((view) => view.destroy());
      editorViewsRef.current = [];
    };
  }, [oldText, newText]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: "10px",
        height: "100%",
      }}
    >
      <div
        className="original-editor"
        style={{ border: "1px solid var(--background-modifier-border)" }}
      />
      <div
        className="modified-editor"
        style={{ border: "1px solid var(--background-modifier-border)" }}
      />
      <div
        className="result-editor"
        style={{
          gridColumn: "1 / span 2",
          border: "1px solid var(--background-modifier-border)",
        }}
      />
    </div>
  );
};

export default DiffView;
