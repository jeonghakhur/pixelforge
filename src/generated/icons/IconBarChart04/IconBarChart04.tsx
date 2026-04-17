import type { SVGProps } from "react";

interface IconBarChart04Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconBarChart04 = ({ size, color, className, ...props }: IconBarChart04Props) => (
  <svg
    width={24}
    height={24}
    className={["icon-bar-chart04", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M3 11L3 21M15 11L15 21M9 3L9 21M21 3V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
