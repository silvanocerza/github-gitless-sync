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
  // Used to track the offset of the first line when the editor scrolls
  onScrollTopUpdate?: (topOffset: number) => void;
}

const EditorPane: React.FC<EditorPaneProps> = (props) => {
  const {
    content,
    highlightPluginSpec,
    onEditorUpdate,
    onContentChange,
    onScrollTopUpdate,
  } = props;
  const extensions = React.useMemo(() => {
    return [
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
        ".diff-modify-background": {
          backgroundColor: "rgba(var(--color-yellow-rgb), 0.1)",
        },
        ".diff-add-background": {
          backgroundColor: "rgba(var(--color-green-rgb), 0.1)",
        },
        ".diff-remove-background": {
          backgroundColor: "rgba(var(--color-red-rgb), 0.1)",
        },
      }),
      markdown(),
      EditorView.domEventObservers({
        scroll(event) {
          const target = event.target as HTMLElement;
          onScrollTopUpdate?.(target.scrollTop);
        },
      }),
    ];
  }, [highlightPluginSpec]);

  return (
    <CodeMirror
      value={content}
      style={{
        height: "100%",
      }}
      theme={"none"}
      width={"100%"}
      height={"100%"}
      basicSetup={false}
      extensions={extensions}
      onChange={(value: string) => {
        onContentChange(value);
      }}
      onUpdate={(viewUpdate: ViewUpdate) => {
        // We want to know when it updates in case the line height changes
        onEditorUpdate?.(viewUpdate.view);
      }}
    />
  );
};

export default EditorPane;
