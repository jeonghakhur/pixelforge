import type { SVGProps } from "react";

interface IconFlagProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconFlag = ({ size, color, className, ...props }: IconFlagProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-flag", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.625 3.24506C5.555 2.94506 7.168 2.54506 8.375 2.88506C10.175 3.39306 12.398 2.53606 12.398 2.53606C12.662 2.44906 12.875 2.60206 12.875 2.87406V9.11206C12.875 9.38606 12.654 9.66706 12.398 9.72906C12.398 9.72906 10.175 10.3741 8.375 9.99306C7.168 9.73806 5.555 10.1091 4.625 10.3811V12.9991C4.62514 13.0655 4.61205 13.1313 4.58648 13.1926C4.56091 13.2539 4.52339 13.3095 4.47609 13.3561C4.4288 13.4028 4.37269 13.4395 4.31103 13.4642C4.24938 13.4889 4.18342 13.5011 4.117 13.5001H3.633C3.49947 13.5001 3.37131 13.4475 3.27624 13.3538C3.18117 13.26 3.12684 13.1326 3.125 12.9991V3.00006C3.12499 2.93372 3.13818 2.86805 3.16381 2.80686C3.18944 2.74567 3.22698 2.69019 3.27426 2.64365C3.32154 2.59712 3.37761 2.56045 3.4392 2.5358C3.50079 2.51115 3.56667 2.499 3.633 2.50006H4.117C4.397 2.50006 4.625 2.73006 4.625 3.00106V3.24506Z"
      fill="currentColor"
     />
  </svg>
);
