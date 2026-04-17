import type { SVGProps } from "react";

interface IconLineChartDown04Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconLineChartDown04 = ({ size, color, className, ...props }: IconLineChartDown04Props) => (
  <svg
    width={24}
    height={24}
    className={["icon-line-chart-down04", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M3 9L9.65533 13.7538C9.85422 13.8959 10.1267 13.8733 10.2995 13.7005L13.7005 10.2995C13.8733 10.1267 14.1458 10.1041 14.3447 10.2462L21 15M6 21H18C19.6569 21 21 19.6569 21 18V6C21 4.34315 19.6569 3 18 3H6C4.34315 3 3 4.34315 3 6V18C3 19.6569 4.34315 21 6 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
