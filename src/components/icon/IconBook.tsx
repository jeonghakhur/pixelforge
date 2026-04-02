import type { SVGProps } from "react";

interface IconBookProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconBook = ({ size, color, className, ...props }: IconBookProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-book", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.30175 2.64717L6.36021 1.27486C6.46034 1.20811 6.67755 1.18474 6.78797 1.22721L12.353 3.36762C12.4135 3.39087 12.5 3.51689 12.5 3.58718V13.5807C12.5 13.8569 12.7239 14.0807 13 14.0807C13.2761 14.0807 13.5 13.8569 13.5 13.5807V3.58718C13.5 3.10324 13.1588 2.6061 12.712 2.43428L7.14695 0.293863C6.73469 0.135302 6.17672 0.195336 5.80551 0.442808L3.22265 2.16472L2.88871 2.38735L2.89124 2.39388C2.65415 2.50093 2.5 2.74727 2.5 3.08073V12.1295C2.5 12.6818 2.91816 13.284 3.43181 13.4738L9.55494 15.7364C10.0696 15.9266 10.4868 15.6304 10.4868 15.0813V5.59107C10.4868 5.03907 10.0574 4.45659 9.53921 4.29369L4.30175 2.64717Z"
      fill="currentColor"
     />
  </svg>
);
