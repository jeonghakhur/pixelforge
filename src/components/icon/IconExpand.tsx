import type { SVGProps } from "react";

interface IconExpandProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconExpand = ({ size, color, className, ...props }: IconExpandProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-expand", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.73858 13.6512L2.77786 14.0741C2.21751 14.1542 1.8425 13.7695 1.92134 13.2176L2.3443 10.2569C2.42295 9.70639 2.80228 9.58371 3.1928 9.97424L3.89991 10.6813L5.79821 8.78305C6.19142 8.38983 6.82176 8.39266 7.21229 8.78318C7.60553 9.17643 7.60287 9.80681 7.21242 10.1973L5.31412 12.0956L6.02123 12.8027C6.41448 13.1959 6.28521 13.5731 5.73858 13.6512ZM10.2612 2.34878L13.222 1.92582C13.7823 1.84577 14.1573 2.23046 14.0785 2.78234L13.6555 5.74306C13.5769 6.29356 13.1975 6.41623 12.807 6.02571L12.0999 5.3186L10.1926 7.22596C9.79934 7.61918 9.169 7.61635 8.77848 7.22583C8.38523 6.83258 8.38789 6.2022 8.77834 5.81175L10.6857 3.90439L9.9786 3.19728C9.58535 2.80404 9.71462 2.42687 10.2612 2.34878Z"
      fill="currentColor"
     />
  </svg>
);
