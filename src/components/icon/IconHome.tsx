import type { SVGProps } from "react";

interface IconHomeProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconHome = ({ size, color, className, ...props }: IconHomeProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-home", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.31172 1.50627C7.69185 1.11112 8.30579 1.10866 8.68828 1.50627L13.3117 6.31242C13.6918 6.70757 14 7.46751 14 8.02687V14.2814C14 14.5627 13.7849 14.7908 13.5095 14.7908H10.4905C10.2196 14.7908 10 14.5757 10 14.3003V10.7908C10 10.7908 10 8.79079 8 8.79079C6 8.79079 6.06573 10.3066 6.06573 10.3066C6.02943 10.574 6 11.0058 6 11.2813V14.3003C6 14.5712 5.78494 14.7908 5.50952 14.7908H2.49048C2.21959 14.7908 2 14.5668 2 14.2814V8.02687C2 7.47515 2.30579 6.71003 2.68828 6.31242L7.31172 1.50627Z"
      fill="currentColor"
     />
  </svg>
);
