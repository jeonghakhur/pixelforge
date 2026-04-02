import type { SVGProps } from "react";

interface IconLightbulbProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconLightbulb = ({ size, color, className, ...props }: IconLightbulbProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-lightbulb", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.46835 6.91303C4.44319 6.86587 4.41895 6.81814 4.39565 6.76988C4.28096 6.53789 4.19745 6.33495 4.16446 6.17208C4.05745 5.81113 4 5.42888 4 5.0332C4 2.82406 5.79086 1.0332 8 1.0332C10.2091 1.0332 12 2.82406 12 5.0332C12 5.89151 11.7297 6.68668 11.2695 7.3382C10.7319 8.35879 10.0168 9.72572 10.0168 10.6897C8.86499 11.0032 6.55638 11.5398 6.55638 11.5398C6.29114 11.602 6.07612 11.4252 6.07612 11.1523C6.07612 11.1523 6.07612 11.5179 6.07612 10.6897C6.07612 9.52408 5.01607 7.96666 4.46835 6.91303ZM6.00061 12.8833C5.99606 12.6036 6.2098 12.3219 6.47216 12.2557L10.0364 11.3556L10.0293 11.8624C10.0253 12.1423 9.80633 12.424 9.52999 12.4943L6.50095 13.2646C6.22917 13.3337 6.00536 13.175 6.00061 12.8833ZM6.00007 14.5704C5.99552 14.2907 6.20908 14.0085 6.47123 13.9417L10.0326 13.0332L10.0254 13.54C10.0215 13.8199 9.80267 14.1021 9.52656 14.1731L6.50001 14.9506C6.22845 15.0204 6.00482 14.8621 6.00007 14.5704Z"
      fill="currentColor"
     />
  </svg>
);
