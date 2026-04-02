import type { SVGProps } from "react";

interface IconFileProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconFile = ({ size, color, className, ...props }: IconFileProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-file", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.291 6H8.998C8.723 6 8.5 5.777 8.5 5.502V3.213C8.5 2.766 9.041 2.541 9.358 2.858L11.645 5.145C11.961 5.461 11.737 6 11.291 6ZM10.2059 1.70591C9.81605 1.31605 9.06212 1 8.49707 1H4.50592C3.39808 1 2.5 1.89706 2.5 3.00586V12.9941C2.5 14.1019 3.40018 15 4.49202 15H11.508C12.6081 15 13.5 14.1126 13.5 13.0004V5.9954C13.5 5.44565 13.1861 4.68613 12.7941 4.29409L10.2059 1.70591Z"
      fill="currentColor"
     />
  </svg>
);
