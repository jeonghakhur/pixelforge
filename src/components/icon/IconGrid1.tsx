import type { SVGProps } from "react";

interface IconGrid1Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconGrid1 = ({ size, color, className, ...props }: IconGrid1Props) => (
  <svg
    width={16}
    height={16}
    className={["icon-grid1", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 3.5C2 2.672 2.674 2 3.5 2H5.5C6.328 2 7 2.674 7 3.5V5.5C7 6.328 6.326 7 5.5 7H3.5C2.672 7 2 6.326 2 5.5V3.5ZM2 10.5C2 9.672 2.674 9 3.5 9H5.5C6.328 9 7 9.674 7 10.5V12.5C7 13.328 6.326 14 5.5 14H3.5C2.672 14 2 13.326 2 12.5V10.5ZM9 3.5C9 2.672 9.674 2 10.5 2H12.5C13.328 2 14 2.674 14 3.5V5.5C14 6.328 13.326 7 12.5 7H10.5C9.672 7 9 6.326 9 5.5V3.5ZM9 10.5C9 9.672 9.674 9 10.5 9H12.5C13.328 9 14 9.674 14 10.5V12.5C14 13.328 13.326 14 12.5 14H10.5C9.672 14 9 13.326 9 12.5V10.5Z"
      fill="currentColor"
     />
  </svg>
);
