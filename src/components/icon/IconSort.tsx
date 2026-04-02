import type { SVGProps } from "react";

interface IconSortProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconSort = ({ size, color, className, ...props }: IconSortProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-sort", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.6106 3.29146L13.8906 6.22446C14.2256 6.65446 14.0516 7.00846 13.4986 7.00846H12.0006V13.0055C12.0018 13.1373 11.9768 13.268 11.927 13.39C11.8772 13.512 11.8036 13.6229 11.7106 13.7163C11.6175 13.8096 11.5068 13.8835 11.385 13.9337C11.2631 13.9838 11.1324 14.0093 11.0006 14.0085C10.4446 14.0085 10.0006 13.5595 10.0006 13.0055V7.00846H8.50263C7.94763 7.00846 7.77263 6.65846 8.11063 6.22446L10.3906 3.29246C10.7256 2.86246 11.2736 2.85946 11.6106 3.29246V3.29146ZM5.61063 12.7075C5.27363 13.1405 4.72563 13.1375 4.39063 12.7075L2.11063 9.77546C1.77363 9.34146 1.94763 8.99146 2.50263 8.99146H4.00063V2.99446C4.00011 2.86284 4.02559 2.73243 4.07562 2.61069C4.12565 2.48896 4.19924 2.37832 4.29217 2.28511C4.38509 2.19191 4.49552 2.11799 4.6171 2.06759C4.73868 2.0172 4.86902 1.99132 5.00063 1.99146C5.55263 1.99146 6.00063 2.42946 6.00063 2.99446V8.99146H7.49863C8.05163 8.99146 8.22563 9.34446 7.89063 9.77546L5.61063 12.7075Z"
      fill="currentColor"
     />
  </svg>
);
