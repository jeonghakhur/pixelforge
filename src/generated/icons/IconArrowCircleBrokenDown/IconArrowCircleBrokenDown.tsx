import type { SVGProps } from "react";

interface IconArrowCircleBrokenDownProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconArrowCircleBrokenDown = ({ size, color, className, ...props }: IconArrowCircleBrokenDownProps) => (
  <svg
    width={24}
    height={24}
    className={["icon-arrow-circle-broken-down", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17 3.33782C19.989 5.06687 22 8.29859 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 8.29859 4.01099 5.06687 7 3.33782M8 12L12 16M12 16L16 12M12 16V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
