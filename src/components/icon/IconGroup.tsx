import type { SVGProps } from "react";

interface IconGroupProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconGroup = ({ size, color, className, ...props }: IconGroupProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-group", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1 3.006C1 1.898 1.897 1 3.006 1H12.994C14.102 1 15 1.897 15 3.006V12.994C15.0001 13.2575 14.9483 13.5184 14.8476 13.7618C14.7468 14.0053 14.599 14.2264 14.4127 14.4127C14.2264 14.599 14.0053 14.7468 13.7618 14.8476C13.5184 14.9483 13.2575 15.0001 12.994 15H3.006C2.74253 15.0001 2.48162 14.9483 2.23818 14.8476C1.99474 14.7468 1.77355 14.599 1.58725 14.4127C1.40095 14.2264 1.25319 14.0053 1.15243 13.7618C1.05167 13.5184 0.999869 13.2575 1 12.994V3.006ZM3 3.996V12.005C3 12.545 3.446 13 3.995 13H12.005C12.545 13 13 12.554 13 12.005V3.995C13 3.455 12.554 3 12.005 3H3.995C3.455 3 3 3.446 3 3.995V3.996ZM7 6C7 5.448 7.444 5 8 5H11C11.552 5 12 5.444 12 6C12 6.552 11.556 7 11 7H8C7.448 7 7 6.556 7 6ZM7 10C7 9.448 7.444 9 8 9H11C11.552 9 12 9.444 12 10C12 10.552 11.556 11 11 11H8C7.448 11 7 10.556 7 10ZM4 6C4 5.448 4.444 5 5 5C5.552 5 6 5.444 6 6C6 6.552 5.556 7 5 7C4.448 7 4 6.556 4 6ZM4 10C4 9.448 4.444 9 5 9C5.552 9 6 9.444 6 10C6 10.552 5.556 11 5 11C4.448 11 4 10.556 4 10Z"
      fill="currentColor"
     />
  </svg>
);
