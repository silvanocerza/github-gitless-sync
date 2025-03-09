/// Defines where the range of the current document shown
/// in the editor comes from.
/// Both from and to and indexes of chars in the document,
/// usually pointing at the start and end of the line respectively.
interface ConflictRange {
  from: number;
  to: number;
  source: "remote" | "local" | "both";
}
