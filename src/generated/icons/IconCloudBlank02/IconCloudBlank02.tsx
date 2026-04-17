import type { SVGProps } from "react";

interface IconCloudBlank02Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconCloudBlank02 = ({ size, color, className, ...props }: IconCloudBlank02Props) => (
  <svg
    width={24}
    height={24}
    className={["icon-cloud-blank02", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9.5 19C5.35786 19 2 15.6421 2 11.5C2 7.35786 5.35786 4 9.5 4C12.3827 4 14.8855 5.62634 16.141 8.01153C16.2597 8.00388 16.3794 8 16.5 8C19.5376 8 22 10.4624 22 13.5C22 16.5376 19.5376 19 16.5 19C13.9485 19 12.1224 19 9.5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
