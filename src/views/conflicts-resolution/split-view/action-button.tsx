interface ButtonProps {
  size?: number | string;
  tooltipText: string;
  onClick: () => void;
  className?: string;
}

const BaseButton: React.FC<ButtonProps & { children: React.ReactNode }> = ({
  size = 24,
  tooltipText,
  onClick,
  children,
  className,
}) => (
  <div
    style={{ padding: 0 }}
    aria-label={tooltipText}
    data-tooltip-position="top"
    data-tooltip-delay="300"
    className="clickable-icon"
    onClick={onClick}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: `${size}`,
        height: `${size}`,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
      }}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      {children}
    </svg>
  </div>
);

export const ButtonCross: React.FC<ButtonProps> = (props) => (
  <BaseButton {...props} className="lucide lucide-x">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </BaseButton>
);

export const ButtonLeftArrow: React.FC<ButtonProps> = (props) => (
  <BaseButton {...props} className="lucide arrow-big-left">
    <path d="M18 15h-6v4l-7-7 7-7v4h6v6z" />
  </BaseButton>
);

export const ButtonRightArrow: React.FC<ButtonProps> = (props) => (
  <BaseButton {...props} className="lucide lucide-arrow-big-right">
    <path d="M6 9h6V5l7 7-7 7v-4H6V9z" />
  </BaseButton>
);
