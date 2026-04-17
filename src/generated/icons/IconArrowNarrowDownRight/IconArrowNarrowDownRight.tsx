import type { SVGProps } from "react";

interface IconArrowNarrowDownRightProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconArrowNarrowDownRight = ({ size, color, className, ...props }: IconArrowNarrowDownRightProps) => (
  <svg
    width={24}
    height={24}
    className={["icon-arrow-narrow-down-right", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 6L18 18M18 18V10M18 18H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
