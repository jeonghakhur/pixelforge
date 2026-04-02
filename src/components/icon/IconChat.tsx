import type { SVGProps } from "react";

interface IconChatProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconChat = ({ size, color, className, ...props }: IconChatProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-chat", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.3341 11.2098H11.9915C13.098 11.2098 14 10.3156 14 9.21245V4.20723C14 3.1057 13.1007 2.20984 11.9915 2.20984H4.00853C2.90195 2.20984 2 3.1041 2 4.20723V9.21245C2 10.3112 2.89464 11.2052 4 11.2098V13.2005C4 13.7665 4.37069 13.9533 4.82796 13.6367L8.3341 11.2098Z"
      fill="currentColor"
     />
  </svg>
);
