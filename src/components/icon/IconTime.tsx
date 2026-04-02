import type { SVGProps } from "react";

interface IconTimeProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconTime = ({ size, color, className, ...props }: IconTimeProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-time", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 0C12.418 0 16 3.582 16 8C16 12.418 12.418 16 8 16C3.582 16 0 12.418 0 8C0 3.582 3.582 0 8 0ZM8 2C4.692 2 2 4.692 2 8C2 11.308 4.692 14 8 14C11.308 14 14 11.308 14 8C14 4.692 11.308 2 8 2ZM11.0094 6.81394C11.1869 6.80172 11.3902 6.821 11.5909 6.89933C11.998 7.05825 12.25 7.41594 12.25 7.9707C12.25 8.71906 11.9405 9.10504 11.4133 9.19533C11.2969 9.21528 11.2062 9.21916 11.0317 9.21875C11.0154 9.21871 11.0154 9.21871 11 9.2187H8.0298C7.34062 9.2187 6.7808 8.65966 6.78081 7.97264L6.75 4C6.75 3.19577 7.03111 2.75 8.0298 2.75C8.77893 2.75 9.15546 3.06067 9.23325 3.5914C9.24888 3.69805 9.25158 3.78155 9.25031 3.94284C9.25008 3.97279 9.25008 3.97279 9.25 4V6.8157H10.9877C10.9925 6.8153 10.9991 6.81476 11.0094 6.81394Z"
      fill="currentColor"
     />
  </svg>
);
