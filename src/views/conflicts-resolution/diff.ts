export type DiffResult = {
  type: "add" | "remove" | "equal";
  value: string;
  from: number;
  to: number;
};

export default function diff(oldText: string, newText: string): DiffResult[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const matrix = Array(oldLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0));

  // Fill the matrix
  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  // Backtrack to find differences
  const result: DiffResult[] = [];
  let i = oldLines.length;
  let j = newLines.length;
  let position = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      const value = oldLines[i - 1];
      result.unshift({
        type: "equal",
        value,
        from: position,
        to: position + value.length,
      });
      position += value.length + 1; // +1 for newline
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      const value = newLines[j - 1];
      result.unshift({
        type: "add",
        value,
        from: position,
        to: position + value.length,
      });
      position += value.length + 1;
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      const value = oldLines[i - 1];
      result.unshift({
        type: "remove",
        value,
        from: position,
        to: position + value.length,
      });
      position += value.length + 1;
      i--;
    }
  }

  return result;
}
