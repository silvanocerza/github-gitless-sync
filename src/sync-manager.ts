import { Vault, normalizePath } from "obsidian";
import GithubClient, {
  GetTreeResponseItem,
  NewTreeRequestItem,
} from "./github/client";
import MetadataStore, { FileMetadata, Metadata } from "./metadata-store";
import EventsListener from "./events-listener";
import { GitHubSyncSettings } from "./settings/settings";

interface SyncAction {
  type: "upload" | "download" | "delete_local" | "delete_remote";
  filePath: string;
}

type OnConflictsCallback = (
  conflicts: { remoteFile: FileMetadata; localFile: FileMetadata }[],
) => Promise<boolean[]>;

export default class SyncManager {
  private metadataStore: MetadataStore;
  private client: GithubClient;
  private eventsListener: EventsListener;
  private syncIntervalId: number | null = null;

  constructor(
    private vault: Vault,
    private settings: GitHubSyncSettings,
    private onConflicts: OnConflictsCallback,
  ) {
    this.metadataStore = new MetadataStore(this.vault);
    this.client = new GithubClient(
      this.settings.githubToken,
      this.settings.githubOwner,
      this.settings.githubRepo,
      this.settings.githubBranch,
      this.settings.repoContentDir,
      this.vault.configDir,
    );
    this.eventsListener = new EventsListener(
      this.vault,
      this.metadataStore,
      this.settings.localContentDir,
      this.settings.repoContentDir,
    );
  }

  /**
   * Returns true if the remote content dir is empty.
   * @param files All files in the remote repository
   */
  private remoteContentDirIsEmpty(files: {
    [key: string]: GetTreeResponseItem;
  }): boolean {
    return (
      Object.keys(files).filter((filePath: string) => {
        filePath.startsWith(this.settings.repoContentDir);
      }).length === 0
    );
  }

  /**
   * Returns true if the local content dir is empty.
   * If the local content dir is the vault root the config dir is ignored.
   */
  private async localContentDirIsEmpty(): Promise<boolean> {
    const localContentDirExists = await this.vault.adapter.exists(
      this.settings.localContentDir,
    );
    if (localContentDirExists) {
      const { files, folders } = await this.vault.adapter.list(
        this.settings.localContentDir,
      );
      // There are files or folders in the local content dir
      return (
        files.length > 0 ||
        // We filter out the config dir in case the user wants to sync the whole
        // vault. The config dir is always present so it's fine if we find it.
        folders.filter((f) => f !== this.vault.configDir).length > 0
      );
    }
    return true;
  }

  /**
   * Handles first sync with remote and local.
   * This fails neither remote nor local folders are empty.
   */
  async firstSync() {
    const { files, sha: treeSha } = await this.client.getRepoContent();

    const remoteContentDirIsEmpty = this.remoteContentDirIsEmpty(files);
    const localContentDirIsEmpty = await this.localContentDirIsEmpty();

    if (!remoteContentDirIsEmpty && !localContentDirIsEmpty) {
      // Both have files, we can't sync, show error
      throw new Error("Both remote and local have files, can't sync");
    } else if (remoteContentDirIsEmpty) {
      // Remote has no files and no manifest, let's just upload whatever we have locally.
      // This is fine even if the local content dir is empty.
      // The most important thing at this point is that the remote manifest is created.
      await this.firstSyncFromLocal(files, treeSha);
    } else {
      // Local has no files and there's no manifest in the remote repo.
      // Let's download whatever we have in the remote content dir.
      // This is fine even if the remote content dir is empty.
      // In this case too the important step is that the remote manifest is created.
      await this.firstSyncFromRemote(files, treeSha);
    }
  }

