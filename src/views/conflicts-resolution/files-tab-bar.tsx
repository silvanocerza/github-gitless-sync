import { Menu } from "obsidian";
import * as React from "react";

interface FilesTabBarProps {
  files: string[];
  currentFile: string;
  setCurrentFileIndex: (index: number) => void;
}

const FilesTabBar: React.FC<FilesTabBarProps> = ({
  files,
  currentFile,
  setCurrentFileIndex: setCurrentFile,
}) => {
  const createTab = (filePath: string, index: number) => {
    return (
      <div
        key={filePath}
        style={{
          content: "none",
          maxWidth: "6rem",
        }}
        className={`workspace-tab-header tappable`}
        aria-label={filePath}
        data-tooltip-delay="300"
        onClick={() => setCurrentFile(index)}
      >
        <div
          style={{
            color:
              filePath === currentFile ? "var(--tab-text-color-focused)" : "",
            backgroundColor:
              filePath === currentFile
                ? "var(--background-modifier-hover)"
                : "",
          }}
          className="workspace-tab-header-inner"
        >
          <div
            style={{
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
              direction: "rtl",
              textAlign: "center",
            }}
          >
            {filePath}
          </div>
        </div>
      </div>
    );
  };

  // Makes it easier to position the tab bar menu
  const divRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      style={{
        display: "flex",
        backgroundColor: "var(--background-primary)",
        height: "var(--header-height)",
        borderBottom: "var(--tab-outline-width) solid var(--tab-outline-color)",
        flex: "0 0 auto",
        paddingLeft: "var(--size-4-2)",
        paddingRight: "var(--size-4-2)",
        position: "relative",
      }}
    >
      <div
        style={{
          animationDuration: "250ms",
          display: "flex",
          flex: "0 1 auto",
          overflow: "auto",
          padding: "1px 0 7px",
          margin: "6px 0 0 0",
          gap: "3px",
        }}
      >
        {files.map(createTab)}
      </div>
      <div
        style={{
          display: "flex",
          flexGrow: 1,
        }}
      />
      <div
        ref={divRef}
        style={{
          marginInlineEnd: "var(--size-4-1)",
          padding: "var(--size-4-2) 0 var(--size-2-3)",
        }}
        onClick={() => {
          const menu = new Menu();
          files.forEach((filename: string, index: number) => {
            menu.addItem((item) => {
              item.setTitle(filename).onClick(() => setCurrentFile(index));
            });
          });
          // We use the divRef to force the position to be relative to this div. We want the position
          // to always be the same so using the click event is not feasible as that depends on the
          // coordinates of the user click.
          // The event target is not usable either as depending where the user clicks the target
          // might be this div or its children thus having different positions.
          const rect = divRef.current!.getBoundingClientRect();
          menu.showAtPosition({ x: rect.left, y: rect.bottom });
        }}
      >
        <span className="clickable-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="svg-icon lucide-chevron-down"
          >
            <path d="m6 9 6 6 6-6"></path>
          </svg>
        </span>
      </div>
    </div>
  );
};

export default FilesTabBar;
