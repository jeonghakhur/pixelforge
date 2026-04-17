import type { SVGProps } from "react";

interface IconArrowNarrowUpLeftProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconArrowNarrowUpLeft = ({ size, color, className, ...props }: IconArrowNarrowUpLeftProps) => (
  <svg
    width={24}
    height={24}
    className={["icon-arrow-narrow-up-left", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18 18L6 6M6 6V14M6 6H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
