import type { SVGProps } from "react";

interface IconDuplicateProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconDuplicate = ({ size, color, className, ...props }: IconDuplicateProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-duplicate", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5 3.99739C5 2.89426 5.89586 2 6.99739 2H12.0026C13.1057 2 14 2.89586 14 3.99739V9.00261C14 10.1057 13.1041 11 12.0026 11H6.99739C5.89426 11 5 10.1041 5 9.00261V3.99739ZM2 12.0026V5.99754C2 5.44631 2.44772 5 3 5C3.55614 5 4 5.44903 4 6.00293V10.4983C4 11.3288 4.67232 12 5.50168 12H9.99707C10.5621 12 11 12.4477 11 13C11 13.5561 10.5534 14 10.0025 14H3.99739C2.89586 14 2 13.1057 2 12.0026Z"
      fill="currentColor"
     />
  </svg>
);
