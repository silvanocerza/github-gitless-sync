type DiffType = "add" | "remove" | "modify" | "equal";

export interface DiffResult {
  type: DiffType;
  value: string;
  oldValue?: string; // For modifications, store both values
  newValue?: string;
  from: number;
  to: number;
}

function diff(oldText: string, newText: string): DiffResult[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffResult[] = [];
  // This is an index in oldText
  let position = 0;

  // First pass: find exact matches and obvious modifications
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (!oldLine && newLine) {
      // Pure addition
      result.push({
        type: "add",
        value: newLine,
        from: position,
        to: position + newLine.length,
      });
    } else if (oldLine && !newLine) {
      // Pure removal
      result.push({
        type: "remove",
        value: oldLine,
        from: position,
        to: position + oldLine.length,
      });
    } else if (oldLine === newLine) {
      // Exact match
      result.push({
        type: "equal",
        value: oldLine,
        from: position,
        to: position + oldLine.length,
      });
    } else {
      // Different content at same line number - treat as modification
      result.push({
        type: "modify",
        value: newLine,
        oldValue: oldLine,
        newValue: newLine,
        from: position,
        to: position + Math.max(oldLine.length, newLine.length),
      });
    }

    const oldLineLength = oldLine ? oldLine.length : 0;
    const newLineLength = newLine ? newLine.length : 0;
    position += Math.max(oldLineLength, newLineLength) + 1;
  }

  return result;
}

export default diff;
