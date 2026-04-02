import type { SVGProps } from "react";

interface IconPlusProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconPlus = ({ size, color, className, ...props }: IconPlusProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-plus", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9 7V3.5C9 3.224 8.776 3 8.5 3H7.5C7.224 3 7 3.224 7 3.5V7H3.5C3.224 7 3 7.224 3 7.5V8.5C3 8.776 3.224 9 3.5 9H7V12.5C7 12.776 7.224 13 7.5 13H8.5C8.776 13 9 12.776 9 12.5V9H12.5C12.776 9 13 8.776 13 8.5V7.5C13 7.224 12.776 7 12.5 7H9Z"
      fill="currentColor"
     />
  </svg>
);
