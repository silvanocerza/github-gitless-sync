import { Vault, normalizePath } from "obsidian";
import GithubClient, {
  GetTreeResponseItem,
  NewTreeRequestItem,
  RepoContent,
} from "./github/client";
import MetadataStore, {
  FileMetadata,
  Metadata,
  MANIFEST_FILE_NAME,
} from "./metadata-store";
import EventsListener from "./events-listener";
import { GitHubSyncSettings } from "./settings/settings";
import Logger from "./logger";

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
    private logger: Logger,
  ) {
    this.metadataStore = new MetadataStore(this.vault);
    this.client = new GithubClient(
      this.settings.githubToken,
      this.settings.githubOwner,
      this.settings.githubRepo,
      this.settings.githubBranch,
      this.logger,
    );
    this.eventsListener = new EventsListener(
      this.vault,
      this.metadataStore,
      this.settings,
      this.logger,
    );
  }

  /**
   * Returns true if the local vault root is empty.
   */
  private async vaultIsEmpty(): Promise<boolean> {
    const { files, folders } = await this.vault.adapter.list(
      this.vault.getRoot().path,
    );
    // There are files or folders in the vault dir
    return (
      files.length === 0 ||
      // We filter out the config dir since is always present so it's fine if we find it.
      folders.filter((f) => f !== this.vault.configDir).length === 0
    );
  }

  /**
   * Handles first sync with remote and local.
   * This fails if neither remote nor local folders are empty.
   */
  async firstSync() {
    await this.logger.info("Starting first sync");
    let repositoryIsBare = false;
    let res: RepoContent;
    let files: {
      [key: string]: GetTreeResponseItem;
    } = {};
    let treeSha: string = "";
    try {
      res = await this.client.getRepoContent();
      files = res.files;
      treeSha = res.sha;
    } catch (err) {
      if (err.status !== 409) {
        throw err;
      }
      // The repository is bare, meaning it has no tree, no commits and no branches
      repositoryIsBare = true;
    }

    if (repositoryIsBare) {
      await this.logger.info("Remote repository is bare");
      // Since the repository is completely empty we need to create a first commit.
      // We can't create that by going throught the normal sync process since the
      // API doesn't let us create a new tree when the repo is empty.
      // So we create a the manifest file as the first commit, since we're going
      // to create that in any case right after this.
      await this.client.createFile(
        `${this.vault.configDir}/${MANIFEST_FILE_NAME}`,
        "",
        "Initial commit",
      );
      // Now get the repo content again cause we know for sure it will return a
      // valid sha that we can use to create the first sync commit.
      res = await this.client.getRepoContent();
      files = res.files;
      treeSha = res.sha;
    }

    const remoteRepoIsEmpty = Object.keys(files).length === 0;
    const vaultIsEmpty = await this.vaultIsEmpty();

    if (!remoteRepoIsEmpty && !vaultIsEmpty) {
      // Both have files, we can't sync, show error
      await this.logger.error("Both remote and local have files, can't sync");
      throw new Error("Both remote and local have files, can't sync");
    } else if (remoteRepoIsEmpty || repositoryIsBare) {
      // Remote has no files and no manifest, let's just upload whatever we have locally.
      // This is fine even if the vault is empty.
      // The most important thing at this point is that the remote manifest is created.
      await this.firstSyncFromLocal(files, treeSha);
    } else {
      // Local has no files and there's no manifest in the remote repo.
      // Let's download whatever we have in the remote repo.
      // This is fine even if the remote repo is empty.
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
    await this.logger.info("Starting first sync from remote files");
    await Promise.all(
      Object.keys(files)
        .filter((filePath: string) => {
          if (
            this.settings.syncConfigDir &&
            filePath.startsWith(this.vault.configDir) &&
            filePath !== `${this.vault.configDir}/${MANIFEST_FILE_NAME}`
          ) {
            // Include files in the config dir only if the user has enabled it.
            // The metadata file must always be synced.
            return false;
          }
          return true;
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
          newTreeFiles[filePath] = {
            path: filePath,
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
   * This must be called in case there are no files in the remote repo and no manifest while
   * local vault has files and a manifest.
   *
   * @param files All files in the remote repository
   * @param treeSha The SHA of the tree in the remote repository.
   */
  async firstSyncFromLocal(
    files: { [key: string]: GetTreeResponseItem },
    treeSha: string,
  ) {
    await this.logger.info("Starting first sync from local files");
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
          newTreeFiles[filePath] = {
            path: filePath,
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
    await this.logger.info("Starting sync");
    const { files, sha: treeSha } = await this.client.getRepoContent();
    const manifest = files[`${this.vault.configDir}/${MANIFEST_FILE_NAME}`];

    if (manifest === undefined) {
      await this.logger.error("Remote manifest is missing", { files, treeSha });
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
      await this.logger.warn("Found conflicts", conflicts);

      (await this.onConflicts(conflicts)).forEach(
        (resolution: boolean, index: number) => {
          if (resolution) {
            conflictResolutions.push({
              type: "download",
              filePath: conflicts[index].remoteFile.path,
            });
          } else {
            conflictResolutions.push({
              type: "upload",
              filePath: conflicts[index].localFile.path,
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
      await this.logger.info("Nothing to sync");
      return;
    }
    await this.logger.info("Actions to sync", actions);

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
            newTreeFiles[action.filePath] = {
              path: action.filePath,
              mode: "100644",
              type: "blob",
              content: content,
            };
            break;
          }
          case "delete_remote": {
            newTreeFiles[action.filePath].sha = null;
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
          await this.downloadFile(
            files[action.filePath],
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
   * @param remoteFiles All files in the remote repo
   * @param localFiles All files in the local vault
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
   * @param remoteFiles All files in the remote repo
   * @param localFiles All files in the local vault
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

    if (!this.settings.syncConfigDir) {
      // Remove all actions that involve the config directory if the user doesn't want to sync it.
      // The manifest file is always synced.
      return actions.filter((action: SyncAction) => {
        return (
          !action.filePath.startsWith(this.vault.configDir) ||
          action.filePath === `${this.vault.configDir}/${MANIFEST_FILE_NAME}`
        );
      });
    }

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
    delete treeFiles[`${this.vault.configDir}/${MANIFEST_FILE_NAME}`].sha;
    treeFiles[`${this.vault.configDir}/${MANIFEST_FILE_NAME}`].content =
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
    await this.logger.info("Sync done");
  }

  async downloadFile(file: GetTreeResponseItem, lastModified: number) {
    const url = file.url;
    const fileMetadata = this.metadataStore.data.files[file.path];
    if (fileMetadata && fileMetadata.sha === file.sha) {
      // File already exists and has the same SHA, no need to download it again.
      return;
    }

    const blob = await this.client.getBlob(url);
    const normalizedPath = normalizePath(file.path);
    const fileFolder = normalizePath(
      normalizedPath.split("/").slice(0, -1).join("/"),
    );
    if (!(await this.vault.adapter.exists(fileFolder))) {
      await this.vault.adapter.mkdir(fileFolder);
    }
    this.vault.adapter.writeBinary(
      normalizedPath,
      Buffer.from(blob.content, "base64"),
    );
    this.metadataStore.data.files[file.path] = {
      path: file.path,
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
    await this.logger.info("Loading metadata");
    await this.metadataStore.load();
    if (Object.keys(this.metadataStore.data.files).length === 0) {
      await this.logger.info("Metadata was empty, loading all files");
      let files = [];
      let folders = [this.vault.getRoot().path];
      while (folders.length > 0) {
        const folder = folders.pop();
        if (folder === undefined) {
          continue;
        }
        if (!this.settings.syncConfigDir && folder === this.vault.configDir) {
          await this.logger.info("Skipping config dir");
          // Skip the config dir if the user doesn't want to sync it
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

        this.metadataStore.data.files[filePath] = {
          path: filePath,
          sha: null,
          dirty: false,
          justDownloaded: false,
          lastModified: Date.now(),
        };
      });

      // Must be the first time we run, initialize the metadata store
      // with itself and all files in the vault.
      this.metadataStore.data.files[
        `${this.vault.configDir}/${MANIFEST_FILE_NAME}`
      ] = {
        path: `${this.vault.configDir}/${MANIFEST_FILE_NAME}`,
        sha: null,
        dirty: false,
        justDownloaded: false,
        lastModified: Date.now(),
      };
      this.metadataStore.save();
    }
    await this.logger.info("Loaded metadata");
  }

  /**
   * Add all the files in the config dir in the metadata store.
   * This is mainly useful when the user changes the sync config settings
   * as we need to add those files to the metadata store or they would never be synced.
   */
  async addConfigDirToMetadata() {
    await this.logger.info("Adding config dir to metadata");
    // Get all the files in the config dir
    let files = [];
    let folders = [this.vault.configDir];
    while (folders.length > 0) {
      const folder = folders.pop();
      if (folder === undefined) {
        continue;
      }
      const res = await this.vault.adapter.list(folder);
      files.push(...res.files);
      folders.push(...res.folders);
    }
    // Add them to the metadata store
    files.forEach((filePath: string) => {
      this.metadataStore.data.files[filePath] = {
        path: filePath,
        sha: null,
        dirty: false,
        justDownloaded: false,
        lastModified: Date.now(),
      };
    });
    this.metadataStore.save();
  }

  /**
   * Remove all the files in the config dir from the metadata store.
   * The metadata file is not removed as it must always be present.
   * This is mainly useful when the user changes the sync config settings
   * as we need to remove those files to the metadata store or they would
   * keep being synced.
   */
  async removeConfigDirFromMetadata() {
    await this.logger.info("Removing config dir from metadata");
    // Get all the files in the config dir
    let files = [];
    let folders = [this.vault.configDir];
    while (folders.length > 0) {
      const folder = folders.pop();
      if (folder === undefined) {
        continue;
      }
      const res = await this.vault.adapter.list(folder);
      files.push(...res.files);
      folders.push(...res.folders);
    }

    // Remove all them from the metadata store
    files.forEach((filePath: string) => {
      if (filePath === `${this.vault.configDir}/${MANIFEST_FILE_NAME}`) {
        // We don't want to remove the metadata file even if it's in the config dir
        return;
      }
      delete this.metadataStore.data.files[filePath];
    });
    this.metadataStore.save();
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
