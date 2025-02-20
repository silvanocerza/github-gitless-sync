import { markdown } from "@codemirror/lang-markdown";
import { EditorView, ViewUpdate } from "@codemirror/view";
import * as React from "react";
import {
  DiffHighlightPluginSpec,
  createDiffHighlightPlugin,
} from "./diff-highlight-plugin";
import CodeMirror from "@uiw/react-codemirror";

interface EditorPaneProps {
  content: string;
  highlightPluginSpec: DiffHighlightPluginSpec;
  onEditorUpdate?: (editor: EditorView) => void;
  onContentChange: (content: string) => void;
}

const EditorPane: React.FC<EditorPaneProps> = ({
  content,
  highlightPluginSpec,
  onEditorUpdate,
  onContentChange,
}) => {
  const extensions = [
    // basicSetup minus line numbers
    // EditorView.lineWrapping,
    EditorView.editable.of(true),
    createDiffHighlightPlugin(highlightPluginSpec),
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
    markdown(),
  ];

  return (
    <CodeMirror
      value={content}
      theme={"none"}
      basicSetup={false}
      extensions={extensions}
      onUpdate={(viewUpdate: ViewUpdate) => {
        if (viewUpdate.docChanged) {
          onContentChange(viewUpdate.state.doc.toString());
        }
        // We want to know when it updates in case the line height changes
        onEditorUpdate?.(viewUpdate.view);
      }}
    />
  );
};

export default EditorPane;
