import type { SVGProps } from "react";

interface IconDriveProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconDrive = ({ size, color, className, ...props }: IconDriveProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-drive", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.6759 9.28L10.2037 2H5.79629L10.2685 9.28H14.6759ZM6.50925 10.2105L4.30555 14H12.7963L15 10.2105H6.50925ZM5.21296 2.94737L1 10.2105L3.2037 14L7.48147 6.73684L5.21296 2.94737Z"
      fill="currentColor"
     />
  </svg>
);
