import type { SVGProps } from "react";

interface IconArrowUpLeftProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconArrowUpLeft = ({ size, color, className, ...props }: IconArrowUpLeftProps) => (
  <svg
    width={24}
    height={24}
    className={["icon-arrow-up-left", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17 17L7 7M7 7V17M7 7H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
