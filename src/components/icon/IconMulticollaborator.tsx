import type { SVGProps } from "react";

interface IconMulticollaboratorProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconMulticollaborator = ({ size, color, className, ...props }: IconMulticollaboratorProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-multicollaborator", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.233 12.3938C12.7786 12.5579 14.75 12.26 14.75 11.5C14.75 10.25 14.0833 8.41667 12.0833 8.41667C11.4332 8.41667 10.924 8.61038 10.5328 8.91479C11.0076 9.72238 11.25 10.7841 11.25 12.125C11.25 12.2166 11.2443 12.3062 11.233 12.3938ZM5.75 6.75C4.36929 6.75 3.25 5.63071 3.25 4.25C3.25 2.86929 4.36929 1.75 5.75 1.75C7.13071 1.75 8.25 2.86929 8.25 4.25C8.25 5.63071 7.13071 6.75 5.75 6.75ZM12.0833 7.75C10.9788 7.75 10.0833 6.85457 10.0833 5.75C10.0833 4.64543 10.9788 3.75 12.0833 3.75C13.1879 3.75 14.0833 4.64543 14.0833 5.75C14.0833 6.85457 13.1879 7.75 12.0833 7.75ZM5.75 7.75C8.41667 7.75 10.25 8.75 10.25 12.25C10.25 13.1955 9.25 14.25 5.75 14.25C2.25 14.25 1.25 13.3045 1.25 12.25C1.25 8.75 3.08333 7.75 5.75 7.75Z"
      fill="currentColor"
     />
  </svg>
);
