import type { SVGProps } from "react";

interface IconDownProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconDown = ({ size, color, className, ...props }: IconDownProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-down", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.5899 13.6761C8.2639 14.1241 7.7379 14.1261 7.4099 13.6761L4.5899 9.79906C4.2639 9.35106 4.4439 8.98706 4.9999 8.98706H5.9999V3.99306C5.9999 2.88506 6.8879 1.98706 7.9999 1.98706C9.1049 1.98706 9.9999 2.87406 9.9999 3.99306V8.98706H10.9999C11.5519 8.98706 11.7379 9.34806 11.4099 9.79906L8.5899 13.6761Z"
      fill="currentColor"
     />
  </svg>
);
