import type { Event, CreateModifyEvent, DeleteEvent } from "./types";

/**
 * A custom queue to better handle events.
 */
export default class EventsQueue {
  private eventsQueue: Map<string, Event> = new Map();

  /**
   * Enqueues an event in the queue.
   * Handles special cases when the previous event and the new one
   * would cancel themselves out.
   */
  enqueue(event: Event) {
    const filePath = event.type === "delete" ? event.filePath : event.file.path;
    if (!this.eventsQueue.has(filePath)) {
      // No other event exist for this file, just enqueue it
      this.eventsQueue.set(filePath, event);
      return;
    }

    if (
      this.eventsQueue.get(filePath)?.type === "create" &&
      event.type === "delete"
    ) {
      // The previous event was a create and the new one is a delete.
      // Just delete the previous one as they would amount to the same outcome.
      this.eventsQueue.delete(filePath);
    } else if (
      this.eventsQueue.get(filePath)?.type === "delete" &&
      event.type === "create"
    ) {
      // The old event was a delete and the new one is a create.
      // Delete the old one and enqueue a modify event as it likely
      // that the content changed.
      this.eventsQueue.delete(filePath);
      this.eventsQueue.set(filePath, {
        type: "modify",
        file: event.file,
      });
    } else {
      // Delete and enqueue the event in all other cases.
      // We first delete the event to change the order of the queue
      this.eventsQueue.delete(filePath);
      this.eventsQueue.set(filePath, event);
    }
  }

  /**
   * Returns and empties the events queue.
   */
  flush(): Event[] {
    const events: Event[] = [];
    this.eventsQueue.forEach((event) => {
      events.push(event);
    });
    this.eventsQueue.clear();
    return events;
  }
}
