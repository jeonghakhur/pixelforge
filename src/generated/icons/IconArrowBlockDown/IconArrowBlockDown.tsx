import type { SVGProps } from "react";

interface IconArrowBlockDownProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconArrowBlockDown = ({ size, color, className, ...props }: IconArrowBlockDownProps) => (
  <svg
    width={24}
    height={24}
    className={["icon-arrow-block-down", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9 3.8C9 3.51997 9 3.37996 9.0545 3.273C9.10243 3.17892 9.17892 3.10243 9.273 3.0545C9.37996 3 9.51997 3 9.8 3H14.2C14.48 3 14.62 3 14.727 3.0545C14.8211 3.10243 14.8976 3.17892 14.9455 3.273C15 3.37996 15 3.51997 15 3.8V14H19L12 21L5 14H9V3.8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
