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

    position +=
      Math.max(oldLine ? oldLine.length : 0, newLine ? newLine.length : 0) + 1;
  }

  return result;
}

function similarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;

  // Simple word-based similarity
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  const commonWords = words1.filter((w) => words2.includes(w)).length;
  return commonWords / Math.max(words1.length, words2.length);
}

export default diff;
