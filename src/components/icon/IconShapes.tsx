import type { SVGProps } from "react";

interface IconShapesProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconShapes = ({ size, color, className, ...props }: IconShapesProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-shapes", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.926 11.4453C7.926 13.3573 6.376 14.9083 4.463 14.9083C2.551 14.9083 1 13.3573 1 11.4453C1 9.53329 2.551 7.98229 4.463 7.98229C6.376 7.98229 7.926 9.53329 7.926 11.4453ZM9.0002 13.4172V8.39919C9.0002 8.13607 9.22003 7.90819 9.49121 7.90819H14.5092C14.7723 7.90819 15.0002 8.12802 15.0002 8.39919V13.4172C15.0002 13.6803 14.7804 13.9082 14.5092 13.9082H9.49121C9.22808 13.9082 9.0002 13.6884 9.0002 13.4172ZM4.57143 6.90819C4.29284 6.90819 4.18368 6.70606 4.31922 6.47129L7.32178 1.27009C7.46108 1.02879 7.69068 1.03531 7.82621 1.27009L10.8288 6.47129C10.9681 6.71258 10.8476 6.90819 10.5766 6.90819H4.57143Z"
      fill="currentColor"
     />
  </svg>
);
