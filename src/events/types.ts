import { TFile } from "obsidian";

export type CreateModifyEvent = {
  type: "create" | "modify";
  file: TFile;
};

export type DeleteEvent = {
  type: "delete";
  filePath: string;
};

export type Event = CreateModifyEvent | DeleteEvent;
