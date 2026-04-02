import type { SVGProps } from "react";

interface IconCaretProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconCaret = ({ size, color, className, ...props }: IconCaretProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-caret", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.80153 5H11.1985C11.858 5 12.2339 5.7691 11.8387 6.3086L8.64024 10.6725C8.31943 11.1091 7.68057 11.1091 7.36113 10.6725L4.16129 6.3086C3.76613 5.7691 4.14201 5 4.80153 5Z"
      fill="currentColor"
     />
  </svg>
);
