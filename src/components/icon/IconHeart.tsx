import type { SVGProps } from "react";

interface IconHeartProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconHeart = ({ size, color, className, ...props }: IconHeartProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-heart", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.29589 13.9849C7.68479 14.3786 8.3161 14.3805 8.7031 13.9863C8.7031 13.9863 10.9003 11.8268 13 9.19988C15 6.69773 15.5 3.69773 13 2.19773C10.5032 0.699637 8.00005 3.19773 8.00005 3.19773C8.00005 3.19773 5.49778 0.699088 3.00005 2.19773C0.50005 3.69773 1.00005 6.69773 3.00005 9.19988C5.09407 11.8197 7.29589 13.9849 7.29589 13.9849Z"
      fill="currentColor"
     />
  </svg>
);
