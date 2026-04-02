import type { SVGProps } from "react";

interface IconMarkdownProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconMarkdown = ({ size, color, className, ...props }: IconMarkdownProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-markdown", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 4.14713C0 3.51359 0.514227 3 1.15068 3H14.8493C15.4848 3 16 3.50965 16 4.14713V11.8529C16 12.4864 15.4858 13 14.8493 13H1.15068C0.515177 13 0 12.4904 0 11.8529V4.14713ZM2.30769 10.6562H3.84615V7.60938L5.38462 9.5625L6.92308 7.60938V10.6562H8.46154V5.34375H6.92308L5.38462 7.29688L3.84615 5.34375H2.30769V10.6562ZM11.9231 10.6562L14.2308 8.07812H12.6923V5.34375H11.1538V8.07812H9.61539L11.9231 10.6562Z"
      fill="currentColor"
     />
  </svg>
);
