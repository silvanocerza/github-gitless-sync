import { type Event } from "./types";
import SyncManager from "src/sync-manager";

export default class EventsConsumer {
  constructor(private readonly syncManager: SyncManager) {}

  async process(event: Event): Promise<void> {
    if (event.type == "create" || event.type == "modify") {
      await this.syncManager.uploadFile(event.file);
    } else if (event.type == "delete") {
      await this.syncManager.deleteFile(event.filePath);
    }
  }
}
