import * as React from "react";
import CodeMirror, {
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@uiw/react-codemirror";
import { unifiedMergeView } from "@codemirror/merge";
import {
  Decoration,
  DecorationSet,
  EditorView,
  GutterMarker,
  keymap,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { ChangeSet, Prec, RangeSet, Text } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
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

const decorateChunks = ViewPlugin.fromClass(
  class {
    deco: DecorationSet;
    gutter: RangeSet<GutterMarker> | null;

    constructor(view: EditorView) {
      ({ deco: this.deco, gutter: this.gutter } = getChunkDeco(view));
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        chunksChanged(update.startState, update.state)
      ) {
        ({ deco: this.deco, gutter: this.gutter } = getChunkDeco(update.view));
      }
    }
  },
  { decorations: (d) => d.deco },
);

function chunksChanged(s1: EditorState, s2: EditorState) {
  return s1.field(ChunkField, false) != s2.field(ChunkField, false);
}

const setChunks = StateEffect.define<readonly DiffChunk[]>();

const ChunkField = StateField.define<readonly DiffChunk[]>({
  create(state) {
    return null as any;
  },
  update(current, tr) {
    tr.effects.forEach((effect) => {
      if (effect.is(setChunks)) {
        current = effect.value;
      }
    });
    return current;
  },
});

const getChunkDeco = (view: EditorView) => {
  const chunks = view.state.field(ChunkField);
  const builder = new RangeSetBuilder<Decoration>();
  const gutterBuilder = new RangeSetBuilder<GutterMarker>();
  let { from, to } = view.viewport;

  const originalDocState = view.state.field(originalDoc);

  // Add boundary checks to prevent errors when accessing lines
  const fromPos = Math.max(0, Math.min(from, originalDocState.length));
  const toPos = Math.max(0, Math.min(to, originalDocState.length));

  const fromLine = fromPos > 0 ? originalDocState.lineAt(fromPos).number : 1;
  const toLine = toPos > 0 ? originalDocState.lineAt(toPos).number : 1;

  // const fromLine = originalDocState.lineAt(from).number;
  // const toLine = originalDocState.lineAt(to).number;
  // from = originalDocState.line(chunk.startLeftLine).from;
  // to = originalDocState.line(chunk.endLeftLine - 1).to;

  // const fromLine = view.state.doc.lineAt(from).number;
  // const toLine = view.state.doc.lineAt(to).number;
  chunks.forEach((chunk: DiffChunk) => {
    if (chunk.startLeftLine >= toLine) {
      return;
    }

    if (chunk.endLeftLine > fromLine) {
      buildChunkDeco(chunk, view.state.doc, builder, gutterBuilder);
    }
  });
  return { deco: builder.finish(), gutter: gutterBuilder.finish() };
};

const changedLine = Decoration.line({ class: "cm-addedLine" });
const deleted = Decoration.mark({ tagName: "del", class: "cm-deletedLine" });
const changedLineGutterMarker = new (class extends GutterMarker {
  elementClass = "cm-changedLineGutter";
})();

const buildChunkDeco = (
  chunk: DiffChunk,
  doc: Text,
  builder: RangeSetBuilder<Decoration>,
  gutterBuilder: RangeSetBuilder<GutterMarker>,
) => {
  // Using the char indexes makes it easier to handle decorations
  // in the following parts
  const from = doc.line(chunk.startRightLine).from;
  const to = doc.line(chunk.endRightLine - 1).to;

  if (from != to) {
    builder.add(from, from, changedLine);
    // builder.add(from, to, deleted);
    gutterBuilder.add(from, from, changedLineGutterMarker);

    for (
      let iter = doc.iterRange(from, to - 1), pos = from;
      !iter.next().done;

    ) {
      if (iter.lineBreak) {
        pos++;
        builder.add(pos, pos, changedLine);
        if (gutterBuilder) {
          gutterBuilder.add(pos, pos, changedLineGutterMarker);
        }
        continue;
      }
      pos = pos + iter.value.length;
    }
  }
};

/// The state effect used to signal changes in the original doc in a
/// unified merge view.
const updateOriginalDoc = StateEffect.define<{
  doc: Text;
  changes: ChangeSet;
}>();

/// Create an effect that, when added to a transaction on a unified
/// merge view, will update the original document that's being compared against.
function originalDocChangeEffect(
  state: EditorState,
  changes: ChangeSet,
): StateEffect<{ doc: Text; changes: ChangeSet }> {
  return updateOriginalDoc.of({
    doc: changes.apply(getOriginalDoc(state)),
    changes,
  });
}

/// Get the original document from a unified merge editor's state.
function getOriginalDoc(state: EditorState): Text {
  return state.field(originalDoc);
}

const originalDoc = StateField.define<Text>({
  create: () => Text.empty,
  update(doc, tr) {
    for (let e of tr.effects) if (e.is(updateOriginalDoc)) doc = e.value.doc;
    return doc;
  },
});

const DeletionWidgets: WeakMap<DiffChunk, Decoration> = new WeakMap();

class DeletionWidget extends WidgetType {
  dom: HTMLElement | null = null;
  constructor(readonly buildDOM: (view: EditorView) => HTMLElement) {
    super();
  }
  eq(other: DeletionWidget) {
    return this.dom == other.dom;
  }
  toDOM(view: EditorView) {
    return this.dom || (this.dom = this.buildDOM(view));
  }
}

const deletionWidget = (state: EditorState, chunk: DiffChunk): Decoration => {
  const known = DeletionWidgets.get(chunk);
  if (known) {
    return known;
  }

  // const buildDom = (view: EditorView): HTMLElement => {
  //   // We're using document positions again, makes it easier to write the logic
  //   const originalDocState = view.state.field(originalDoc);
  //   let from = 0;
  //   let to = 0;
  //   try {
  //     from = originalDocState.line(chunk.startLeftLine).from;
  //     to = originalDocState.line(chunk.endLeftLine - 1).to;
  //   } catch (e) {
  //     console.log("Original document (left)", originalDocState.text);
  //     console.log("Modified document (right)", view.state.doc.text);
  //     console.log(
  //       `Chunk left, start: ${chunk.startLeftLine}, end ${chunk.endLeftLine}`,
  //     );
  //     console.log(
  //       `Chunk right, start: ${chunk.startRightLine}, end ${chunk.endRightLine}`,
  //     );
  //     throw e;
  //   }
  //   const text = originalDocState.sliceString(from, to);

  //   const dom = document.createElement("div");
  //   dom.className = "cm-deletedChunk";
  //   // TODO: Add buttons here
  //   if (from >= to) {
  //     return dom;
  //   }
  //   const makeLine = () => {
  //     let div = dom.appendChild(document.createElement("div"));
  //     div.className = "cm-deletedLine";
  //     return div.appendChild(document.createElement("del"));
  //   };
  //   let line: HTMLElement = makeLine();

  //   const add = (from: number, to: number, cls: string) => {
  //     for (let at = from; at < to; ) {
  //       // Handle newline char
  //       if (text.charAt(at) == "\n") {
  //         if (!line.firstChild) {
  //           line.appendChild(document.createElement("br"));
  //         }
  //         line = makeLine();
  //         at++;
  //         continue;
  //       }
  //       let nextStop = to;
  //       const newline = text.indexOf("\n", at);
  //       if (newline > -1 && newline < to) {
  //         nextStop = newline;
  //       }
  //       if (nextStop > at) {
  //         const textNode = document.createTextNode(text.slice(at, nextStop));
  //         if (cls) {
  //           const span = line.appendChild(document.createElement("span"));
  //           span.className = cls;
  //           span.appendChild(textNode);
  //         } else {
  //           line.appendChild(textNode);
  //         }
  //         at = nextStop;
  //       }
  //     }
  //   };
  //   add(0, text.length, "");
  //   if (!line.firstChild) {
  //     line.appendChild(document.createElement("br"));
  //   }
  //   return dom;
  // };
  //
  const buildDom = (view: EditorView): HTMLElement => {
    const originalDocState = view.state.field(originalDoc);
    const dom = document.createElement("div");
    dom.className = "cm-deletedLine cm-line";

    // Validate chunk boundaries before accessing the document
    if (chunk.endLeftLine > originalDocState.lines) {
      console.warn("Invalid chunk bounds:", chunk);
      return dom; // Return empty container if invalid
    }

    // Safely get positions
    let from = originalDocState.line(chunk.startLeftLine).from;
    let to = originalDocState.line(chunk.endLeftLine - 1).to;

    // Exit early if nothing to display
    if (from >= to) {
      return dom;
    }

    const text = originalDocState.sliceString(from, to);

    // Create DOM elements for deleted content
    const makeLine = () => {
      let div = dom.appendChild(document.createElement("div"));
      // div.className = "cm-deletedLine";
      return div.appendChild(document.createElement("del"));
    };

    let line = makeLine();

    const add = (from: number, to: number, cls: string) => {
      for (let at = from; at < to; ) {
        if (text.charAt(at) == "\n") {
          if (!line.firstChild) {
            line.appendChild(document.createElement("br"));
          }
          line = makeLine();
          at++;
          continue;
        }

        let nextStop = to;
        const newline = text.indexOf("\n", at);
        if (newline > -1 && newline < to) {
          nextStop = newline;
        }

        if (nextStop > at) {
          const textNode = document.createTextNode(text.slice(at, nextStop));
          if (cls) {
            const span = line.appendChild(document.createElement("span"));
            span.className = cls;
            span.appendChild(textNode);
          } else {
            line.appendChild(textNode);
          }
          at = nextStop;
        }
      }
    };

    add(0, text.length, "");
    if (!line.firstChild) {
      line.appendChild(document.createElement("br"));
    }

    return dom;
  };

  const deco = Decoration.widget({
    block: true,
    side: -1,
    widget: new DeletionWidget(buildDom),
  });
  DeletionWidgets.set(chunk, deco);
  return deco;
};

const buildDeletedChunks = (state: EditorState) => {
  let builder = new RangeSetBuilder<Decoration>();
  state.field(ChunkField).forEach((chunk: DiffChunk) => {
    const from = state.doc.line(
      Math.min(state.doc.lines, chunk.startRightLine),
    ).from;
    builder.add(from, from, deletionWidget(state, chunk));
  });

  return builder.finish();
};

const deletedChunks = StateField.define<DecorationSet>({
  create: (state) => buildDeletedChunks(state),
  update(deco, tr) {
    return tr.state.field(ChunkField, false) !=
      tr.startState.field(ChunkField, false)
      ? buildDeletedChunks(tr.state)
      : deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const addUnderline = StateEffect.define<{ from: number; to: number }>({
  map: ({ from, to }, change) => ({
    from: change.mapPos(from),
    to: change.mapPos(to),
  }),
});

const underlineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(underlines, tr) {
    underlines = underlines.map(tr.changes);
    for (let e of tr.effects)
      if (e.is(addUnderline)) {
        underlines = underlines.update({
          add: [underlineMark.range(e.value.from, e.value.to)],
        });
      }
    return underlines;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const underlineTheme = EditorView.theme({
  ".cm-underline": { textDecoration: "underline 3px red" },
});

const underlineMark = Decoration.mark({ class: "cm-underline" });
const underlineKeymap = keymap.of([
  {
    key: "Mod-h",
    preventDefault: true,
    run: underlineSelection,
  },
]);

function underlineSelection(view: EditorView) {
  let effects: StateEffect<unknown>[] = view.state.selection.ranges
    .filter((r) => !r.empty)
    .map(({ from, to }) => addUnderline.of({ from, to }));
  if (!effects.length) return false;

  if (!view.state.field(underlineField, false))
    effects.push(StateEffect.appendConfig.of([underlineField, underlineTheme]));
  view.dispatch({ effects });
  return true;
}

const UnifiedDiffView: React.FC<UnifiedDiffViewProps> = ({
  initialOldText,
  initialNewText,
  onConflictResolved,
}) => {
  const [oldText, setOldText] = React.useState(initialOldText);
  const [newText, setNewText] = React.useState(initialNewText);
  // const [content, setContent] = React.useState(initialNewText);
  // const diffChunks = diff(oldText, newText);

  const extensions = [
    Prec.low(decorateChunks),
    deletedChunks,
    originalDoc.init(() => Text.of(oldText.split(/\r?\n/))),
    ChunkField.init(() => {
      const foo = diff(oldText, newText);
      console.log(oldText, newText, foo);
      return foo;
    }),
    EditorView.editorAttributes.of({ class: "cm-merge-b" }),
    // unifiedMergeView({ original: oldText }),
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
    markdown(),
  ];

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <CodeMirror
        value={newText}
        height="100%"
        theme="none"
        basicSetup={false}
        extensions={extensions}
        onChange={setNewText}
        // onChange={(value: string) => {
        //   setContent(value);
        //   onOldTextChange(value);
        // }}
        // onCreateEditor={(view: EditorView) => {
        //   editorRef.current = view;
        // }}
      />
    </div>
  );
};

export default UnifiedDiffView;
