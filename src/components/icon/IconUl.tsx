import type { SVGProps } from "react";

interface IconUlProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconUl = ({ size, color, className, ...props }: IconUlProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-ul", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.44043 3C6.44043 2.44772 6.89684 2 7.44488 2H13.4955C14.0503 2 14.5 2.44386 14.5 3C14.5 3.55228 14.0436 4 13.4955 4H7.44488C6.89014 4 6.44043 3.55614 6.44043 3ZM6.44043 8C6.44043 7.44772 6.89684 7 7.44488 7H13.4955C14.0503 7 14.5 7.44386 14.5 8C14.5 8.55228 14.0436 9 13.4955 9H7.44488C6.89014 9 6.44043 8.55614 6.44043 8ZM6.44043 13C6.44043 12.4477 6.89684 12 7.44488 12H13.4955C14.0503 12 14.5 12.4439 14.5 13C14.5 13.5523 14.0436 14 13.4955 14H7.44488C6.89014 14 6.44043 13.5561 6.44043 13ZM3.5 5C2.39543 5 1.5 4.10457 1.5 3C1.5 1.89543 2.39543 1 3.5 1C4.60457 1 5.5 1.89543 5.5 3C5.5 4.10457 4.60457 5 3.5 5ZM3.5 10C2.39543 10 1.5 9.10457 1.5 8C1.5 6.89543 2.39543 6 3.5 6C4.60457 6 5.5 6.89543 5.5 8C5.5 9.10457 4.60457 10 3.5 10ZM3.5 15C2.39543 15 1.5 14.1046 1.5 13C1.5 11.8954 2.39543 11 3.5 11C4.60457 11 5.5 11.8954 5.5 13C5.5 14.1046 4.60457 15 3.5 15Z"
      fill="currentColor"
     />
  </svg>
);
