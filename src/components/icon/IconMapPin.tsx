import type { SVGProps } from "react";

interface IconMapPinProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconMapPin = ({ size, color, className, ...props }: IconMapPinProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-map-pin", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.403 14.1269C8.35655 14.1902 8.29587 14.2416 8.22585 14.2771C8.15584 14.3125 8.07847 14.331 8 14.331C7.92153 14.331 7.84416 14.3125 7.77414 14.2771C7.70413 14.2416 7.64345 14.1902 7.597 14.1269C4.866 10.4119 3.5 7.75895 3.5 6.16895C3.5 3.66895 5.5 1.66895 8 1.66895C10.5 1.66895 12.5 3.66895 12.5 6.16895C12.5 7.75895 11.134 10.4119 8.403 14.1269ZM8 8.16895C8.53043 8.16895 9.03914 7.95823 9.41421 7.58316C9.78929 7.20809 10 6.69938 10 6.16895C10 5.63851 9.78929 5.1298 9.41421 4.75473C9.03914 4.37966 8.53043 4.16895 8 4.16895C7.46957 4.16895 6.96086 4.37966 6.58579 4.75473C6.21071 5.1298 6 5.63851 6 6.16895C6 6.69938 6.21071 7.20809 6.58579 7.58316C6.96086 7.95823 7.46957 8.16895 8 8.16895Z"
      fill="currentColor"
     />
  </svg>
);
