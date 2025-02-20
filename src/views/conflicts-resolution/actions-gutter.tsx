import * as React from "react";
import { DiffChunk } from "./diff";
import {
  ButtonCross,
  ButtonLeftArrow,
  ButtonRightArrow,
} from "./action-button";

interface ActionsGutterProps {
  diffChunks: DiffChunk[];
  // This is essential to correctly draw the lines between
  // the left and right editor
  lineHeight: number;
  onAcceptLeft: (chunk: DiffChunk) => void;
  onAcceptRight: (chunk: DiffChunk) => void;
  onReject: (chunk: DiffChunk) => void;
}

const ActionsGutter: React.FC<ActionsGutterProps> = ({
  diffChunks,
  lineHeight,
  onAcceptLeft,
  onAcceptRight,
  onReject,
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
    let buttons: React.JSX.Element;
    if (chunk.type === "add") {
      buttons = (
        <foreignObject
          x={actualWidth - 48}
          y={topLeft + lineHeight / 2 - 12}
          width="48"
          height="24"
        >
          <div style={{ display: "flex", flexDirection: "row" }}>
            <ButtonCross
              tooltipText="Delete lines"
              onClick={() => onReject(chunk)}
            />
            <ButtonLeftArrow
              tooltipText="Add lines"
              onClick={() => onAcceptLeft(chunk)}
            />
          </div>
        </foreignObject>
      );
    } else if (chunk.type === "remove") {
      buttons = (
        <foreignObject
          x={0}
          y={topLeft + lineHeight / 2 - 12}
          width="48"
          height="24"
        >
          <div style={{ display: "flex", flexDirection: "row" }}>
            <ButtonRightArrow
              tooltipText="Add lines"
              onClick={() => onAcceptRight(chunk)}
            />
            <ButtonCross
              tooltipText="Delete lines"
              onClick={() => onReject(chunk)}
            />
          </div>
        </foreignObject>
      );
    } else if (chunk.type === "modify") {
      buttons = (
        <foreignObject
          x={0}
          y={topLeft + lineHeight / 2 - 12}
          width={actualWidth}
          height="24"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <ButtonRightArrow
              tooltipText="Overwrite right lines"
              onClick={() => onAcceptRight(chunk)}
            />
            <ButtonLeftArrow
              tooltipText="Overwrite left lines"
              onClick={() => onAcceptLeft(chunk)}
            />
          </div>
        </foreignObject>
      );
    } else {
      // Just in case we add other types in the future
      throw Error("Unknown chunk type");
    }

    return (
      <g key={index}>
        <path
          d={`
          M 0 ${topLeft}
          L 48 ${topLeft}
          C ${actualWidth * 0.4} ${topLeft}, ${actualWidth * 0.6} ${topRight}, ${actualWidth - 48} ${topRight}
          L ${actualWidth} ${topRight}
          L ${actualWidth} ${bottomRight}
          L ${actualWidth - 48} ${bottomRight}
          C ${actualWidth * 0.6} ${bottomRight}, ${actualWidth * 0.4} ${bottomLeft}, 48 ${bottomLeft}
          L 0 ${bottomLeft}
          Z
          `}
          fill={color}
          fillOpacity="0.1"
          stroke={color}
          strokeWidth="1"
        />
        {buttons}
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
