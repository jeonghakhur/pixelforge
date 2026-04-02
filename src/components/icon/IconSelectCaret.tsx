import type { SVGProps } from "react";

interface IconSelectCaretProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconSelectCaret = ({ size, color, className, ...props }: IconSelectCaretProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-select-caret", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.60115 7H10.3989C10.8935 7 11.1754 6.35908 10.879 5.9095L8.48019 2.27292C8.23958 1.90903 7.76043 1.90903 7.52085 2.27292L5.12097 5.9095C4.82459 6.35908 5.10651 7 5.60115 7ZM10.3989 9H5.60115C5.10651 9 4.82459 9.64092 5.12096 10.0905L7.51981 13.7271C7.76042 14.091 8.23957 14.091 8.47915 13.7271L10.879 10.0905C11.1754 9.64092 10.8935 9 10.3989 9Z"
      fill="currentColor"
     />
  </svg>
);
