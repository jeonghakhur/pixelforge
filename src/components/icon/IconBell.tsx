import type { SVGProps } from "react";

interface IconBellProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconBell = ({ size, color, className, ...props }: IconBellProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-bell", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13 8L13.2946 8.29462C13.6836 8.68359 14 9.44725 14 9.99896V11.001C14 11.5573 13.5512 12 12.9975 12H3.00247C2.45576 12 2 11.5528 2 11.001V9.99896C2 9.44266 2.31581 8.68419 2.70538 8.29462L3 8V6.984C3 4.559 4.728 2.555 7.02 2.099C7.017 2.065 7 2.035 7 2C7 1.45 7.45 1 8 1C8.55 1 9 1.45 9 2C9 2.035 8.983 2.065 8.98 2.099C11.272 2.555 13 4.574 13 7V8ZM10 13C10 14.104 9.105 15 8 15C6.895 15 6 14.104 6 13H10Z"
      fill="currentColor"
     />
  </svg>
);
