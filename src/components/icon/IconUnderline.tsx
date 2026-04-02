import type { SVGProps } from "react";

interface IconUnderlineProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconUnderline = ({ size, color, className, ...props }: IconUnderlineProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-underline", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3.75 7.7001V2.2001C3.75 1.6001 4.25 1.1001 4.85 1.1001C5.45 1.1001 5.95 1.6001 5.95 2.2001V7.6001C5.95 8.2001 6.15 8.7001 6.45 9.0001C6.75 9.3001 7.25 9.5001 7.95 9.5001C8.65 9.5001 9.15 9.3001 9.45 9.0001C9.75 8.7001 9.95 8.2001 9.95 7.6001V2.2001C10.05 1.6001 10.55 1.1001 11.15 1.1001C11.75 1.1001 12.25 1.6001 12.25 2.2001V7.7001C12.25 8.8001 11.85 9.8001 11.05 10.5001C10.35 11.2001 9.25 11.6001 7.95 11.6001C6.65 11.6001 5.65 11.2001 4.85 10.5001C4.15 9.8001 3.75 8.9001 3.75 7.7001ZM4.75 12.9001H11.25C11.85 12.9001 12.25 13.3001 12.25 13.9001C12.25 14.5001 11.85 14.9001 11.25 14.9001H4.75C4.15 14.9001 3.75 14.5001 3.75 13.9001C3.75 13.3001 4.15 12.9001 4.75 12.9001Z"
      fill="currentColor"
     />
  </svg>
);
