import type { SVGProps } from "react";

interface IconItalicProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconItalic = ({ size, color, className, ...props }: IconItalicProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-italic", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.2241 3.17629L8.06782 13.3113C7.95274 13.8522 7.47501 14.239 6.92196 14.239C6.17682 14.239 5.62103 13.5525 5.77609 12.8237L7.93232 2.68872C8.04741 2.14776 8.52513 1.76099 9.07819 1.76099C9.82332 1.76099 10.3791 2.44747 10.2241 3.17629Z"
      fill="currentColor"
     />
  </svg>
);
