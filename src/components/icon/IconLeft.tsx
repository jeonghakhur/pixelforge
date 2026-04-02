import type { SVGProps } from "react";

interface IconLeftProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconLeft = ({ size, color, className, ...props }: IconLeftProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-left", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.31993 7.40622C1.87393 7.73122 1.87993 8.26422 2.31693 8.58622L6.18693 11.4342C6.64293 11.7442 7.01293 11.5502 7.01293 10.9942V9.99422H12.0069C12.2702 9.99528 12.531 9.94431 12.7745 9.84425C13.0179 9.74419 13.2392 9.597 13.4256 9.41115C13.612 9.22531 13.7599 9.00446 13.8607 8.76129C13.9614 8.51813 14.0132 8.25745 14.0129 7.99422C14.0129 6.88922 13.1259 5.99422 12.0069 5.99422H7.01293V4.99422C7.01293 4.44222 6.65293 4.25422 6.20993 4.57422L2.31993 7.40622Z"
      fill="currentColor"
     />
  </svg>
);
