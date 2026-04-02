import type { SVGProps } from "react";

interface IconPlayProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconPlay = ({ size, color, className, ...props }: IconPlayProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-play", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.20167 2.71721C3.4749 2.32079 2.88574 2.67898 2.88574 3.49497V12.5039C2.88574 13.3298 3.47715 13.6768 4.20167 13.2816L12.5698 8.71721C13.2966 8.32079 13.2943 7.67684 12.5698 7.28165L4.20167 2.71721Z"
      fill="currentColor"
     />
  </svg>
);
