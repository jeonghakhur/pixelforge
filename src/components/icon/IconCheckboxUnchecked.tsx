import type { SVGProps } from "react";

interface IconCheckboxUncheckedProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconCheckboxUnchecked = ({ size, color, className, ...props }: IconCheckboxUncheckedProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-checkbox-unchecked", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 3.00948C0 1.34739 1.33663 0 3.00948 0H12.9905C14.6526 0 16 1.33663 16 3.00948V12.9905C16 14.6526 14.6634 16 12.9905 16H3.00948C1.34739 16 0 14.6634 0 12.9905V3.00948ZM1 3.00586V12.9941C1 14.1029 1.89805 15 3.00586 15H12.9941C14.1029 15 15 14.1019 15 12.9941V3.00586C15 1.89706 14.1019 1 12.9941 1H3.00586C1.89706 1 1 1.89805 1 3.00586Z"
      fill="currentColor"
     />
  </svg>
);
