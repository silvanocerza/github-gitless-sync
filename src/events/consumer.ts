import GithubClient from "src/github/client";
import { type Event } from "./types";
import MetadataStore from "src/metadata-store";

export default class EventsConsumer {
  constructor(
    private readonly client: GithubClient,
    private readonly metadataStore: MetadataStore,
    private readonly owner: string,
    private readonly repo: string,
    private readonly branch: string,
  ) {}

  async process(event: Event): Promise<void> {
    if (event.type == "create" || event.type == "modify") {
      const res = await this.client.uploadFile(
        this.owner,
        this.repo,
        this.branch,
        event.filePath,
      );
      // Reset dirty state
      this.metadataStore.data[event.filePath].dirty = false;
      this.metadataStore.save();
    } else if (event.type == "delete") {
      const res = await this.client.deleteFile(
        this.owner,
        this.repo,
        this.branch,
        event.filePath,
      );
      // File has been deleted, no need to keep track of it anymore
      delete this.metadataStore.data[event.filePath];
      this.metadataStore.save();
    }
  }
}
