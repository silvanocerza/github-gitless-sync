import * as React from "react";
import { DiffChunk } from "./diff";

interface ActionsGutterProps {
  diffChunks: DiffChunk[];
  // This is essential to correctly draw the lines between
  // the left and right editor
  lineHeight: number;
  width: number;
}

const ActionsGutter: React.FC<ActionsGutterProps> = ({
  diffChunks,
  lineHeight,
  width,
}) => {
  const drawChunk = (chunk: DiffChunk, index: number) => {
    const topLeft = (chunk.startLeftLine - 1) * lineHeight;
    const bottomLeft = (chunk.endLeftLine - 1) * lineHeight;
    const topRight = (chunk.startRightLine - 1) * lineHeight;
    const bottomRight = (chunk.endRightLine - 1) * lineHeight;
    const color =
      chunk.type == "add"
        ? "var(--color-green)"
        : chunk.type == "remove"
          ? "var(--color-red)"
          : "var(--color-yellow)";
    return (
      <g key={index}>
        <path
          d={`
          M 0 ${topLeft}
          C ${width * 0.4} ${topLeft}, ${width * 0.6} ${topRight}, ${width} ${topRight}
          L ${width} ${bottomRight}
          C ${width * 0.6} ${bottomRight}, ${width * 0.4} ${bottomLeft}, 0 ${bottomLeft}
          Z
        `}
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1"
        />
      </g>
    );
  };

  return (
    <div style={{ width: width }}>
      <svg
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          overflow: "visible",
        }}
      >
        {diffChunks.map(drawChunk)}
      </svg>
    </div>
  );
};

export default ActionsGutter;
