import type { SVGProps } from "react";

interface IconSearchProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconSearch = ({ size, color, className, ...props }: IconSearchProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-search", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.64824 10.2968C4.63324 10.2968 3.00024 8.66376 3.00024 6.64876C3.00024 4.63376 4.63324 2.99976 6.64824 2.99976C8.66324 2.99976 10.2962 4.63376 10.2962 6.64876C10.2962 8.66376 8.66324 10.2968 6.64824 10.2968ZM14.7072 12.6428L11.5992 9.70676C11.5552 9.66276 11.4992 9.64176 11.4502 9.60776C11.9832 8.74576 12.2962 7.73376 12.2962 6.64876C12.2962 3.53376 9.76324 0.999756 6.64824 0.999756C3.53324 0.999756 1.00024 3.53376 1.00024 6.64876C1.00024 9.76276 3.53324 12.2968 6.64824 12.2968C7.64924 12.2968 8.58824 12.0328 9.40424 11.5738C9.44524 11.6408 9.47624 11.7128 9.53524 11.7708L12.6432 14.7068C13.0332 15.0978 13.6662 15.0978 14.0572 14.7068L14.7072 14.0568C15.0972 13.6668 15.0972 13.0338 14.7072 12.6428Z"
      fill="currentColor"
     />
  </svg>
);
