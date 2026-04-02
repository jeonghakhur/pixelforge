import type { SVGProps } from "react";

interface IconMobileProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconMobile = ({ size, color, className, ...props }: IconMobileProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-mobile", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4 3.00586C4 1.89805 4.88671 1 5.9981 1H10.0019C11.1054 1 12 1.89706 12 3.00586V12.9941C12 14.1019 11.1133 15 10.0019 15H5.9981C4.89458 15 4 14.1029 4 12.9941V3.00586ZM5 3.50967V11.4903C5 11.7775 5.21983 12 5.491 12H10.509C10.7721 12 11 11.7718 11 11.4903V3.50967C11 3.22247 10.7802 3 10.509 3H5.491C5.22788 3 5 3.22819 5 3.50967ZM7.5 13.5C7.5 13.7681 7.72386 14 8 14C8.26807 14 8.5 13.7761 8.5 13.5C8.5 13.2319 8.27614 13 8 13C7.73193 13 7.5 13.2239 7.5 13.5Z"
      fill="currentColor"
     />
  </svg>
);
