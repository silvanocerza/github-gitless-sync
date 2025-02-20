import * as React from "react";
import { DiffChunk } from "./diff";

interface ActionsGutterProps {
  diffChunks: DiffChunk[];
  // This is essential to correctly draw the lines between
  // the left and right editor
  lineHeight: number;
}

const ActionsGutter: React.FC<ActionsGutterProps> = ({
  diffChunks,
  lineHeight,
}) => {
  const [actualWidth, setActualWidth] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      setActualWidth(entries[0].contentRect.width);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

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
          C ${actualWidth * 0.4} ${topLeft}, ${actualWidth * 0.6} ${topRight}, ${actualWidth} ${topRight}
          L ${actualWidth} ${bottomRight}
          C ${actualWidth * 0.6} ${bottomRight}, ${actualWidth * 0.4} ${bottomLeft}, 0 ${bottomLeft}
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
    <div ref={containerRef} style={{ width: "100%" }}>
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
