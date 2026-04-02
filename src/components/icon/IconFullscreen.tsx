import type { SVGProps } from "react";

interface IconFullscreenProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconFullscreen = ({ size, color, className, ...props }: IconFullscreenProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-fullscreen", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 1.99219H4C2.89543 1.99219 2 2.88762 2 3.99219V5.99219H4V3.99219H6V1.99219ZM6 12.0076H4V9.99219H2V12.0076C2 13.1122 2.89543 14.0076 4 14.0076H6V12.0076ZM10 14.0076V12.0076H12V9.99219H14V12.0076C14 13.1122 13.1046 14.0076 12 14.0076H10ZM10 3.99219V1.99219H12C13.1046 1.99219 14 2.88762 14 3.99219V5.99219H12V3.99219H10ZM5.5 6.49219C5.5 5.93991 5.94772 5.49219 6.5 5.49219H9.5C10.0523 5.49219 10.5 5.93991 10.5 6.49219V9.49219C10.5 10.0445 10.0523 10.4922 9.5 10.4922H6.5C5.94772 10.4922 5.5 10.0445 5.5 9.49219V6.49219Z"
      fill="currentColor"
     />
  </svg>
);
