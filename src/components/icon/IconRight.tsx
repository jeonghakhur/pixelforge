import type { SVGProps } from "react";

interface IconRightProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconRight = ({ size, color, className, ...props }: IconRightProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-right", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.81331 4.56479C9.35731 4.25679 8.98731 4.44979 8.98731 5.00479V6.00479H3.99331C3.73008 6.00373 3.46925 6.0547 3.22578 6.15476C2.98232 6.25483 2.76103 6.40201 2.57462 6.58786C2.38822 6.77371 2.24037 6.99456 2.13958 7.23772C2.03879 7.48088 1.98704 7.74156 1.98731 8.00479C1.98731 9.10979 2.87431 10.0048 3.99331 10.0048H8.98731V11.0048C8.98731 11.5578 9.34731 11.7458 9.79031 11.4258L13.6803 8.58879C14.1263 8.26379 14.1203 7.73079 13.6833 7.40879L9.81331 4.56579V4.56479Z"
      fill="currentColor"
     />
  </svg>
);