  /**
   * Handles first sync with the remote repository.
   * This must be called in case there are no files in the local content dir while
   * remote has files in the repo content dir but no manifest file.
   *
   * @param files All files in the remote repository, including those not in its content dir.
   * @param treeSha The SHA of the tree in the remote repository.
   */
  async firstSyncFromRemote(
    files: { [key: string]: GetTreeResponseItem },
    treeSha: string,
  ) {
    // There's no remote manifest and there are files in the repo,
    // though there are no files locally either, so we can just download everything
    // and sync the remote manifest.
    await Promise.all(
      Object.keys(files)
        .filter((filePath: string) => {
          if (filePath.startsWith(this.settings.repoContentDir)) {
            return true;
          } else if (filePath.startsWith(this.vault.configDir)) {
            return true;
          }
          return false;
        })
        .map(async (filePath: string) => {
          await this.downloadFile(files[filePath], Date.now());
        }),
    );
    const newTreeFiles = Object.keys(files)
      .map((filePath: string) => ({
        path: files[filePath].path,
        mode: files[filePath].mode,
        type: files[filePath].type,
        sha: files[filePath].sha,
      }))
      .reduce(
        (
          acc: { [key: string]: NewTreeRequestItem },
          item: NewTreeRequestItem,
        ) => ({ ...acc, [item.path]: item }),
        {},
      );
    // Add files that are in the manifest but not in the tree.
    await Promise.all(
      Object.keys(this.metadataStore.data.files).map(
        async (filePath: string) => {
          const normalizedPath = normalizePath(filePath);
          const content = await this.vault.adapter.read(normalizedPath);
          const { remotePath } = this.metadataStore.data.files[filePath];
          newTreeFiles[remotePath] = {
            path: remotePath,
            mode: "100644",
            type: "blob",
            content: content,
          };
        },
      ),
    );
    await this.commitSync(newTreeFiles, treeSha);
  }

  /**
   * Handles first sync with the remote repository.
   * This must be called in case there are no files in the remote content dir and no manifest while
   * local content dir has files and a manifest.
   *
   * @param files All files in the remote repository, including those not in its content dir.
   * @param treeSha The SHA of the tree in the remote repository.
   */
  async firstSyncFromLocal(
    files: { [key: string]: GetTreeResponseItem },
    treeSha: string,
  ) {
    const newTreeFiles = Object.keys(files)
      .map((filePath: string) => ({
        path: files[filePath].path,
        mode: files[filePath].mode,
        type: files[filePath].type,
        sha: files[filePath].sha,
      }))
      .reduce(
        (
          acc: { [key: string]: NewTreeRequestItem },
          item: NewTreeRequestItem,
        ) => ({ ...acc, [item.path]: item }),
        {},
      );
    await Promise.all(
      Object.keys(this.metadataStore.data.files).map(
        async (filePath: string) => {
          const normalizedPath = normalizePath(filePath);
          const content = await this.vault.adapter.read(normalizedPath);
          const { remotePath } = this.metadataStore.data.files[filePath];
          newTreeFiles[remotePath] = {
            path: remotePath,
            mode: "100644",
            type: "blob",
            content: content,
          };
        },
      ),
    );
    await this.commitSync(newTreeFiles, treeSha);
  }

