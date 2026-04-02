import type { SVGProps } from "react";

interface IconGalleryProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconGallery = ({ size, color, className, ...props }: IconGalleryProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-gallery", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 1.994C0 0.893 0.895 0 1.994 0H14.006C15.107 0 16 0.895 16 1.994V14.006C15.9997 14.5348 15.7896 15.0418 15.4157 15.4157C15.0418 15.7896 14.5348 15.9997 14.006 16H1.994C1.46524 15.9997 0.958212 15.7896 0.584322 15.4157C0.210432 15.0418 0.000264976 14.5348 0 14.006L0 1.994ZM2 3.5V5.5C2 6.326 2.672 7 3.5 7H5.5C6.326 7 7 6.328 7 5.5V3.5C7 2.674 6.328 2 5.5 2H3.5C2.674 2 2 2.672 2 3.5ZM2 10.5V12.5C2 13.326 2.672 14 3.5 14H5.5C6.326 14 7 13.328 7 12.5V10.5C7 9.674 6.328 9 5.5 9H3.5C2.674 9 2 9.672 2 10.5ZM9 3.5V5.5C9 6.326 9.672 7 10.5 7H12.5C13.326 7 14 6.328 14 5.5V3.5C14 2.674 13.328 2 12.5 2H10.5C9.674 2 9 2.672 9 3.5ZM9 10.5V12.5C9 13.326 9.672 14 10.5 14H12.5C13.326 14 14 13.328 14 12.5V10.5C14 9.674 13.328 9 12.5 9H10.5C9.674 9 9 9.672 9 10.5Z"
      fill="currentColor"
     />
  </svg>
);
