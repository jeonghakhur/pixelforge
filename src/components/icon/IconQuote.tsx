import type { SVGProps } from "react";

interface IconQuoteProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconQuote = ({ size, color, className, ...props }: IconQuoteProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-quote", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7 8.5001V5.49981C7 4.94372 6.55237 4.5 6.00019 4.5H2.99981C2.44372 4.5 2 4.94763 2 5.49981V8.50019C2 9.05628 2.44763 9.5 2.99981 9.5H4V11.5H5L7 9.5V8.5001ZM14 8.5001V5.49981C14 4.94372 13.5524 4.5 13.0002 4.5H9.99981C9.44372 4.5 9 4.94763 9 5.49981V8.50019C9 9.05628 9.44763 9.5 9.99981 9.5H11V11.5H12L14 9.5V8.5001Z"
      fill="currentColor"
     />
  </svg>
);
