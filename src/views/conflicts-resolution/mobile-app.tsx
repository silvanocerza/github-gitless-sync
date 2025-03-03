import * as React from "react";
import { ConflictFile, ConflictResolution } from "src/sync-manager";
import UnifiedDiffView from "./unified-diff-view";

const MobileApp = ({
  initialFiles,
  onResolveAllConflicts,
}: {
  initialFiles: ConflictFile[];
  onResolveAllConflicts: (resolutions: ConflictResolution[]) => void;
}) => {
  const [files, setFiles] = React.useState(initialFiles);
  const [resolvedConflicts, setResolvedConflicts] = React.useState<
    ConflictResolution[]
  >([]);

  const onConflictResolved = (fileIndex: number) => {
    // Remove the file from the conflicts to resolve
    const remainingFiles = files.filter((_, index) => index !== fileIndex);
    setFiles(remainingFiles);
    // Keep track of the resolved conflicts
    const newResolvedConflicts = [
      ...resolvedConflicts,
      {
        filePath: files[fileIndex].filePath,
        content: files[fileIndex].localContent,
      },
    ];
    setResolvedConflicts(newResolvedConflicts);
    if (remainingFiles.length === 0) {
      // We solved all conflicts, we can resume syncing
      onResolveAllConflicts(newResolvedConflicts);
    }
  };

  const renderConflict = (file: ConflictFile, index: number) => {
    return (
      <div
        key={file.filePath}
        style={{
          width: "100%",
        }}
      >
        <UnifiedDiffView
          initialOldText={file.remoteContent || ""}
          initialNewText={file.localContent || ""}
          onConflictResolved={() => onConflictResolved(index)}
        />
        <hr />
      </div>
    );
  };

  return (
    <React.StrictMode>
      <div>
        {files.length === 0 ? (
          <div
            style={{
              position: "relative",
              textAlign: "center",
              alignSelf: "center",
            }}
          >
            <div
              style={{
                margin: "20px 0",
                fontWeight: "var(--h2-weight)",
                fontSize: "var(--h2-size)",
                lineHeight: "var(--line-height-tight)",
              }}
            >
              No conflicts to resolve
            </div>
            <div
              style={{
                margin: "20px 0",
                fontSize: "var(--font-text-size)",
                color: "var(--text-muted)",
                lineHeight: "var(--line-height-tight)",
              }}
            >
              That's good, keep going
            </div>
          </div>
        ) : (
          files.map(renderConflict)
        )}
      </div>
    </React.StrictMode>
  );
};

export default MobileApp;
