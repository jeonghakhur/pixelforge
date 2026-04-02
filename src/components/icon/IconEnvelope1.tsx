import type { SVGProps } from "react";

interface IconEnvelope1Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconEnvelope1 = ({ size, color, className, ...props }: IconEnvelope1Props) => (
  <svg
    width={16}
    height={16}
    className={["icon-envelope1", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.76622 7.07663C5.76009 7.07277 5.75389 7.06906 5.74763 7.06548L3.25725 5.57125C3.02046 5.42918 2.71333 5.50596 2.57125 5.74275C2.42918 5.97954 2.50596 6.28667 2.74275 6.42875L4.69362 7.59927L2.64645 9.64645C2.45118 9.84171 2.45118 10.1583 2.64645 10.3536C2.84171 10.5488 3.15829 10.5488 3.35355 10.3536L5.57751 8.1296L7.74275 9.42875C7.90109 9.52375 8.09891 9.52375 8.25725 9.42875L10.4225 8.1296L12.6464 10.3536C12.8417 10.5488 13.1583 10.5488 13.3536 10.3536C13.5488 10.1583 13.5488 9.84171 13.3536 9.64645L11.3064 7.59927L13.2572 6.42875C13.494 6.28667 13.5708 5.97954 13.4287 5.74275C13.2867 5.50596 12.9795 5.42918 12.7428 5.57125L10.2524 7.06548C10.2461 7.06906 10.2399 7.07277 10.2338 7.07663L8 8.4169L5.76622 7.07663H5.76622ZM1 4.4971C1 3.67027 1.67525 3 2.49825 3H13.5018C14.3292 3 15 3.67166 15 4.4971V11.5029C15 12.3297 14.3248 13 13.5018 13H2.49825C1.67079 13 1 12.3283 1 11.5029V4.4971Z"
      fill="currentColor"
     />
  </svg>
);
