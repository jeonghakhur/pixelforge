import type { SVGProps } from "react";

interface IconParagraph1Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconParagraph1 = ({ size, color, className, ...props }: IconParagraph1Props) => (
  <svg
    width={16}
    height={16}
    className={["icon-paragraph1", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7 13.5C7 13.7761 7.22386 14 7.5 14H8.5C8.77614 14 9 13.7761 9 13.5V2.5C9 2.22386 8.77614 2 8.5 2H6C3.79086 2 2 3.79086 2 6C2 8.20914 3.79086 10 6 10H7V13.5ZM10 13.5C10 13.7761 10.2239 14 10.5 14H11.5C11.7761 14 12 13.7761 12 13.5V2.5C12 2.22386 11.7761 2 11.5 2H10.5C10.2239 2 10 2.22386 10 2.5V13.5Z"
      fill="currentColor"
     />
  </svg>
);
