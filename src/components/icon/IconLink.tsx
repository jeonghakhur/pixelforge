import type { SVGProps } from "react";

interface IconLinkProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconLink = ({ size, color, className, ...props }: IconLinkProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-link", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.4176 7H1.00685C0.45078 7 0 6.55628 0 6.00019V2.99981C0 2.44763 0.449949 2 1.00685 2H12.9932C13.5492 2 14 2.44372 14 2.99981V6.00019C14 6.55237 13.5501 7 12.9932 7H8.5723L9.42877 8.48345L10.2948 7.98345C10.6403 7.78395 11.0698 8.04983 11.0436 8.44835L10.8351 10.7696C10.7859 11.3173 10.34 11.5765 9.83941 11.3444L7.72495 10.3644C7.36669 10.1878 7.35117 9.68295 7.69672 9.48345L8.56274 8.98345L7.4176 7ZM6.756 9C6.20659 9.71034 6.39305 10.8229 7.28297 11.2614L9.41888 12.2517C10.5473 12.7747 11.72 12.0963 11.8311 10.859L11.998 9H15.0015C15.553 9 16 9.44372 16 9.99981V13.0002C16 13.5524 15.5525 14 15.0015 14H3.9985C3.44704 14 3 13.5563 3 13.0002V9.99981C3 9.44763 3.44749 9 3.9985 9H6.756Z"
      fill="currentColor"
     />
  </svg>
);
