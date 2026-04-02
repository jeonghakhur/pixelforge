import type { SVGProps } from "react";

interface IconShare1Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconShare1 = ({ size, color, className, ...props }: IconShare1Props) => (
  <svg
    width={16}
    height={16}
    className={["icon-share1", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.01263 12.0355C4.0187 12.0355 4.02075 12.0349 4.02137 12.0355H4.01263ZM11.9787 9.5355C11.9787 8.98321 12.4264 8.5355 12.9787 8.5355C13.531 8.5355 13.9787 8.98321 13.9787 9.5355V12.0419C13.9787 13.1321 13.0855 14.0355 11.9876 14.0355H4.01263C2.92006 14.0355 2.02148 13.1393 2.02148 12.0401V4.03089C2.02148 2.93567 2.92065 2.0355 4.02267 2.0355H5.97873C6.53101 2.0355 6.97873 2.48321 6.97873 3.0355C6.97873 3.58778 6.53101 4.0355 5.97873 4.0355C5.97873 4.0355 4.02148 4.03974 4.02148 4.03089C4.02148 4.03089 4.02142 12.0355 4.02137 12.0355C4.02137 12.0355 11.9795 12.0348 11.9787 12.0419V9.5355ZM11.3689 6.03096L8.83499 8.56488C8.36863 9.03125 7.61568 9.03443 7.14598 8.56472C6.67952 8.09827 6.67615 7.34537 7.14581 6.87571L9.67974 4.34178L8.82736 3.4894C8.37145 3.03349 8.51985 2.57699 9.17276 2.48372L12.7205 1.9769C13.378 1.88297 13.8271 2.3373 13.7338 2.99021L13.227 6.53794C13.133 7.19547 12.6834 7.34548 12.2213 6.88333L11.3689 6.03096Z"
      fill="currentColor"
     />
  </svg>
);
