import type { SVGProps } from "react";

interface IconCollapseSidebarProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const IconCollapseSidebar = ({ size, color, className, ...props }: IconCollapseSidebarProps) => (
  <svg
    width={16}
    height={16}
    className={["icon-collapse-sidebar", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 2H3C2.73478 2 2.48043 2.10536 2.29289 2.29289C2.10536 2.48043 2 2.73478 2 3V13C2 13.2652 2.10536 13.5196 2.29289 13.7071C2.48043 13.8946 2.73478 14 3 14H10V2ZM3 1H13C13.5304 1 14.0391 1.21071 14.4142 1.58579C14.7893 1.96086 15 2.46957 15 3V13C15 13.5304 14.7893 14.0391 14.4142 14.4142C14.0391 14.7893 13.5304 15 13 15H3C2.46957 15 1.96086 14.7893 1.58579 14.4142C1.21071 14.0391 1 13.5304 1 13V3C1 2.46957 1.21071 1.96086 1.58579 1.58579C1.96086 1.21071 2.46957 1 3 1ZM7.78 10.22C7.91248 10.3622 7.9846 10.5502 7.98117 10.7445C7.97775 10.9388 7.89903 11.1242 7.76162 11.2616C7.62421 11.399 7.43882 11.4777 7.24452 11.4812C7.05022 11.4846 6.86217 11.4125 6.72 11.28L4.22 8.78C4.07955 8.63937 4.00066 8.44875 4.00066 8.25C4.00066 8.05125 4.07955 7.86063 4.22 7.72L6.72 5.22C6.86217 5.08752 7.05022 5.0154 7.24452 5.01883C7.43882 5.02225 7.62421 5.10097 7.76162 5.23838C7.89903 5.37579 7.97775 5.56118 7.98117 5.75548C7.9846 5.94978 7.91248 6.13783 7.78 6.28L5.81 8.25L7.78 10.22Z"
      fill="currentColor"
     />
  </svg>
);
