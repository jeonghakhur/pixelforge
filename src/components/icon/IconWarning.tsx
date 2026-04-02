import type { SVGProps } from "react";

interface IconWarningProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconWarning = ({ size, color, className, ...props }: IconWarningProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-warning", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.10048 8.49463C9.10048 9.13019 8.60527 9.6502 8 9.6502C7.39473 9.6502 6.89952 9.13019 6.89952 8.49463V5.02793C6.89952 4.39237 7.39473 3.87236 8 3.87236C8.60527 3.87236 9.10048 4.39237 9.10048 5.02793V8.49463ZM8 13.1169C7.39473 13.1169 6.89952 12.5969 6.89952 11.9613C6.89952 11.3258 7.39473 10.8058 8 10.8058C8.60527 10.8058 9.10048 11.3258 9.10048 11.9613C9.10048 12.5969 8.60527 13.1169 8 13.1169ZM15.8508 13.6947L8.95302 1.14985C8.52933 0.379087 7.47067 0.379087 7.04698 1.14985L0.149158 13.6947C-0.274528 14.4654 0.254804 15.428 1.10218 15.428H14.8978C15.7452 15.428 16.2745 14.4654 15.8508 13.6947Z"
      fill="currentColor"
     />
  </svg>
);
