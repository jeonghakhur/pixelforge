import type { SVGProps } from "react";

interface IconToggleProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconToggle = ({ size, color, className, ...props }: IconToggleProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-toggle", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 10.667C10.527 10.667 9.333 9.473 9.333 8C9.333 6.528 10.527 5.334 12 5.334C13.473 5.334 14.667 6.528 14.667 8C14.667 9.473 13.473 10.667 12 10.667ZM12 4H4C1.8 4 0 5.8 0 8C0 10.2 1.8 12 4 12H12C14.2 12 16 10.2 16 8C16 5.8 14.2 4 12 4Z"
      fill="currentColor"
     />
  </svg>
);
