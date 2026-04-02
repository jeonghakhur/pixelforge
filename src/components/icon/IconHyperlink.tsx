import type { SVGProps } from "react";

interface IconHyperlinkProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconHyperlink = ({ size, color, className, ...props }: IconHyperlinkProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-hyperlink", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 9C3.55 9 4 9.45003 4 10C4 10.55 3.55 11 3 11L2.00104 11C0.900099 11 0 10.1078 0 9.00713V4.49287C0 3.39358 0.891856 2.5 1.99202 2.5H9.00798C10.0998 2.5 11 3.39597 11 4.5012V8.00003C11 8.55003 10.55 9 10 9C9.45 9 9 8.55003 9 8.00003V5.99899C9 5.44269 8.55097 5.00003 7.99707 5.00003H3.00293C2.43788 5.00003 2 5.45194 2 6.0094V7.99066C2 8.55668 2.44772 9 3 9ZM13 4.99993H13.999C15.0999 4.99993 16 5.89218 16 6.99282V11.5071C16 12.6064 15.1081 13.5 14.008 13.5H6.99202C5.90018 13.5 5 12.604 5 11.4988V7.99993C5 7.44993 5.45 6.99993 6 6.99993C6.55 6.99993 7 7.44993 7 7.99993V10.001C7 10.5573 7.44903 10.9999 8.00293 10.9999H12.9971C13.5621 10.9999 14 10.548 14 9.99056V8.0093C14 7.44328 13.5536 6.99993 13.0029 6.99993H13C12.45 6.99993 12 6.54993 12 5.99993C12 5.44993 12.45 4.99993 13 4.99993Z"
      fill="currentColor"
     />
  </svg>
);
