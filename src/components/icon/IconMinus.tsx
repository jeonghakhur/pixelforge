import type { SVGProps } from "react";

interface IconMinusProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconMinus = ({ size, color, className, ...props }: IconMinusProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-minus", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.71429 7C3.32 7 3 7.224 3 7.5V8.5C3 8.776 3.32 9 3.71429 9H12.2857C12.68 9 13 8.776 13 8.5V7.5C13 7.224 12.68 7 12.2857 7H3.71429Z"
      fill="currentColor"
     />
  </svg>
);
