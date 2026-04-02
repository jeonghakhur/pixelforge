import type { SVGProps } from "react";

interface IconIndentProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconIndent = ({ size, color, className, ...props }: IconIndentProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-indent", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 7.4873C1 6.9873 1.4 6.4873 2 6.4873H14C14.5 6.4873 15 6.8873 15 7.4873C15 7.9873 14.6 8.4873 14 8.4873H2C1.5 8.4873 1 8.0873 1 7.4873ZM2 1.4873C1.5 1.4873 1 1.8873 1 2.4873C1 2.9873 1.4 3.4873 2 3.4873H14C14.5 3.4873 15 3.0873 15 2.4873C15 1.9873 14.6 1.4873 14 1.4873H2ZM4.9 13.9873V13.4873H2C1.5 13.4873 1 13.0873 1 12.4873C1 11.9873 1.4 11.4873 2 11.4873H4.9V11.1873C4.9 10.7873 5.3 10.5873 5.7 10.7873L7.6 12.0873C8 12.3873 8 12.8873 7.6 13.1873L5.7 14.4873C5.3 14.5873 4.9 14.3873 4.9 13.9873ZM9.8 11.5873C9.3 11.5873 8.8 11.9873 8.8 12.5873C8.8 13.0873 9.2 13.5873 9.8 13.5873H14C14.5 13.5873 15 13.1873 15 12.5873C15 12.0873 14.6 11.5873 14 11.5873H9.8Z"
      fill="currentColor"
     />
  </svg>
);
