import type { SVGProps } from "react";

interface IconShowProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconShow = ({ size, color, className, ...props }: IconShowProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-show", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.24383 8.65832C0.832937 8.29474 0.821607 7.70159 1.24383 7.34168C1.24383 7.34168 4.00158 4.5 8.00158 4.5C12.0016 4.5 14.7565 7.34168 14.7565 7.34168C15.167 7.70526 15.1784 8.29841 14.7565 8.65832C14.7565 8.65832 12.0016 11.5 8.00158 11.5C4.00158 11.5 1.24383 8.65832 1.24383 8.65832ZM7.99984 9.5C7.17142 9.5 6.49984 8.82843 6.49984 8C6.49984 7.17157 7.17142 6.5 7.99984 6.5C8.82827 6.5 9.49984 7.17157 9.49984 8C9.49984 8.82843 8.82827 9.5 7.99984 9.5ZM7.99984 10.5C9.38056 10.5 10.4998 9.38071 10.4998 8C10.4998 6.61929 9.38056 5.5 7.99984 5.5C6.61913 5.5 5.49984 6.61929 5.49984 8C5.49984 9.38071 6.61913 10.5 7.99984 10.5Z"
      fill="currentColor"
     />
  </svg>
);
