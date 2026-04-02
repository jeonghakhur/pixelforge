import type { SVGProps } from "react";

interface IconPersonalProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconPersonal = ({ size, color, className, ...props }: IconPersonalProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-personal", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.07 6.38061C6.55735 6.38061 5.33111 5.15437 5.33111 3.64172C5.33111 2.12907 6.55735 0.902832 8.07 0.902832C9.58265 0.902832 10.8089 2.12907 10.8089 3.64172C10.8089 5.15437 9.58265 6.38061 8.07 6.38061ZM8.07 7.47617C10.9915 7.47617 13.5 9.09728 13.5 12.4062C13.5 13.442 11.9044 15.0973 8.07 15.0973C4.23556 15.0973 2.5 13.5614 2.5 12.4062C2.5 9.09728 5.14852 7.47617 8.07 7.47617Z"
      fill="currentColor"
     />
  </svg>
);
