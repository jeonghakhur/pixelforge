import type { SVGProps } from "react";

interface IconPercentProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconPercent = ({ size, color, className, ...props }: IconPercentProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-percent", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 14.25C2.68 14.25 2.36 14.128 2.116 13.884C1.628 13.396 1.628 12.604 2.116 12.116L12.116 2.116C12.604 1.628 13.396 1.628 13.884 2.116C14.372 2.604 14.372 3.396 13.884 3.884L3.884 13.884C3.64 14.128 3.32 14.25 3 14.25ZM15 12.2C15 13.746 13.746 15 12.2 15C10.654 15 9.4 13.746 9.4 12.2C9.4 10.654 10.654 9.4 12.2 9.4C13.746 9.4 15 10.654 15 12.2ZM6.6 3.8C6.6 5.346 5.346 6.6 3.8 6.6C2.254 6.6 1 5.346 1 3.8C1 2.254 2.254 1 3.8 1C5.346 1 6.6 2.254 6.6 3.8Z"
      fill="currentColor"
     />
  </svg>
);
