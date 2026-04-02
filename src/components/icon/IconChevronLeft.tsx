import type { SVGProps } from "react";

interface IconChevronLeftProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconChevronLeft = ({ size, color, className, ...props }: IconChevronLeftProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-chevron-left", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.8516 11.4756C11.0362 11.6726 11.1369 11.9336 11.1325 12.2036C11.1281 12.4735 11.0189 12.7311 10.8281 12.922C10.6372 13.1129 10.3795 13.2221 10.1096 13.2265C9.83971 13.2309 9.57866 13.1301 9.38165 12.9456L5.17165 8.73458C4.97685 8.53957 4.86743 8.27521 4.86743 7.99958C4.86743 7.72395 4.97685 7.45959 5.17165 7.26458L9.38165 3.05458C9.57866 2.87002 9.83971 2.7693 10.1096 2.7737C10.3795 2.7781 10.6372 2.88728 10.8281 3.07817C11.0189 3.26905 11.1281 3.52668 11.1325 3.7966C11.1369 4.06652 11.0362 4.32757 10.8516 4.52458L7.37665 7.99958L10.8516 11.4756Z"
      fill="currentColor"
     />
  </svg>
);
