import type { SVGProps } from "react";

interface IconLockProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconLock = ({ size, color, className, ...props }: IconLockProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-lock", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.2857 7.125V5.22888C12.2857 2.8935 10.2877 1 8 1C5.71229 1 3.71429 2.8935 3.71429 5.22888V7.125H2.85714C2.384 7.125 2 7.51613 2 8V14.125C2 14.608 2.384 15 2.85714 15H13.1429C13.616 15 14 14.608 14 14.125V8C14 7.51613 13.616 7.125 13.1429 7.125H12.2857ZM6.28571 5.40708C6.28571 4.42417 7.13343 3.625 8 3.625C8.86657 3.625 9.71429 4.42417 9.71429 5.40708V7.125H6.28571V5.40708Z"
      fill="currentColor"
     />
  </svg>
);