  /**
   * Syncs local and remote folders.
   * @returns
   */
  async sync() {
    const { files, sha: treeSha } = await this.client.getRepoContent();
    const manifest = files[`${this.vault.configDir}/github-sync-metadata.json`];

    if (manifest === undefined) {
      throw new Error("Remote manifest is missing");
    }

    const blob = await this.client.getBlob(manifest.url);
    const remoteMetadata: Metadata = JSON.parse(atob(blob.content));

    const conflicts = this.findConflicts(
      remoteMetadata.files,
      this.metadataStore.data.files,
    );
    let conflictResolutions: SyncAction[] = [];
    if (conflicts.length > 0) {
      // TODO: Show conflicts to the user with a callback
      // Wait for response
      // Create new action to handle the conflict
      // Add the new action to the list later on
      console.log("Conflicts");
      console.log(conflicts);
      (await this.onConflicts(conflicts)).forEach(
        (resolution: boolean, index: number) => {
          if (resolution) {
            conflictResolutions.push({
              type: "download",
              filePath: conflicts[index].remoteFile.localPath,
            });
          } else {
            conflictResolutions.push({
              type: "upload",
              filePath: conflicts[index].localFile.localPath,
            });
          }
        },
      );
    }

    const actions = [
      ...this.determineSyncActions(
        remoteMetadata.files,
        this.metadataStore.data.files,
      ),
      ...conflictResolutions,
    ];

    if (actions.length === 0) {
      // Nothing to sync
      return;
    }

    const newTreeFiles: { [key: string]: NewTreeRequestItem } = Object.keys(
      files,
    )
      .map((filePath: string) => ({
        path: files[filePath].path,
        mode: files[filePath].mode,
        type: files[filePath].type,
        sha: files[filePath].sha,
      }))
      .reduce(
        (
          acc: { [key: string]: NewTreeRequestItem },
          item: NewTreeRequestItem,
        ) => ({ ...acc, [item.path]: item }),
        {},
      );

    await Promise.all(
      actions.map(async (action) => {
        switch (action.type) {
          case "upload": {
            const normalizedPath = normalizePath(action.filePath);
            const content = await this.vault.adapter.read(normalizedPath);
            const remotePath = action.filePath.replace(
              this.settings.localContentDir,
              this.settings.repoContentDir,
            );
            newTreeFiles[remotePath] = {
              path: remotePath,
              mode: "100644",
              type: "blob",
              content: content,
            };
            break;
          }
          case "delete_remote": {
            const { remotePath } =
              this.metadataStore.data.files[action.filePath];
            newTreeFiles[remotePath].sha = null;
            break;
          }
          case "download":
            break;
          case "delete_local":
            break;
        }
      }),
    );

    // Download files and delete local files
    await Promise.all([
      ...actions
        .filter((action) => action.type === "download")
        .map(async (action: SyncAction) => {
          const remotePath = action.filePath.replace(
            this.settings.localContentDir,
            this.settings.repoContentDir,
          );
          await this.downloadFile(
            files[remotePath],
            remoteMetadata.files[action.filePath].lastModified,
          );
        }),
      ...actions
        .filter((action) => action.type === "delete_local")
        .map(async (action: SyncAction) => {
          await this.deleteLocalFile(action.filePath);
        }),
    ]);

    await this.commitSync(newTreeFiles, treeSha);
  }

  /**
   * Finds conflicts between local and remote files.
   * @param remoteFiles All files in the remote content dir
   * @param localFiles All files in the local content dir
   * @returns List of objects with both remote and local conflicting files metadata
   */
  findConflicts(
    remoteFiles: { [key: string]: FileMetadata },
    localFiles: { [key: string]: FileMetadata },
  ): { remoteFile: FileMetadata; localFile: FileMetadata }[] {
    const commonFiles = Object.keys(remoteFiles).filter(
      (key) => key in localFiles,
    );

    return commonFiles
      .map((filePath: string) => {
        const remoteFile = remoteFiles[filePath];
        const localFile = localFiles[filePath];

        // We compare the SHA cause it remote files changes the SHA changes
        // but not the same happens when the file is modified locally.
        // So if sha are different and the local file is newer we can't
        // know for sure which version should be kept.
        if (
          remoteFile.sha !== localFile.sha &&
          remoteFile.lastModified < localFile.lastModified
        ) {
          // File is modified on both sides, the user must solve the conflict
          return {
            remoteFile: remoteFile,
            localFile: localFile,
          };
        }
        return null;
      })
      .filter(
        (
          conflict: {
            remoteFile: FileMetadata;
            localFile: FileMetadata;
          } | null,
        ) => conflict !== null,
      );
  }

