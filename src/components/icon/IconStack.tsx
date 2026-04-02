import type { SVGProps } from "react";

interface IconStackProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconStack = ({ size, color, className, ...props }: IconStackProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-stack", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 10V9H13V10H12V11H13V12H14V11H15V10H14ZM1 1.99558C1 1.44574 1.44335 1 2.00937 1H3.99063C4.54809 1 5 1.44484 5 1.99558V11.0044C5 11.5543 4.55665 12 3.99063 12H2.00937C1.45191 12 1 11.5552 1 11.0044V1.99558ZM6 2.00685C6 1.45078 6.44335 1 7.00937 1H8.99063C9.54809 1 10 1.44995 10 2.00685V13.9932C10 14.5492 9.55665 15 8.99063 15H7.00937C6.45191 15 6 14.5501 6 13.9932V2.00685ZM11 2.00293C11 1.44903 11.4434 1 12.0094 1H13.9906C14.5481 1 15 1.43788 15 2.00293V6.99707C15 7.55097 14.5566 8 13.9906 8H12.0094C11.4519 8 11 7.56212 11 6.99707V2.00293Z"
      fill="currentColor"
     />
  </svg>
);
