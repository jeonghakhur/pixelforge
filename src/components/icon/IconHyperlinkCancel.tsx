import type { SVGProps } from "react";

interface IconHyperlinkCancelProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconHyperlinkCancel = ({ size, color, className, ...props }: IconHyperlinkCancelProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-hyperlink-cancel", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 10.0163C4 9.5163 3.5 9.0163 3 9.0163C2.4 9.0163 2 8.6163 2 8.0163V6.0163C2 5.4163 2.4 5.0163 3 5.0163H6.7C7.4 5.0163 8 4.4163 8 3.8163C8 3.1163 7.4 2.5163 6.7 2.5163H2C0.9 2.5163 0 3.4163 0 4.5163V9.0163C0 10.1163 0.9 11.0163 2 11.0163H3C3.5 11.0163 4 10.6163 4 10.0163ZM4.6 13.3163C4.1 13.0163 3.9 12.3163 4.2 11.7163L9.7 3.0163C10 2.5163 10.7 2.3163 11.3 2.6163C11.8 2.9163 12 3.6163 11.7 4.2163L6.2 12.9163C5.9 13.5163 5.2 13.7163 4.6 13.3163ZM14 5.0163H13C12.4 5.0163 12 5.4163 12 6.0163C12 6.6163 12.4 7.0163 13 7.0163C13.6 7.0163 14 7.4163 14 8.0163V10.0163C14 10.6163 13.6 11.0163 13 11.0163H9.3C8.6 11.0163 8 11.6163 8 12.2163C8 12.8163 8.6 13.5163 9.3 13.5163H14C15.1 13.5163 16 12.6163 16 11.5163V7.0163C16 5.9163 15.1 5.0163 14 5.0163Z"
      fill="currentColor"
     />
  </svg>
);
