import { markdown } from "@codemirror/lang-markdown";
import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import * as React from "react";

interface EditorPaneProps {
  content: string;
  highlightPlugin: ViewPlugin<any>;
  onEditorUpdate?: (editor: EditorView) => void;
  onContentChange: (content: string) => void;
}

const EditorPane: React.FC<EditorPaneProps> = ({
  content,
  highlightPlugin,
  onEditorUpdate,
  onContentChange,
}) => {
  const editorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (editorRef.current) {
      const editorState = EditorState.create({
        doc: content,
        extensions: [
          // basicSetup minus line numbers
          // EditorView.lineWrapping,
          EditorView.editable.of(true),
          highlightPlugin,
          EditorView.theme({
            "&": {
              backgroundColor: "var(--background-primary)",
              color: "var(--text-normal)",
            },
            ".cm-content": {
              padding: 0,
            },
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
              background: "var(--text-selection)",
            },
            "&.cm-focused .cm-cursor": {
              borderLeftColor: "var(--text-normal)",
            },
          }),
          markdown(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onContentChange(update.state.doc.toString());
            }
            // We want to know when it updates in case the line height changes
            onEditorUpdate?.(update.view);
          }),
        ],
      });

      const editor = new EditorView({
        parent: editorRef.current,
        state: editorState,
      });

      return () => {
        // Cleanup
        editor.destroy();
      };
    }
  }, []);

  return <div ref={editorRef} />;
};

export default EditorPane;
