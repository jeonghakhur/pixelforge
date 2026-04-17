import type { SVGProps } from "react";

interface IconAsterisk02Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconAsterisk02 = ({ size, color, className, ...props }: IconAsterisk02Props) => (
  <svg
    width={24}
    height={24}
    className={["icon-asterisk02", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 4V20M18 6L6 18M20 12H4M18 18L6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
