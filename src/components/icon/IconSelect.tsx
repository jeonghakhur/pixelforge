import type { SVGProps } from "react";

interface IconSelectProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconSelect = ({ size, color, className, ...props }: IconSelectProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-select", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 15C6.14348 15 4.36301 14.2625 3.05025 12.9497C1.7375 11.637 1 9.85652 1 8C1 6.14348 1.7375 4.36301 3.05025 3.05025C4.36301 1.7375 6.14348 1 8 1C9.85652 1 11.637 1.7375 12.9497 3.05025C14.2625 4.36301 15 6.14348 15 8C15 9.85652 14.2625 11.637 12.9497 12.9497C11.637 14.2625 9.85652 15 8 15ZM5.032 6.835L7.469 10.665C7.759 11.122 8.239 11.126 8.532 10.665L10.968 6.835C11.259 6.378 11.051 6 10.498 6H5.502C4.937 6 4.737 6.374 5.031 6.835H5.032Z"
      fill="currentColor"
     />
  </svg>
);
