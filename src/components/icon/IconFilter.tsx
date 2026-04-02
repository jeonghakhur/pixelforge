import type { SVGProps } from "react";

interface IconFilterProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconFilter = ({ size, color, className, ...props }: IconFilterProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-filter", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.50001 12.5C5.50001 11.948 5.94401 11.5 6.50001 11.5H9.50001C10.052 11.5 10.5 11.944 10.5 12.5C10.5 13.052 10.056 13.5 9.50001 13.5H6.50001C5.94801 13.5 5.50001 13.056 5.50001 12.5ZM3.50001 8.5C3.50001 7.948 3.94601 7.5 4.49801 7.5H11.502C12.053 7.5 12.5 7.944 12.5 8.5C12.5 9.052 12.054 9.5 11.502 9.5H4.49801C4.36671 9.50026 4.23665 9.47457 4.11531 9.42438C3.99398 9.37419 3.88377 9.30051 3.79102 9.20757C3.69827 9.11464 3.62481 9.00428 3.57486 8.88284C3.52492 8.76141 3.49948 8.6313 3.50001 8.5ZM1.00001 4C1.00001 3.172 1.67501 2.5 2.49801 2.5H13.502C14.329 2.5 15 3.166 15 4C15 4.828 14.325 5.5 13.502 5.5H2.49801C2.30101 5.5004 2.10587 5.46185 1.92382 5.38659C1.74176 5.31132 1.57638 5.20082 1.43717 5.06142C1.29796 4.92203 1.18768 4.7565 1.11265 4.57434C1.03763 4.39219 0.999349 4.197 1.00001 4Z"
      fill="currentColor"
     />
  </svg>
);
