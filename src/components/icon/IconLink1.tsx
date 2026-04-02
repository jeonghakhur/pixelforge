import type { SVGProps } from "react";

interface IconLink1Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconLink1 = ({ size, color, className, ...props }: IconLink1Props) => (
  <svg
    width={16}
    height={16}
    className={["icon-link1", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.5 8.99903V9.5C4.5 9.899 4.945 10.138 5.277 9.916L7.18301 8.57487C7.63422 8.25738 7.63276 7.7416 7.18301 7.42514L5.277 6.084C4.945 5.862 4.5 6.101 4.5 6.5V7.00098H1.4979C0.950942 7.00098 0.5 7.44826 0.5 8C0.5 8.5556 0.946774 8.99903 1.4979 8.99903H4.5ZM8.5 7.99806C8.5 7.44631 8.93788 6.99903 9.50293 6.99903H14.4971C15.051 6.99903 15.5 7.44246 15.5 7.99806C15.5 8.5498 15.0621 8.99708 14.4971 8.99708H9.50293C8.94903 8.99708 8.5 8.55365 8.5 7.99806ZM2.5 13C2.5 12.4483 2.94749 12.001 3.4985 12.001H14.5015C15.053 12.001 15.5 12.4444 15.5 13C15.5 13.5518 15.0525 13.999 14.5015 13.999H3.4985C2.94704 13.999 2.5 13.5556 2.5 13ZM2.5 3C2.5 2.44826 2.94749 2.00098 3.4985 2.00098H14.5015C15.053 2.00098 15.5 2.44441 15.5 3C15.5 3.55175 15.0525 3.99903 14.5015 3.99903H3.4985C2.94704 3.99903 2.5 3.5556 2.5 3Z"
      fill="currentColor"
     />
  </svg>
);
