export interface DiffChunk {
  type: "add" | "remove" | "modify";
  // These use the line number, so they start at 1.
  // If the DiffChunk is a single line the end will be start + 1.
  // If start and end are identical it means the line from left must
  // be added to right, and viceversa.
  startLeftLine: number;
  endLeftLine: number;
  startRightLine: number;
  endRightLine: number;
}

function diff(oldText: string, newText: string): DiffChunk[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffChunk[] = [];

  let i = 0;
  let j = 0;

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

  return mergeDiffs(result).map((chunk) =>
    clampChunkLines(chunk, oldLines.length, newLines.length),
  );
}

// Clamp lines in the change and change its type accordingly
function clampChunkLines(
  chunk: DiffChunk,
  oldLinesLength: number,
  newLinesLength: number,
): DiffChunk {
  const startLeftLine = clampLine(chunk.startLeftLine, oldLinesLength);
  const endLeftLine = clampLine(chunk.endLeftLine, oldLinesLength);
  const startRightLine = clampLine(chunk.startRightLine, newLinesLength);
  const endRightLine = clampLine(chunk.endRightLine, newLinesLength);
  let type = chunk.type;
  if (type === "modify") {
    // If we're here it means that the type was modify,
    // if the lines on one side are the same number
    // we nee to change the type or the change won't be shown correctly.
    if (startLeftLine === endLeftLine) {
      type = "add";
    } else if (startRightLine === endRightLine) {
      type = "remove";
    }
  }
  return {
    type,
    startLeftLine,
    endLeftLine,
    startRightLine,
    endRightLine,
  };
}

// Use to make sure the line number in the diff chunk doesn't exceed
// the number of lines of the document.
function clampLine(line: number, maxLines: number): number {
  return Math.min(Math.max(1, line), maxLines + 1);
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
