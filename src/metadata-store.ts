import { Vault } from "obsidian";

/**
 * A file metadata.
 * Store info that makes easier to track a file locally and in the remote repo.
 */
export interface FileMetadata {
  // Local path to the file
  localPath: string;
  // Path to the file in the remote repository.
  remotePath: string;
  // SHA of the file in the remote repository.
  // This is necessary to update the file remotely.
  // If this is null the file has not yet been pushed to the remote repository.
  sha: string | null;
  // Whether the file has been modified locally.
  dirty: boolean;
}

export interface Metadata {
  [key: string]: FileMetadata;
}

/**
 * Stores files metadata between sesssions.
 * Data is saved as JSON in the .obsidian folder in the current Vault.
 */
export default class MetadataStore {
  data: Metadata;
  private metadataFile: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private vault: Vault) {
    this.metadataFile = `${this.vault.configDir}/obsidian-github-sync-metadata.json`;
  }

  /**
   * Loads the metadata from disk.
   */
  async load() {
    const existingFile = this.vault.getFileByPath(this.metadataFile);
    if (existingFile) {
      const content = await this.vault.read(existingFile);
      this.data = JSON.parse(content);
    } else {
      this.data = {};
    }
  }

  /**
   * Save current metadata to disk.
   */
  async save() {
    this.writeQueue = this.writeQueue.then(async () => {
      await this.vault.adapter.write(
        this.metadataFile,
        JSON.stringify(this.data),
      );
    });
    return this.writeQueue;
  }
}
