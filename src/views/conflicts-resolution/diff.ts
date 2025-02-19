export interface DiffChunk {
  type: "add" | "remove" | "modify";
  startLeftLine: number;
  endLeftLine: number;
  startRightLine: number;
  endRightLine: number;
}

function diff(oldText: string, newText: string): DiffChunk[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffChunk[] = [];

  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (!oldLine && newLine) {
      result.push({
        type: "add",
        startLeftLine: i + 1,
        endLeftLine: i + 1,
        startRightLine: i + 1,
        endRightLine: i + 2,
      });
    } else if (oldLine && !newLine) {
      result.push({
        type: "remove",
        startLeftLine: i + 1,
        endLeftLine: i + 2,
        startRightLine: i + 1,
        endRightLine: i + 1,
      });
    } else if (oldLine !== newLine) {
      result.push({
        type: "modify",
        startLeftLine: i + 1,
        endLeftLine: i + 2,
        startRightLine: i + 1,
        endRightLine: i + 2,
      });
    }
  }
  // return result;
  return mergeDiffs(result);
}

function mergeDiffs(chunks: DiffChunk[]): DiffChunk[] {
  if (chunks.length <= 1) return chunks;

  return chunks.reduce((merged: DiffChunk[], current) => {
    const previous = merged[merged.length - 1];

    if (
      previous &&
      (previous.endLeftLine === current.startLeftLine ||
        previous.endRightLine === current.startRightLine)
    ) {
      previous.endLeftLine = current.endLeftLine;
      previous.endRightLine = current.endRightLine;
      previous.type = "modify";
      return merged;
    }

    merged.push({ ...current });
    return merged;
  }, []);
}

export default diff;
