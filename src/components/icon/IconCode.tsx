import type { SVGProps } from "react";

interface IconCodeProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconCode = ({ size, color, className, ...props }: IconCodeProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-code", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0.359588 6.64026L4.29423 2.70562C4.68723 2.31262 5.31822 2.31807 5.71076 2.71061L6.28924 3.28909C6.6875 3.68735 6.68395 4.3159 6.29409 4.70576L3.35497 7.64488C3.15192 7.84793 3.15893 8.15878 3.35497 8.35482L6.29409 11.2939C6.68613 11.686 6.68178 12.3181 6.28924 12.7106L5.71076 13.2891C5.3125 13.6873 4.68401 13.6839 4.29423 13.2941L0.359588 9.35944C0.155123 9.15497 0 8.77389 0 8.49517V7.50453C0 7.21388 0.160993 6.83886 0.359588 6.64026ZM15.6404 9.35944L11.7058 13.2941C11.3128 13.6871 10.6818 13.6816 10.2892 13.2891L9.71076 12.7106C9.3125 12.3123 9.31605 11.6838 9.70591 11.2939L12.645 8.35482C12.8481 8.15177 12.8411 7.84092 12.645 7.64488L9.70591 4.70576C9.31387 4.31372 9.31822 3.68163 9.71076 3.28909L10.2892 2.71061C10.6875 2.31235 11.316 2.31584 11.7058 2.70562L15.6404 6.64026C15.8449 6.84473 16 7.2258 16 7.50453V8.49517C16 8.78581 15.839 9.16084 15.6404 9.35944Z"
      fill="currentColor"
     />
  </svg>
);
