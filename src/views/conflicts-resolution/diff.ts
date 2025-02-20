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

  let matrix = Array(oldLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= oldLines.length; i++) matrix[i][0] = i;
  for (let j = 1; j <= newLines.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1, // substitution
        );
      }
    }
  }

  const chunks: DiffChunk[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      i--;
      j--;
      continue;
    }

    const deletion = i > 0 ? matrix[i - 1][j] : Infinity;
    const insertion = j > 0 ? matrix[i][j - 1] : Infinity;
    const substitution = i > 0 && j > 0 ? matrix[i - 1][j - 1] : Infinity;

    if (substitution <= deletion && substitution <= insertion) {
      chunks.unshift({
        type: "modify",
        startLeftLine: i,
        endLeftLine: i + 1,
        startRightLine: j,
        endRightLine: j + 1,
      });
      i--;
      j--;
    } else if (deletion <= insertion) {
      chunks.unshift({
        type: "remove",
        startLeftLine: i,
        endLeftLine: i + 1,
        startRightLine: j + 1,
        endRightLine: j + 1,
      });
      i--;
    } else {
      chunks.unshift({
        type: "add",
        startLeftLine: i + 1,
        endLeftLine: i + 1,
        startRightLine: j,
        endRightLine: j + 1,
      });
      j--;
    }
  }

  return mergeDiffs(chunks);
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
