import type { SVGProps } from "react";

interface IconBarcodeProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconBarcode = ({ size, color, className, ...props }: IconBarcodeProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-barcode", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.5 15H2.5C2.224 15 2 14.7387 2 14.4167V1.58333C2 1.26133 2.224 1 2.5 1H4.5C4.776 1 5 1.26133 5 1.58333V14.4167C5 14.7387 4.776 15 4.5 15ZM7 14.3C7 14.6862 6.776 15 6.5 15C6.224 15 6 14.6862 6 14.3V1.7C6 1.31383 6.224 1 6.5 1C6.776 1 7 1.31383 7 1.7V14.3ZM9.5 15H8.5C8.224 15 8 14.7387 8 14.4167V1.58333C8 1.26133 8.224 1 8.5 1H9.5C9.776 1 10 1.26133 10 1.58333V14.4167C10 14.7387 9.776 15 9.5 15ZM15.5 15H13.5C13.224 15 13 14.7387 13 14.4167V1.58333C13 1.26133 13.224 1 13.5 1H15.5C15.776 1 16 1.26133 16 1.58333V14.4167C16 14.7387 15.776 15 15.5 15ZM12 14.3C12 14.6862 11.776 15 11.5 15C11.224 15 11 14.6862 11 14.3V1.7C11 1.31383 11.224 1 11.5 1C11.776 1 12 1.31383 12 1.7V14.3ZM1 14.3C1 14.6862 0.776 15 0.5 15C0.224 15 0 14.6862 0 14.3V1.7C0 1.31383 0.224 1 0.5 1C0.776 1 1 1.31383 1 1.7V14.3Z"
      fill="currentColor"
     />
  </svg>
);
