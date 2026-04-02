import type { SVGProps } from "react";

interface IconPhoneProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconPhone = ({ size, color, className, ...props }: IconPhoneProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-phone", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.06126 3.01991C6.33426 3.29291 6.33426 3.73491 6.06126 4.00791L5.07226 4.99591C4.79926 5.26891 4.92526 5.62791 5.07226 5.98391C5.42226 6.82791 6.18426 7.67291 7.25526 8.74391C8.44926 9.93891 9.17026 10.4949 10.0143 10.9279C10.3583 11.1039 10.7303 11.2009 11.0023 10.9279L11.9913 9.94091C12.2643 9.66791 12.7063 9.66791 12.9793 9.94091L14.9563 11.9189C15.2293 12.1919 15.2293 12.6339 14.9563 12.9069L12.9043 14.9579C12.6623 15.1999 12.2813 15.2309 12.0033 15.0319C12.0033 15.0319 7.97526 13.8319 5.07226 10.9279C2.04526 7.89991 0.969256 3.99291 0.969256 3.99291C0.770256 3.71491 0.802256 3.33391 1.04326 3.09291L3.09626 1.04191C3.36926 0.768908 3.81126 0.768908 4.08426 1.04191L6.06126 3.01991Z"
      fill="currentColor"
     />
  </svg>
);
