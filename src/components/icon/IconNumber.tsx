import type { SVGProps } from "react";

interface IconNumberProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconNumber = ({ size, color, className, ...props }: IconNumberProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-number", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.01465 9.96851V6.03149H2.02488C1.45589 6.03149 0.994629 5.57365 0.994629 5C0.994629 4.43032 1.4608 3.96851 2.02488 3.96851H4.01465V2.01152C4.01465 1.47027 4.45407 1.03149 5.00464 1.03149C5.5514 1.03149 5.99463 1.47942 5.99463 2.01152V3.96851H10.0347V2.01152C10.0347 1.47027 10.4741 1.03149 11.0247 1.03149C11.5714 1.03149 12.0146 1.47942 12.0146 2.01152V3.96851H13.9752C14.5442 3.96851 15.0055 4.42635 15.0055 5C15.0055 5.56968 14.5393 6.03149 13.9752 6.03149H12.0146V9.96851H13.9752C14.5442 9.96851 15.0055 10.4263 15.0055 11C15.0055 11.5697 14.5393 12.0315 13.9752 12.0315H12.0146V13.9885C12.0146 14.5297 11.5752 14.9685 11.0247 14.9685C10.4779 14.9685 10.0347 14.5206 10.0347 13.9885V12.0315H5.99463V13.9885C5.99463 14.5297 5.55521 14.9685 5.00464 14.9685C4.45788 14.9685 4.01465 14.5206 4.01465 13.9885V12.0315H2.02488C1.45589 12.0315 0.994629 11.5737 0.994629 11C0.994629 10.4303 1.4608 9.96851 2.02488 9.96851H4.01465ZM5.99463 9.96851H10.0347V6.03149H5.99463V9.96851Z"
      fill="currentColor"
     />
  </svg>
);
