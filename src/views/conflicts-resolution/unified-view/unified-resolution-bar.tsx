import * as React from "react";

interface UnifiedResolutionBarProps {
  onAccept?: () => void;
  onDiscard?: () => void;
  onAcceptAbove?: () => void;
  onAcceptBelow?: () => void;
  onAcceptBoth?: () => void;
  onDiscardBoth?: () => void;
}

/// Component that shows buttons the user can click to resolve conflicts
const UnifiedResolutionBar: React.FC<UnifiedResolutionBarProps> = ({
  onAccept,
  onDiscard,
  onAcceptAbove,
  onAcceptBelow,
  onAcceptBoth,
  onDiscardBoth,
}) => {
  const renderActions = () => {
    if (onAccept !== undefined && onDiscard !== undefined) {
      return (
        <>
          <ClickableText text="Accept" onClick={() => onAccept?.()} />
          {" | "}
          <ClickableText text="Discard" onClick={() => onDiscard?.()} />
        </>
      );
    }

    return (
      <>
        <ClickableText text="Accept above" onClick={() => onAcceptAbove?.()} />
        {" | "}
        <ClickableText text="Accept below" onClick={() => onAcceptBelow?.()} />
        {" | "}
        <ClickableText text="Accept both" onClick={() => onAcceptBoth?.()} />
        {" | "}
        <ClickableText text="Discard both" onClick={() => onDiscardBoth?.()} />
      </>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        justifyItems: "left",
        fontSize: "var(--font-ui-small)",
        fontFamily: "var(--font-interface)",
        color: "var(--text-muted)",
        backgroundColor: "var(--background-secondary)",
        padding: "var(--size-2-2)",
        paddingLeft: "var(--size-2-3)",
        userSelect: "none",
      }}
    >
      {renderActions()}
    </div>
  );
};

interface ClickableTextProps {
  text: string;
  onClick: () => void;
}

const ClickableText: React.FC<ClickableTextProps> = ({ text, onClick }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      style={{
        cursor: "pointer",
        color: hovered ? "var(--text-accent)" : "inherit",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {text}
    </div>
  );
};

export default UnifiedResolutionBar;
