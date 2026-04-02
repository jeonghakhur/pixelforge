import type { SVGProps } from "react";

interface IconChevronUpProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconChevronUp = ({ size, color, className, ...props }: IconChevronUpProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-chevron-up", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.70708 10.7008C4.61483 10.7963 4.50449 10.8725 4.38249 10.9249C4.26048 10.9773 4.12926 11.0049 3.99648 11.0061C3.8637 11.0072 3.73202 10.9819 3.60913 10.9316C3.48623 10.8813 3.37458 10.8071 3.28069 10.7132C3.18679 10.6193 3.11254 10.5077 3.06226 10.3848C3.01198 10.2619 2.98668 10.1302 2.98783 9.9974C2.98898 9.86462 3.01657 9.7334 3.06898 9.6114C3.12139 9.4894 3.19757 9.37905 3.29308 9.28681L7.29308 5.28681C7.48061 5.09933 7.73492 4.99402 8.00008 4.99402C8.26525 4.99402 8.51955 5.09933 8.70708 5.28681L12.7071 9.28681C12.8026 9.37905 12.8788 9.4894 12.9312 9.6114C12.9836 9.7334 13.0112 9.86462 13.0123 9.9974C13.0135 10.1302 12.9882 10.2619 12.9379 10.3848C12.8876 10.5077 12.8134 10.6193 12.7195 10.7132C12.6256 10.8071 12.5139 10.8813 12.391 10.9316C12.2681 10.9819 12.1365 11.0072 12.0037 11.0061C11.8709 11.0049 11.7397 10.9773 11.6177 10.9249C11.4957 10.8725 11.3853 10.7963 11.2931 10.7008L8.00008 7.4078L4.70708 10.7008Z"
      fill="currentColor"
     />
  </svg>
);
