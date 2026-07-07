import type { CSSProperties } from "react";

export const filled: CSSProperties = { fontVariationSettings: "'FILL' 1" };

export function MSym({
  name,
  className = "",
  fill = false,
  style,
}: {
  name: string;
  className?: string;
  fill?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { ...filled, ...style } : style}
    >
      {name}
    </span>
  );
}
