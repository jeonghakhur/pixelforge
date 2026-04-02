import type { SVGProps } from "react";

interface IconWindowsProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconWindows = ({ size, color, className, ...props }: IconWindowsProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-windows", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 3.71096L6.90722 3.03973V7.76575H2V3.71096ZM7.49828 2.94658L14 2V7.72603H7.49828V2.94658ZM2 8.26575H6.90722V13.0055L2 12.3205V8.26575ZM7.49828 8.32877H14V14L7.49828 13.0822"
      fill="currentColor"
     />
  </svg>
);
