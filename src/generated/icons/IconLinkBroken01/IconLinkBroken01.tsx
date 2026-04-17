import type { SVGProps } from "react";

interface IconLinkBroken01Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconLinkBroken01 = ({ size, color, className, ...props }: IconLinkBroken01Props) => (
  <svg
    width={24}
    height={24}
    className={["icon-link-broken01", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9 4V2M15 20V22M4 9H2M20 15H22M4.91421 4.91421L3.5 3.5M19.0858 19.0858L20.5 20.5M12 17.6569L9.87868 19.7782C8.31658 21.3403 5.78392 21.3403 4.22183 19.7782C2.65973 18.2161 2.65973 15.6834 4.22183 14.1213L6.34315 12M17.6569 12L19.7782 9.87868C21.3403 8.31658 21.3403 5.78392 19.7782 4.22183C18.2161 2.65973 15.6834 2.65973 14.1213 4.22183L12 6.34315" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
