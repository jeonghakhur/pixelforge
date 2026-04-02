import type { SVGProps } from "react";

interface IconExpandSidebarProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconExpandSidebar = ({ size, color, className, ...props }: IconExpandSidebarProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-expand-sidebar", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 2V14H13C13.2652 14 13.5196 13.8946 13.7071 13.7071C13.8946 13.5196 14 13.2652 14 13V3C14 2.73478 13.8946 2.48043 13.7071 2.29289C13.5196 2.10536 13.2652 2 13 2H10ZM3 1H13C13.5304 1 14.0391 1.21071 14.4142 1.58579C14.7893 1.96086 15 2.46957 15 3V13C15 13.5304 14.7893 14.0391 14.4142 14.4142C14.0391 14.7893 13.5304 15 13 15H3C2.46957 15 1.96086 14.7893 1.58579 14.4142C1.21071 14.0391 1 13.5304 1 13V3C1 2.46957 1.21071 1.96086 1.58579 1.58579C1.96086 1.21071 2.46957 1 3 1ZM4.22 6.28L6.19 8.25L4.22 10.22C4.08752 10.3622 4.0154 10.5502 4.01883 10.7445C4.02225 10.9388 4.10097 11.1242 4.23838 11.2616C4.37579 11.399 4.56118 11.4777 4.75548 11.4812C4.94978 11.4846 5.13783 11.4125 5.28 11.28L7.78 8.78C7.92045 8.63937 7.99934 8.44875 7.99934 8.25C7.99934 8.05125 7.92045 7.86063 7.78 7.72L5.28 5.22C5.13783 5.08752 4.94978 5.0154 4.75548 5.01883C4.56118 5.02225 4.37579 5.10097 4.23838 5.23838C4.10097 5.37579 4.02225 5.56118 4.01883 5.75548C4.0154 5.94978 4.08752 6.13783 4.22 6.28Z"
      fill="currentColor"
     />
  </svg>
);
