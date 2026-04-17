import type { SVGProps } from "react";

interface IconToggle03LeftProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconToggle03Left = ({ size, color, className, ...props }: IconToggle03LeftProps) => (
  <svg
    width={24}
    height={24}
    className={["icon-toggle03-left", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M2 12C2 8.68629 4.68629 6 8 6H16C19.3137 6 22 8.68629 22 12C22 15.3137 19.3137 18 16 18H8C4.68629 18 2 15.3137 2 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<path d="M8 14.5C9.38071 14.5 10.5 13.3807 10.5 12C10.5 10.6193 9.38071 9.5 8 9.5C6.61929 9.5 5.5 10.6193 5.5 12C5.5 13.3807 6.61929 14.5 8 14.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
