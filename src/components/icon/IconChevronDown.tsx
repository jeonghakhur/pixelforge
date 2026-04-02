import type { SVGProps } from "react";

interface IconChevronDownProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconChevronDown = ({ size, color, className, ...props }: IconChevronDownProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-chevron-down", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.2929 5.28694C11.4815 5.10478 11.7341 5.00398 11.9963 5.00626C12.2585 5.00854 12.5093 5.11371 12.6947 5.29912C12.8801 5.48453 12.9853 5.73534 12.9876 5.99754C12.9899 6.25973 12.8891 6.51234 12.7069 6.70094L8.70692 10.7009C8.51939 10.8884 8.26508 10.9937 7.99992 10.9937C7.73475 10.9937 7.48045 10.8884 7.29292 10.7009L3.29292 6.70094C3.11076 6.51234 3.00997 6.25973 3.01224 5.99754C3.01452 5.73534 3.11969 5.48453 3.3051 5.29912C3.49051 5.11371 3.74132 5.00854 4.00352 5.00626C4.26571 5.00398 4.51832 5.10478 4.70692 5.28694L7.99992 8.57994L11.2929 5.28694Z"
      fill="currentColor"
     />
  </svg>
);
