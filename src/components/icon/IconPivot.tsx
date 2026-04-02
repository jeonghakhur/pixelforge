import type { SVGProps } from "react";

interface IconPivotProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconPivot = ({ size, color, className, ...props }: IconPivotProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-pivot", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.733 8.025H13.507C14.057 8.025 14.25 7.664 13.933 7.213L12.613 5.337C12.299 4.889 11.789 4.887 11.472 5.337L10.15 7.213C9.834 7.662 10.033 8.025 10.575 8.025H11.229C11.079 9.911 10.071 10.797 7.999 10.802V10C7.999 9.448 7.638 9.258 7.187 9.58L5.311 10.92C4.862 11.24 4.861 11.758 5.311 12.08L7.187 13.42C7.636 13.74 7.999 13.556 7.999 13V12.298C10.895 12.274 12.551 10.805 12.732 8.025H12.733ZM2 4H3C3.26522 4 3.51957 4.10536 3.70711 4.29289C3.89464 4.48043 4 4.73478 4 5V14C4 14.2652 3.89464 14.5196 3.70711 14.7071C3.51957 14.8946 3.26522 15 3 15H2C1.73478 15 1.48043 14.8946 1.29289 14.7071C1.10536 14.5196 1 14.2652 1 14V5C1 4.73478 1.10536 4.48043 1.29289 4.29289C1.48043 4.10536 1.73478 4 2 4ZM5 1H14C14.2652 1 14.5196 1.10536 14.7071 1.29289C14.8946 1.48043 15 1.73478 15 2V3C15 3.26522 14.8946 3.51957 14.7071 3.70711C14.5196 3.89464 14.2652 4 14 4H5C4.73478 4 4.48043 3.89464 4.29289 3.70711C4.10536 3.51957 4 3.26522 4 3V2C4 1.73478 4.10536 1.48043 4.29289 1.29289C4.48043 1.10536 4.73478 1 5 1Z"
      fill="currentColor"
     />
  </svg>
);
