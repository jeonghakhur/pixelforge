import type { SVGProps } from "react";

interface IconXProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconX = ({ size, color, className, ...props }: IconXProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-x", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.9542 4.46011C13.1438 4.27054 13.1436 3.95121 12.9465 3.75412L12.246 3.05364C12.0405 2.84812 11.7329 2.85308 11.54 3.0459L8.00007 6.58586L4.46011 3.0459C4.27054 2.85632 3.95121 2.85655 3.75412 3.05364L3.05364 3.75412C2.84812 3.95964 2.85308 4.2673 3.0459 4.46011L6.58586 8.00007L3.0459 11.54C2.85632 11.7296 2.85655 12.0489 3.05364 12.246L3.75412 12.9465C3.95964 13.152 4.2673 13.1471 4.46011 12.9542L8.00007 9.41429L11.54 12.9542C11.7296 13.1438 12.0489 13.1436 12.246 12.9465L12.9465 12.246C13.152 12.0405 13.1471 11.7329 12.9542 11.54L9.41429 8.00007L12.9542 4.46011Z"
      fill="currentColor"
     />
  </svg>
);
