import type { SVGProps } from "react";

interface IconPublishProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconPublish = ({ size, color, className, ...props }: IconPublishProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-publish", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.4001 3.03325C10.6471 3.36325 10.4121 3.83325 10.0001 3.83325H9.0001V10.3332C9.0001 10.6082 8.7751 10.8332 8.5001 10.8332H7.5001C7.2251 10.8332 7.0001 10.6082 7.0001 10.3332V3.83325H6.0001C5.5881 3.83325 5.3531 3.36325 5.6001 3.03325L7.6001 0.366248C7.8001 0.100248 8.2001 0.100248 8.4001 0.366248L10.4001 3.03325ZM7.919 15.8332C7.725 15.8332 7.531 15.7762 7.364 15.6652L0.445 11.6652C0.167 11.4792 0 11.1672 0 10.8332V5.83325C0 5.47525 0.192 5.14325 0.504 4.96525L2.497 3.82625C2.977 3.55125 3.588 3.71925 3.861 4.19825C4.135 4.67825 3.968 5.28825 3.489 5.56225L2 6.41325V10.2982L7.962 13.6602L14 10.2492V6.41325L12.423 5.51225C11.943 5.23725 11.777 4.62725 12.051 4.14725C12.325 3.66825 12.937 3.50025 13.415 3.77525L15.496 4.96525C15.808 5.14325 16 5.47525 16 5.83325V10.8332C16 11.1932 15.806 11.5262 15.492 11.7042L8.411 15.7042C8.258 15.7902 8.088 15.8332 7.919 15.8332Z"
      fill="currentColor"
     />
  </svg>
);
