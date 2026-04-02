import type { SVGProps } from "react";

interface IconPlusFilledProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconPlusFilled = ({ size, color, className, ...props }: IconPlusFilledProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-plus-filled", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1 3.00586C1 1.89805 1.89706 1 3.00586 1H12.9941C14.1019 1 15 1.89706 15 3.00586V12.9941C15 14.1019 14.1029 15 12.9941 15H3.00586C1.89805 15 1 14.1029 1 12.9941V3.00586ZM9 7V3.5C9 3.224 8.776 3 8.5 3H7.5C7.224 3 7 3.224 7 3.5V7H3.5C3.224 7 3 7.224 3 7.5V8.5C3 8.776 3.224 9 3.5 9H7V12.5C7 12.776 7.224 13 7.5 13H8.5C8.776 13 9 12.776 9 12.5V9H12.5C12.776 9 13 8.776 13 8.5V7.5C13 7.224 12.776 7 12.5 7H9Z"
      fill="currentColor"
     />
  </svg>
);
