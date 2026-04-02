import type { SVGProps } from "react";

interface IconUpProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconUp = ({ size, color, className, ...props }: IconUpProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-up", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.59014 2.32381C8.26414 1.87581 7.73714 1.87381 7.41014 2.32381L4.59014 6.20081C4.26414 6.64881 4.44414 7.01281 5.00014 7.01281H6.00014V12.0068C6.00014 13.1148 6.88714 14.0128 8.00014 14.0128C9.10414 14.0128 10.0001 13.1258 10.0001 12.0068V7.01281H11.0001C11.5521 7.01281 11.7371 6.65181 11.4101 6.20081L8.59014 2.32381Z"
      fill="currentColor"
     />
  </svg>
);
