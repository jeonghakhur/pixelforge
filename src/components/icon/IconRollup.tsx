import type { SVGProps } from "react";

interface IconRollupProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconRollup = ({ size, color, className, ...props }: IconRollupProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-rollup", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 14C3.791 14 2 12.209 2 10C2 7.791 3.791 6 6 6C8.209 6 10 7.791 10 10C10 12.209 8.209 14 6 14ZM10 0C13.314 0 16 2.686 16 6C16 7.232 15.629 8.376 14.992 9.328C14.229 10.47 10.6 14.052 9.586 14.81C8.586 15.557 7.345 16 6 16C2.686 16 0 13.314 0 10C0 8.617 0.468 7.343 1.255 6.329C2.008 5.358 5.39 1.962 6.394 1.205C7.397 0.449 8.646 0 10 0ZM8 10C8 8.895 7.105 8 6 8C4.895 8 4 8.895 4 10C4 11.105 4.895 12 6 12C7.105 12 8 11.105 8 10Z"
      fill="currentColor"
     />
  </svg>
);
