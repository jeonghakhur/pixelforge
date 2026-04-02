import type { SVGProps } from "react";

interface IconAndroidProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconAndroid = ({ size, color, className, ...props }: IconAndroidProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-android", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9 12H7V14.0002C7 14.5524 6.55614 15 6 15C5.44772 15 5 14.5464 5 14.0006V13.3952C5 13.0104 5 12.463 5 11.976L4.99703 12C4.44639 12 4 11.549 4 11.0092V6H12V11.0092C12 11.5564 11.547 12 11.003 12H11V14.0002C11 14.5524 10.5561 15 10 15C9.44771 15 9 14.5464 9 14.0006V13.3952C9 13.0104 9 12.463 9 11.976V12ZM13 9.39519C13 8.84323 13 7.95636 13 7.39364V7.00215C13 6.44868 13.4439 6 14 6C14.5523 6 15 6.44372 15 6.99981V10.0002C15 10.5524 14.5561 11 14 11C13.4477 11 13 10.5464 13 10.0006V9.39519ZM12 4.95308H4C4 2.76985 5.79086 1 8 1C10.2091 1 12 2.76985 12 4.95308ZM1 9.39519C1 8.84323 1 7.95636 1 7.39364V7.00215C1 6.44868 1.44386 6 2 6C2.55228 6 3 6.44372 3 6.99981V10.0002C3 10.5524 2.55614 11 2 11C1.44772 11 1 10.5464 1 10.0006V9.39519Z"
      fill="currentColor"
     />
  </svg>
);
