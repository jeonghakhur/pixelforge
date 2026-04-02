import type { SVGProps } from "react";

interface IconEnvelopeProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconEnvelope = ({ size, color, className, ...props }: IconEnvelopeProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-envelope", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1 11.5005V8.28698C1 7.74072 1.39692 7.50311 1.88655 7.76241L7.11345 10.5305C7.60359 10.7901 8.39692 10.7898 8.88655 10.5305L14.1134 7.76241C14.6036 7.50283 15 7.73797 15 8.287V11.5005C15 12.3229 14.3292 13 13.5018 13L2.49825 12.9999C1.67525 12.9999 1 12.3286 1 11.5005ZM1 5.5V4.49756C1 3.66995 1.67079 3 2.49825 3H13.5018C14.3248 3 15 3.67048 15 4.49756V5.5L8.88655 8.55672C8.39641 8.8018 7.60308 8.80154 7.11345 8.55672L1 5.5Z"
      fill="currentColor"
     />
  </svg>
);
