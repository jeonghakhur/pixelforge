import type { SVGProps } from "react";

interface IconBoltProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconBolt = ({ size, color, className, ...props }: IconBoltProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-bolt", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.85354 1.50567C8.92053 0.678033 8.60041 0.570089 8.14256 1.25851L3.54156 8.17653C3.23648 8.63524 3.4371 9.0071 3.98787 9.0071H6.49047C7.04204 9.0071 7.45789 9.44498 7.41753 10.01L7.09643 14.5054C7.03719 15.3348 7.33769 15.4262 7.76128 14.7202L12.4776 6.85969C12.7601 6.38882 12.5412 6.0071 11.9905 6.0071H9.48786C8.9363 6.0071 8.52567 5.55612 8.56937 5.01632L8.85354 1.50567Z"
      fill="currentColor"
     />
  </svg>
);
