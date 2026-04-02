import type { SVGProps } from "react";

interface IconRedoProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconRedo = ({ size, color, className, ...props }: IconRedoProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-redo", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.49981 1.91797C5.76981 1.91797 3.46481 4.08497 2.73981 6.08497H2.00081C1.58881 6.08497 1.35381 6.72197 1.60081 7.05097L3.60081 9.80097C3.80081 10.068 4.20081 10.11 4.40081 9.84297L6.40081 7.02997C6.64781 6.70097 6.41281 6.08497 6.00081 6.08497H4.87481C5.50981 5.08497 6.89081 3.91797 8.49981 3.91797C10.7058 3.91797 12.4998 5.79597 12.4998 8.00097C12.4998 10.207 10.7058 12.043 8.49981 12.043C7.75381 12.043 7.02681 11.857 6.39681 11.467C5.92781 11.177 5.31181 11.332 5.02081 11.801C4.72881 12.271 4.87481 12.892 5.34381 13.183C6.29081 13.769 7.38181 14.082 8.49981 14.082C11.8088 14.082 14.4998 11.309 14.4998 7.99997C14.4998 4.69097 11.8088 1.91797 8.49981 1.91797Z"
      fill="currentColor"
     />
  </svg>
);
