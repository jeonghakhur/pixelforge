import type { SVGProps } from "react";

interface IconLaptopProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconLaptop = ({ size, color, className, ...props }: IconLaptopProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-laptop", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 3.49703C2 2.94639 2.45576 2.5 3.00247 2.5H12.9975C13.5512 2.5 14 2.95304 14 3.49703V9.99956C14 10.2759 13.771 10.5 13.4997 10.5H2.50035C2.22401 10.5 2 10.2692 2 9.99956V3.49703ZM1 12.0047C1 11.726 1.21991 11.5 1.49827 11.5H14.5017C14.7769 11.5 15 11.714 15 12.0047V12.5C15 13.0523 14.5501 13.5 13.9932 13.5H2.00685C1.45078 13.5 1 13.0561 1 12.5V12.0047Z"
      fill="currentColor"
     />
  </svg>
);
