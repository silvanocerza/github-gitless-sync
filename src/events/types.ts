export type Event = {
  type: "create" | "delete" | "modify";
  filePath: string;
};
