import type { SVGProps } from "react";

interface IconLink05Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconLink05 = ({ size, color, className, ...props }: IconLink05Props) => (
  <svg
    width={24}
    height={24}
    className={["icon-link05", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9 17H7C4.23858 17 2 14.7614 2 12C2 9.23858 4.23858 7 7 7H9M8 12L18 12M15.7778 17H17C19.7614 17 22 14.7614 22 12C22 9.23858 19.7614 7 17 7H15.7778C15.3482 7 15 7.34822 15 7.77778V16.2222C15 16.6518 15.3482 17 15.7778 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
