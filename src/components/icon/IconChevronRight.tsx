import type { SVGProps } from "react";

interface IconChevronRightProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconChevronRight = ({ size, color, className, ...props }: IconChevronRightProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-chevron-right", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.14796 4.52446C4.9634 4.32745 4.86268 4.0664 4.86708 3.79648C4.87148 3.52656 4.98067 3.26893 5.17155 3.07805C5.36244 2.88716 5.62007 2.77798 5.88999 2.77358C6.1599 2.76917 6.42096 2.8699 6.61796 3.05446L10.829 7.26546C11.0238 7.46046 11.1332 7.72482 11.1332 8.00046C11.1332 8.27609 11.0238 8.54045 10.829 8.73546L6.61896 12.9455C6.42196 13.13 6.1609 13.2307 5.89099 13.2263C5.62107 13.2219 5.36344 13.1128 5.17255 12.9219C4.98167 12.731 4.87248 12.4734 4.86808 12.2034C4.86368 11.9335 4.9644 11.6725 5.14896 11.4755L8.62396 8.00046L5.14796 4.52446Z"
      fill="currentColor"
     />
  </svg>
);