  /**
   * Determines which sync action to take for each file.
   *
   * @param remoteFiles All files in the remote content dir
   * @param localFiles All files in the local content dir
   *
   * @returns List of SyncActions
   */
  determineSyncActions(
    remoteFiles: { [key: string]: FileMetadata },
    localFiles: { [key: string]: FileMetadata },
  ) {
    let actions: SyncAction[] = [];

    const commonFiles = Object.keys(remoteFiles).filter(
      (key) => key in localFiles,
    );

    // Get diff for common files
    commonFiles.forEach((filePath: string) => {
      const remoteFile = remoteFiles[filePath];
      const localFile = localFiles[filePath];
      if (remoteFile.deleted && localFile.deleted) {
        // Nothing to do
        return;
      }

      if (
        remoteFile.sha !== localFile.sha &&
        remoteFile.lastModified < localFile.lastModified
      ) {
        // This is a conflict, we handle it separately
        // We compare the SHA cause it remote files changes the SHA changes
        // but not the same happens when the file is modified locally.
        // So if sha are different and the local file is newer we can't
        // know for sure which version should be kept.
        return;
      }

      if (remoteFile.deleted && !localFile.deleted) {
        if ((remoteFile.deletedAt as number) > localFile.lastModified) {
          actions.push({
            type: "delete_local",
            filePath: filePath,
          });
        } else if (localFile.lastModified > (remoteFile.deletedAt as number)) {
          actions.push({ type: "upload", filePath: filePath });
        }
      }

      if (!remoteFile.deleted && localFile.deleted) {
        if (remoteFile.lastModified > (localFile.deletedAt as number)) {
          actions.push({ type: "download", filePath: filePath });
        } else if ((localFile.deletedAt as number) > remoteFile.lastModified) {
          actions.push({
            type: "delete_remote",
            filePath: filePath,
          });
        }
      }

      if (remoteFile.lastModified > localFile.lastModified) {
        actions.push({ type: "download", filePath: filePath });
      } else if (localFile.lastModified > remoteFile.lastModified) {
        actions.push({ type: "upload", filePath: filePath });
      }
    });

    // Get diff for files in remote but not in local
    Object.keys(remoteFiles).forEach((filePath: string) => {
      const remoteFile = remoteFiles[filePath];
      const localFile = localFiles[filePath];
      if (localFile) {
        // Local file exists, we already handled it.
        // Skip it.
        return;
      }
      if (remoteFile.deleted) {
        // Remote is deleted but we don't have it locally.
        // Nothing to do.
        // TODO: Maybe we need to remove remote reference too?
      } else {
        actions.push({ type: "download", filePath: filePath });
      }
    });

    // Get diff for files in local but not in remote
    Object.keys(localFiles).forEach((filePath: string) => {
      const remoteFile = remoteFiles[filePath];
      const localFile = localFiles[filePath];
      if (remoteFile) {
        // Remote file exists, we already handled it.
        // Skip it.
        return;
      }
      if (localFile.deleted) {
        // Local is deleted and remote doesn't exist.
        // Just remove the local reference.
      } else {
        actions.push({ type: "upload", filePath: filePath });
      }
    });

    return actions;
  }

  /**
   * Creates a new sync commit in the remote repository.
   *
   * @param treeFiles Updated list of files in the remote tree
   * @param baseTreeSha sha of the tree to use as base for the new tree
   */
  async commitSync(
    treeFiles: { [key: string]: NewTreeRequestItem },
    baseTreeSha: string,
  ) {
    // Update local sync time
    this.metadataStore.data.lastSync = Date.now();
    this.metadataStore.save();

    // Update manifest in list of new tree items
    delete treeFiles[`${this.vault.configDir}/github-sync-metadata.json`].sha;
    treeFiles[`${this.vault.configDir}/github-sync-metadata.json`].content =
      JSON.stringify(this.metadataStore.data);

    // Create the new tree
    const newTree: { tree: NewTreeRequestItem[]; base_tree: string } = {
      tree: Object.keys(treeFiles).map(
        (filePath: string) => treeFiles[filePath],
      ),
      base_tree: baseTreeSha,
    };
    const newTreeSha = await this.client.createTree(newTree);

    const branchHeadSha = await this.client.getBranchHeadSha();

    const commitSha = await this.client.createCommit(
      // TODO: Make this configurable or find a nicer commit message
      "Sync",
      newTreeSha,
      branchHeadSha,
    );

    await this.client.updateBranchHead(commitSha);
  }

