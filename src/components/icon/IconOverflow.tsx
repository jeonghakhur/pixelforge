import type { SVGProps } from "react";

interface IconOverflowProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconOverflow = ({ size, color, className, ...props }: IconOverflowProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-overflow", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 6C4.105 6 5 6.895 5 8C5 9.105 4.105 10 3 10C1.895 10 1 9.105 1 8C1 6.895 1.895 6 3 6ZM8 6C9.105 6 10 6.895 10 8C10 9.105 9.105 10 8 10C6.895 10 6 9.105 6 8C6 6.895 6.895 6 8 6ZM13 6C14.105 6 15 6.895 15 8C15 9.105 14.105 10 13 10C11.895 10 11 9.105 11 8C11 6.895 11.895 6 13 6Z"
      fill="currentColor"
     />
  </svg>
);
