import type { SVGProps } from "react";

interface IconUndoProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconUndo = ({ size, color, className, ...props }: IconUndoProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-undo", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.7402 8.25771H2.0002C1.5892 8.25771 1.3542 8.89471 1.6002 9.22371L3.6002 11.9737C3.8002 12.2407 4.2002 12.2827 4.4002 12.0157L6.4002 9.20271C6.6482 8.87371 6.4132 8.25771 6.0002 8.25771H5.1202C5.7532 7.25771 6.8902 6.09071 8.5002 6.09071C10.7062 6.09071 13.4602 7.88571 13.4602 10.0907C13.4602 10.9377 14.5002 10.9077 14.5002 10.1727C14.5002 6.86371 11.8092 3.80371 8.5002 3.80371C5.7702 3.80371 3.2042 5.31671 2.7402 8.25771Z"
      fill="currentColor"
     />
  </svg>
);