  async downloadFile(file: GetTreeResponseItem, lastModified: number) {
    const url = file.url;
    const destinationFile = file.path.replace(
      this.settings.repoContentDir,
      this.settings.localContentDir,
    );
    const fileMetadata = this.metadataStore.data.files[destinationFile];
    if (fileMetadata && fileMetadata.sha === file.sha) {
      // File already exists and has the same SHA, no need to download it again.
      return;
    }

    const blob = await this.client.getBlob(url);
    const destinationFolder = normalizePath(
      destinationFile.split("/").slice(0, -1).join("/"),
    );
    if (!(await this.vault.adapter.exists(destinationFolder))) {
      await this.vault.adapter.mkdir(destinationFolder);
    }
    this.vault.adapter.writeBinary(
      normalizePath(destinationFile),
      Buffer.from(blob.content, "base64"),
    );
    this.metadataStore.data.files[destinationFile] = {
      localPath: destinationFile,
      remotePath: file.path,
      sha: file.sha,
      dirty: false,
      justDownloaded: true,
      lastModified: lastModified,
    };
    await this.metadataStore.save();
  }

  async deleteLocalFile(filePath: string) {
    const normalizedPath = normalizePath(filePath);
    await this.vault.adapter.remove(normalizedPath);
    this.metadataStore.data.files[filePath].deleted = true;
    this.metadataStore.data.files[filePath].deletedAt = Date.now();
    this.metadataStore.save();
  }

  async loadMetadata() {
    await this.metadataStore.load();
    if (Object.keys(this.metadataStore.data.files).length === 0) {
      // Must be the first time we run, initialize the metadata store
      // with the files from the config directory
      let files = [];
      let folders = [this.vault.configDir];
      while (folders.length > 0) {
        const folder = folders.pop();
        if (!folder) {
          continue;
        }
        const res = await this.vault.adapter.list(folder);
        files.push(...res.files);
        folders.push(...res.folders);
      }
      files.forEach((filePath: string) => {
        if (filePath === `${this.vault.configDir}/workspace.json`) {
          // Obsidian recommends not syncing the workspace file
          return;
        }
        if (filePath.startsWith(`${this.vault.configDir}/plugins`)) {
          // Let's not sync plugins for the time being
          return;
        }
        this.metadataStore.data.files[filePath] = {
          localPath: filePath,
          // The config dir is always stored in the repo root so we use
          // the same path for remote
          remotePath: filePath,
          sha: null,
          dirty: false,
          justDownloaded: false,
          lastModified: Date.now(),
        };
      });
      // Add itself, if we're here the manifest file doesn't exist
      // so it can't add itself to the list of files
      this.metadataStore.data.files[
        `${this.vault.configDir}/github-sync-metadata.json`
      ] = {
        localPath: `${this.vault.configDir}/github-sync-metadata.json`,
        remotePath: `${this.vault.configDir}/github-sync-metadata.json`,
        sha: null,
        dirty: false,
        justDownloaded: false,
        lastModified: Date.now(),
      };
      this.metadataStore.save();
    }
  }

  getFileMetadata(filePath: string): FileMetadata {
    return this.metadataStore.data.files[filePath];
  }

  async startEventsListener() {
    this.eventsListener.start();
  }

  /**
   * Starts a new sync interval.
   * Raises an error if the interval is already running.
   */
  startSyncInterval(minutes: number): number {
    if (this.syncIntervalId) {
      throw new Error("Sync interval is already running");
    }
    this.syncIntervalId = window.setInterval(
      () => this.sync(),
      // Sync interval is set in minutes but setInterval expects milliseconds
      minutes * 60 * 1000,
    );
    return this.syncIntervalId;
  }

  /**
   * Stops the currently running sync interval
   */
  stopSyncInterval() {
    if (this.syncIntervalId) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Util function that stops and restart the sync interval
   */
  restartSyncInterval(minutes: number) {
    this.stopSyncInterval();
    return this.startSyncInterval(minutes);
  }
}
