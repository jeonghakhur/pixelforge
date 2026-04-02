import type { SVGProps } from "react";

interface IconVideoProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconVideo = ({ size, color, className, ...props }: IconVideoProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-video", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 6.824L12.498 5.373C12.6499 5.28482 12.8224 5.23821 12.998 5.23787C13.1737 5.23753 13.3464 5.28346 13.4986 5.37105C13.6509 5.45864 13.7774 5.58479 13.8654 5.7368C13.9534 5.88882 13.9998 6.06134 14 6.237V10.168C14.0001 10.3475 13.9518 10.5238 13.8602 10.6782C13.7687 10.8327 13.6373 10.9596 13.4797 11.0458C13.3222 11.1319 13.1444 11.174 12.965 11.1677C12.7855 11.1614 12.6111 11.107 12.46 11.01L10 9.429V10.077C10 10.746 9.93 10.988 9.8 11.233C9.669 11.477 9.477 11.669 9.233 11.8C8.988 11.93 8.746 12 8.077 12H3.923C3.254 12 3.012 11.93 2.767 11.8C2.52542 11.6721 2.32787 11.4746 2.2 11.233C2.07 10.988 2 10.746 2 10.077V5.923C2 5.254 2.07 5.012 2.2 4.767C2.331 4.523 2.523 4.331 2.767 4.2C3.012 4.07 3.254 4 3.923 4H8.077C8.746 4 8.988 4.07 9.233 4.2C9.477 4.331 9.669 4.523 9.8 4.767C9.93 5.012 10 5.254 10 5.923V6.823V6.824Z"
      fill="currentColor"
     />
  </svg>
);
