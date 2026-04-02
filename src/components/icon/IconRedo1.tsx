import type { SVGProps } from "react";

interface IconRedo1Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconRedo1 = ({ size, color, className, ...props }: IconRedo1Props) => (
  <svg
    width={16}
    height={16}
    className={["icon-redo1", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.26 8.25771H14C14.411 8.25771 14.646 8.89471 14.4 9.22371L12.4 11.9737C12.2 12.2407 11.8 12.2827 11.6 12.0157L9.6 9.20271C9.352 8.87371 9.587 8.25771 10 8.25771H10.88C10.247 7.25771 9.11 6.09071 7.5 6.09071C5.294 6.09071 2.54 7.88571 2.54 10.0907C2.54 10.9377 1.5 10.9077 1.5 10.1727C1.5 6.86371 4.191 3.80371 7.5 3.80371C10.23 3.80371 12.796 5.31671 13.26 8.25771Z"
      fill="currentColor"
     />
  </svg>
);
