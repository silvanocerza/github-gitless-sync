import { usePlugin } from "../hooks";
import { useState, useMemo, useEffect } from "react";

const UploadDialogQuestion = ({
  fileCount,
  onCancel,
  startUpload: onUpload,
}: {
  fileCount: number;
  onCancel: () => void;
  startUpload: () => Promise<void>;
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
      }}
    >
      <h1 style={{ width: "fit-content" }}>Upload files to GitHub</h1>
      <p style={{ width: "fit-content" }}>
        Do you want to upload{" "}
        <span style={{ fontWeight: "bold" }}>{fileCount}</span> files? This
        might take a while.
      </p>
      <div className="modal-button-container">
        <button onClick={onCancel}>Cancel</button>
        <button
          onClick={async () => await onUpload()}
          style={{
            color: "var(--text-on-accent)",
            backgroundColor: "var(--interactive-accent)",
          }}
        >
          Upload
        </button>
      </div>
    </div>
  );
};

const UploadDialogUploading = ({
  completedCount,
  fileCount,
  onCancel,
}: {
  completedCount: number;
  fileCount: number;
  onCancel: () => void;
}) => {
  const progress = (completedCount * 100) / fileCount;

  return (
    <div>
      <h1 style={{ width: "fit-content" }}>
        {progress === 100 ? "All files uploaded" : "Uploading…"}
      </h1>
      <div className="setting-progress-bar">
        <div
          className="setting-progress-bar-inner"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
      <p>
        Uploaded {completedCount} file{completedCount === 1 ? "" : "s"} of{" "}
        {fileCount}
      </p>
      <div className="modal-button-container">
        {/*
          We use onCancel for both cases as it won't have any effect other
          than closing the modal if upload is done
        */}
        <button onClick={onCancel}>{progress === 100 ? "Ok" : "Cancel"}</button>
      </div>
    </div>
  );
};

const UploadDialogContent = ({ onCancel }: { onCancel: () => void }) => {
  const plugin = usePlugin();
  if (!plugin) {
    // Unlikely to happen, makes TS happy though
    throw new Error("Plugin is not initialized");
  }
  const [uploading, setUploading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const files = useMemo(
    // This is not the most efficient way to get all files in the
    // folder to sync but it's quick to code.
    // I'll enhance it in the future.
    () =>
      plugin?.app.vault
        .getFiles()
        .filter((file) =>
          file.path.startsWith(plugin.settings.localContentDir),
        ),
    [],
  );

  const abortController = useMemo(() => new AbortController(), []);

  // Stop the upload when the component is unmounted, otherwise
  // we keep uploading even when the modal is closed.
  useEffect(() => {
    return () => {
      abortController.abort();
    };
  }, []);

  const startUploading = async () => {
    setUploading(true);
    // We upload files sequentially to avoid conflicts.
    // GitHub rejects commits if they're made in fast succession, thus
    // forcing us to retry the failed upload.
    // So parallelization is not an option.
    for (const file of files) {
      if (abortController.signal.aborted) {
        return;
      }
      await plugin.syncManager.uploadFile(file);
      if (abortController.signal.aborted) {
        // Check abort state only after the uploaded file metadata
        // is updated, otherwise we risk having outdated SHAs
        return;
      }
      setCompletedCount((count) => count + 1);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
      }}
    >
      {!uploading && (
        <UploadDialogQuestion
          fileCount={files.length}
          onCancel={onCancel}
          startUpload={startUploading}
        />
      )}
      {uploading && (
        <UploadDialogUploading
          completedCount={completedCount}
          fileCount={files.length}
          onCancel={() => {
            abortController.abort();
            onCancel();
          }}
        />
      )}
    </div>
  );
};

export default UploadDialogContent;
