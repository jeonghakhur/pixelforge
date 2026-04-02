import type { SVGProps } from "react";

interface IconPauseProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconPause = ({ size, color, className, ...props }: IconPauseProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-pause", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 3.496C2.00106 3.09887 2.15956 2.71836 2.44075 2.43792C2.72194 2.15748 3.10287 2 3.5 2H5.5C6.328 2 7 2.68 7 3.496V12.504C6.99894 12.9011 6.84044 13.2816 6.55925 13.5621C6.27806 13.8425 5.89713 14 5.5 14H3.5C2.672 14 2 13.32 2 12.504V3.496ZM9 3.496C9.00106 3.09887 9.15956 2.71836 9.44075 2.43792C9.72194 2.15748 10.1029 2 10.5 2H12.5C13.328 2 14 2.68 14 3.496V12.504C13.9989 12.9011 13.8404 13.2816 13.5592 13.5621C13.2781 13.8425 12.8971 14 12.5 14H10.5C9.672 14 9 13.32 9 12.504V3.496Z"
      fill="currentColor"
     />
  </svg>
);
