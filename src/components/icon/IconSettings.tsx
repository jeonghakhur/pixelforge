import type { SVGProps } from "react";

interface IconSettingsProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconSettings = ({ size, color, className, ...props }: IconSettingsProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-settings", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 2H14.0002C14.5563 2 15 2.44772 15 3C15 3.55614 14.5524 4 14.0002 4H10V2ZM10 9H1.99754C1.44631 9 1 8.55228 1 8C1 7.44386 1.44662 7 1.99754 7H10V9ZM1.99896 2H4V4H1.99896C1.44266 4 1 3.55228 1 3C1 2.44386 1.44725 2 1.99896 2ZM7 1C8.105 1 9 1.895 9 3C9 4.105 8.105 5 7 5C5.895 5 5 4.105 5 3C5 1.895 5.895 1 7 1ZM13 6C14.105 6 15 6.895 15 8C15 9.105 14.105 10 13 10C11.895 10 11 9.105 11 8C11 6.895 11.895 6 13 6ZM3 11C4.105 11 5 11.895 5 13C5 14.105 4.105 15 3 15C1.895 15 1 14.105 1 13C1 11.895 1.895 11 3 11ZM6 14V12H14.0025C14.5534 12 15 12.4439 15 13C15 13.5523 14.5537 14 14.0025 14H6Z"
      fill="currentColor"
     />
  </svg>
);
