import type { SVGProps } from "react";

interface IconCursorProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconCursor = ({ size, color, className, ...props }: IconCursorProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-cursor", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.2069 7.25983C12.8239 6.84583 12.7959 6.21983 12.1279 5.87083L4.44095 1.86083C3.77495 1.51383 3.28795 1.83783 3.35595 2.58783L4.14595 11.2218C4.21495 11.9698 4.77595 12.2408 5.40095 11.8218L6.98095 10.7618L7.01795 10.8018L9.96895 13.8848C10.1762 14.1016 10.4533 14.2383 10.7515 14.2709C11.0497 14.3035 11.3498 14.2298 11.5989 14.0628L11.9239 13.8448C12.4379 13.4998 12.6299 12.8348 12.3789 12.2698L10.6479 8.36783C10.6405 8.35172 10.6328 8.33572 10.6249 8.31983L12.2069 7.25983Z"
      fill="currentColor"
     />
  </svg>
);
