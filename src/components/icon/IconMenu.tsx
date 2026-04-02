import type { SVGProps } from "react";

interface IconMenuProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconMenu = ({ size, color, className, ...props }: IconMenuProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-menu", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 12C2 11.4477 2.45576 11 3.00247 11H12.9975C13.5512 11 14 11.4439 14 12C14 12.5523 13.5442 13 12.9975 13H3.00247C2.44882 13 2 12.5561 2 12ZM2 8C2 7.44772 2.45576 7 3.00247 7H12.9975C13.5512 7 14 7.44386 14 8C14 8.55228 13.5442 9 12.9975 9H3.00247C2.44882 9 2 8.55614 2 8ZM2 4C2 3.44772 2.45576 3 3.00247 3H12.9975C13.5512 3 14 3.44386 14 4C14 4.55228 13.5442 5 12.9975 5H3.00247C2.44882 5 2 4.55614 2 4Z"
      fill="currentColor"
     />
  </svg>
);
