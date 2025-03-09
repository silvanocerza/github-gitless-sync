import { StateEffect, StateField } from "@uiw/react-codemirror";

/// Possible transaction effects we can apply to the ranges state field
/// when it gets updated.
export type RangeUpdateOperation =
  | RangeChangeSourceOperation
  | RangeRemoveOperation;

export const UpdateRangesEffect = StateEffect.define<RangeUpdateOperation>();

export type RangeChangeSourceOperation = {
  index: number;
  newSource: "remote" | "local" | "both";
};

export type RangeRemoveOperation = {
  index: number;
};

/// Create the ranges state field that we can access and use to highlight and
/// resolve conflicts.
export const createRangesStateField = (
  initialRanges: ConflictRange[],
): StateField<ConflictRange[]> => {
  return StateField.define<ConflictRange[]>({
    create: () => initialRanges,
    update: (ranges, tr) => {
      const rangeEffects = tr.effects
        .filter((e) => e.is(UpdateRangesEffect))
        .reduce((acc, e) => {
          const operation = e.value as RangeUpdateOperation;
          acc.set(operation.index, operation);
          return acc;
        }, new Map<number, RangeUpdateOperation>());

      if (!tr.docChanged && rangeEffects.size === 0) {
        return ranges;
      }

      // Map all positions through the changes and apply any effect
      let newRanges = ranges
        .map((range, index) => {
          let source = range.source;
          const effect = rangeEffects.get(index) as RangeChangeSourceOperation;
          if (effect) {
            source = effect.newSource;
          }
          return {
            from: tr.changes.mapPos(range.from),
            to: tr.changes.mapPos(range.to, 1),
            source,
          };
        })
        .filter((range, index) => {
          return range.from !== range.to && !rangeEffects.has(index);
        });

      // Sort ranges by start position (leftmost first)
      newRanges.sort((a, b) => a.from - b.from);

      // Process ranges line by line
      const lineToRangeMap = new Map(); // Maps line number to controlling range

      // First pass: determine which range controls each line
      for (const range of newRanges) {
        const startLine = tr.newDoc.lineAt(range.from).number;
        const endLine = tr.newDoc.lineAt(range.to).number;

        for (let line = startLine; line <= endLine; line++) {
          // If this line isn't claimed yet, the leftmost range (processed first) gets it
          if (!lineToRangeMap.has(line)) {
            lineToRangeMap.set(line, range);
          }
        }
      }

      // Second pass: merge ranges that control consecutive lines
      const mergedRanges = [];
      let currentRange = null;

      // Process lines in order
      const allLines = Array.from(lineToRangeMap.keys()).sort((a, b) => a - b);

      for (const line of allLines) {
        const rangeForLine = lineToRangeMap.get(line);

        if (!currentRange) {
          // Start a new merged range
          currentRange = {
            from: tr.newDoc.line(line).from,
            to: tr.newDoc.line(line).to,
            source: rangeForLine.source,
          };
        } else if (
          currentRange.source === rangeForLine.source &&
          line === tr.newDoc.lineAt(currentRange.to).number + 1
        ) {
          // Extend current range if it's the same source and consecutive line
          currentRange.to = tr.newDoc.line(line).to;
        } else {
          // Finish current range and start a new one
          mergedRanges.push(currentRange);
          currentRange = {
            from: tr.newDoc.line(line).from,
            to: tr.newDoc.line(line).to,
            source: rangeForLine.source,
          };
        }
      }

      // Add the last range
      if (currentRange) {
        mergedRanges.push(currentRange);
      }

      return mergedRanges;
    },
  });
};
