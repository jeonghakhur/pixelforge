import type { SVGProps } from "react";

interface IconBoldProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconBold = ({ size, color, className, ...props }: IconBoldProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-bold", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.61841 13.989C11.175 13.989 12.7605 12.6609 12.7605 10.5608C12.7605 9.01685 11.6067 7.73413 10.0212 7.61792C11.2498 7.4353 12.1877 6.26929 12.1877 4.99927C12.1877 3.14819 10.8015 2.01099 8.47729 2.01099H3.2395V13.989H8.61841ZM5.74634 3.92847H7.83813C9.03345 3.92847 9.72241 4.50122 9.72241 5.45581C9.72241 6.4187 8.98364 6.97485 7.63062 6.97485H5.74634V3.92847ZM5.74634 12.0715V8.66821H7.92114C9.39868 8.66821 10.2039 9.24927 10.2039 10.345C10.2039 11.4656 9.42358 12.0715 7.97925 12.0715H5.74634Z"
      fill="currentColor"
     />
  </svg>
);
