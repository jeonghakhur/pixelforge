import type { SVGProps } from "react";

interface IconChevronSelectorHorizontalProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconChevronSelectorHorizontal = ({ size, color, className, ...props }: IconChevronSelectorHorizontalProps) => (
  <svg
    width={24}
    height={24}
    className={["icon-chevron-selector-horizontal", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9 7L4 12L9 17M15 7L20 12L15 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
