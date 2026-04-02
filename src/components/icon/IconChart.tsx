import type { SVGProps } from "react";

interface IconChartProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconChart = ({ size, color, className, ...props }: IconChartProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-chart", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.5 12V11C2.5 10.6022 2.65804 10.2206 2.93934 9.93934C3.22064 9.65804 3.60218 9.5 4 9.5C4.39782 9.5 4.77936 9.65804 5.06066 9.93934C5.34196 10.2206 5.5 10.6022 5.5 11V12C5.5 12.3978 5.34196 12.7794 5.06066 13.0607C4.77936 13.342 4.39782 13.5 4 13.5C3.60218 13.5 3.22064 13.342 2.93934 13.0607C2.65804 12.7794 2.5 12.3978 2.5 12ZM6.5 12V8.5C6.5 8.10218 6.65804 7.72064 6.93934 7.43934C7.22064 7.15804 7.60218 7 8 7C8.39782 7 8.77936 7.15804 9.06066 7.43934C9.34196 7.72064 9.5 8.10218 9.5 8.5V12C9.5 12.3978 9.34196 12.7794 9.06066 13.0607C8.77936 13.342 8.39782 13.5 8 13.5C7.60218 13.5 7.22064 13.342 6.93934 13.0607C6.65804 12.7794 6.5 12.3978 6.5 12ZM10.5 12V4C10.5 3.60218 10.658 3.22064 10.9393 2.93934C11.2206 2.65804 11.6022 2.5 12 2.5C12.3978 2.5 12.7794 2.65804 13.0607 2.93934C13.342 3.22064 13.5 3.60218 13.5 4V12C13.5 12.3978 13.342 12.7794 13.0607 13.0607C12.7794 13.342 12.3978 13.5 12 13.5C11.6022 13.5 11.2206 13.342 10.9393 13.0607C10.658 12.7794 10.5 12.3978 10.5 12Z"
      fill="currentColor"
     />
  </svg>
);
