import type { SVGProps } from "react";

interface IconDownloadProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconDownload = ({ size, color, className, ...props }: IconDownloadProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-download", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 0C12.418 0 16 3.582 16 8C16 12.418 12.418 16 8 16C3.582 16 0 12.418 0 8C0 3.582 3.582 0 8 0ZM8 2C4.692 2 2 4.692 2 8C2 11.308 4.692 14 8 14C11.308 14 14 11.308 14 8C14 4.692 11.308 2 8 2ZM11 9.5C8.99395 12 8.33753 12.6425 8.33753 12.6425C8.15366 12.8402 7.84882 12.8399 7.66177 12.6425C7.66177 12.6425 7 12 5 9.5C4.53502 8.91877 4.5 8.5 5.5 8.5H6.5V5C6.5 4.44391 7.0009 3.5 8.00045 3.5C9 3.5 9.5 4.44782 9.5 5V8.5H10.5C11.5 8.5 11.4674 8.91746 11 9.5Z"
      fill="currentColor"
     />
  </svg>
);
