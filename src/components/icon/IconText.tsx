import type { SVGProps } from "react";

interface IconTextProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconText = ({ size, color, className, ...props }: IconTextProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-text", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.55403 12.865L6.62803 2.679C6.83403 2.166 7.44803 1.75 8.00003 1.75C8.55603 1.75 9.16603 2.166 9.37203 2.68L13.446 12.865C13.752 13.63 13.33 14.25 12.502 14.25H12.25C12.0338 14.2417 11.8249 14.1698 11.6493 14.0433C11.4737 13.9169 11.3394 13.7414 11.263 13.539L10.737 11.961C10.607 11.571 10.16 11.25 9.74103 11.25H6.25903C5.82903 11.25 5.39403 11.568 5.26303 11.961L4.73703 13.539C4.60703 13.929 4.16403 14.25 3.75003 14.25H3.49803C2.67003 14.25 2.24803 13.63 2.55403 12.865ZM6.37103 8.32C6.16603 8.833 6.44303 9.249 7.00903 9.249H8.99103C9.54803 9.249 9.83603 8.839 9.62803 8.32L8.55603 5.643C8.24803 4.873 7.75003 4.873 7.44203 5.643L6.37203 8.32H6.37103Z"
      fill="currentColor"
     />
  </svg>
);
