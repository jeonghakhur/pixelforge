import type { SVGProps } from "react";

interface IconXlProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string;
}

export const IconXl = ({ size, color, className, ...props }: IconXlProps) => (
  <svg
    width={56}
    height={56}
    className={["icon-xl", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M0 28C0 12.536 12.536 0 28 0C43.464 0 56 12.536 56 28C56 43.464 43.464 56 28 56C12.536 56 0 43.464 0 28Z" fill="#F4EBFF"/>
<path d="M22.75 28L26.25 31.5L33.25 24.5M39.6667 28C39.6667 34.4433 34.4433 39.6666 28 39.6666C21.5567 39.6666 16.3333 34.4433 16.3333 28C16.3333 21.5567 21.5567 16.3333 28 16.3333C34.4433 16.3333 39.6667 21.5567 39.6667 28Z" stroke="#7F56D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
