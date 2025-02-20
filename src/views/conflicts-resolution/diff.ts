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

  let i = 0,
    j = 0;

  while (i < oldLines.length || j < newLines.length) {
    // Skip identical lines
    while (
      i < oldLines.length &&
      j < newLines.length &&
      oldLines[i] === newLines[j]
    ) {
      i++;
      j++;
    }

    if (i < oldLines.length || j < newLines.length) {
      let nextMatchOld = i;
      let nextMatchNew = j;
      let found = false;

      // Look ahead for next match
      for (let lookAhead = 1; lookAhead < 3; lookAhead++) {
        if (
          i + lookAhead < oldLines.length &&
          newLines[j] === oldLines[i + lookAhead]
        ) {
          nextMatchOld = i + lookAhead;
          nextMatchNew = j;
          found = true;
          break;
        }
        if (
          j + lookAhead < newLines.length &&
          oldLines[i] === newLines[j + lookAhead]
        ) {
          nextMatchOld = i;
          nextMatchNew = j + lookAhead;
          found = true;
          break;
        }
      }

      if (found) {
        if (nextMatchOld > i) {
          result.push({
            type: "remove",
            startLeftLine: i + 1,
            endLeftLine: nextMatchOld + 1,
            startRightLine: j + 1,
            endRightLine: j + 1,
          });
        }
        if (nextMatchNew > j) {
          result.push({
            type: "add",
            startLeftLine: i + 1,
            endLeftLine: i + 1,
            startRightLine: j + 1,
            endRightLine: nextMatchNew + 1,
          });
        }
        i = nextMatchOld;
        j = nextMatchNew;
      } else {
        result.push({
          type: "modify",
          startLeftLine: i + 1,
          endLeftLine: i + 2,
          startRightLine: j + 1,
          endRightLine: j + 2,
        });
        i++;
        j++;
      }
    }
  }

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
