/**
 * DoctorSidebarBotanical
 *
 * Tall fern-like botanical branch for the lower sidebar: one primary curved stem rising on the right with ~13 alternating tapered leaves, faint rounded leaf blobs behind the mascot, a lower-left bushy cluster, and a cream ground ribbon with a champagne contour line.
 *
 * Traced by hand from the reference dashboard artwork (1648x928 coordinate space).
 * Purely decorative: aria-hidden, no pointer events. Drop it into the matching
 * container as an absolutely-positioned background layer (see README.md).
 */
import * as React from "react";

type Props = React.SVGProps<SVGSVGElement>;

export default function DoctorSidebarBotanical({ className, style, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 330 440"
      preserveAspectRatio="xMaxYMax meet"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ pointerEvents: "none", ...style }}
      {...props}
    >
      <defs>
      <linearGradient id="sbLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c3d8bd"/><stop offset="1" stopColor="#8fae8f"/></linearGradient>
      </defs>
      <g><path d="M70.0,150.0 C78.0,58.0 135.9,73.2 184.1,112.9 C168.5,173.4 130.5,219.7 70.0,150.0 Z" fill="#d7e6d2" fillOpacity="0.14"/><path d="M40.0,300.0 C88.5,232.4 133.2,269.2 158.2,320.8 C117.0,360.8 62.4,380.1 40.0,300.0 Z" fill="#d7e6d2" fillOpacity="0.12"/><path d="M150.0,120.0 C204.5,61.1 230.8,102.5 238.1,155.6 C196.0,188.7 148.3,200.2 150.0,120.0 Z" fill="#d7e6d2" fillOpacity="0.10"/><path d="M215.0,250.0 C205.9,180.2 251.0,182.7 292.9,205.0 C291.3,252.5 270.9,292.8 215.0,250.0 Z" fill="#d7e6d2" fillOpacity="0.10"/></g>
      <g><path d="M120.0,360.0 C127.0,324.1 163.2,305.1 192.8,298.9 C181.6,327.0 156.6,359.3 120.0,360.0 Z" fill="#a9c4a3" fillOpacity="0.42"/><path d="M120.0,360.0 L189.1,302.0" stroke="#8fae8f" strokeOpacity="0.21" strokeWidth="2.3" fill="none"/><path d="M108.0,372.0 C126.4,346.8 160.9,346.0 185.6,352.6 C166.9,370.1 136.1,385.6 108.0,372.0 Z" fill="#a9c4a3" fillOpacity="0.40"/><path d="M108.0,372.0 L181.7,353.6" stroke="#8fae8f" strokeOpacity="0.20" strokeWidth="2.0" fill="none"/><path d="M138.0,350.0 C129.6,317.3 151.9,286.8 173.8,269.6 C175.7,297.4 167.9,334.4 138.0,350.0 Z" fill="#a9c4a3" fillOpacity="0.36"/><path d="M138.0,350.0 L172.0,273.6" stroke="#8fae8f" strokeOpacity="0.18" strokeWidth="2.1" fill="none"/><path d="M150.0,386.0 C168.4,366.2 198.4,368.5 219.3,376.3 C201.4,389.4 173.2,399.9 150.0,386.0 Z" fill="#a9c4a3" fillOpacity="0.30"/><path d="M150.0,386.0 L215.9,376.7" stroke="#8fae8f" strokeOpacity="0.15" strokeWidth="1.7" fill="none"/></g>
      <path d="M302,410 C297,330 303,252 294,176 C287,112 282,60 272,20" fill="none" stroke="#8fae8f" strokeOpacity="0.34" strokeWidth="2.2" strokeLinecap="round"/>
      <g><path d="M272.0,22.0 C256.9,2.9 253.1,-28.2 254.1,-49.8 C265.1,-31.2 276.3,-2.0 272.0,22.0 Z" fill="#c3d8bd" fillOpacity="0.42"/><path d="M272.0,22.0 L255.0,-46.2" stroke="#6f8f6f" strokeOpacity="0.19" strokeWidth="1.0" fill="none"/><path d="M274.0,30.0 C271.5,7.1 284.0,-19.8 295.6,-36.6 C295.2,-16.1 289.5,13.0 274.0,30.0 Z" fill="#c3d8bd" fillOpacity="0.44"/><path d="M274.0,30.0 L294.5,-33.2" stroke="#6f8f6f" strokeOpacity="0.20" strokeWidth="1.0" fill="none"/><path d="M278.0,60.0 C256.6,42.4 245.1,8.8 241.2,-15.5 C257.9,2.5 277.3,32.3 278.0,60.0 Z" fill="#a9c4a3" fillOpacity="0.48"/><path d="M278.0,60.0 L243.0,-11.7" stroke="#6f8f6f" strokeOpacity="0.22" strokeWidth="1.2" fill="none"/><path d="M281.0,72.0 C282.7,46.4 301.6,19.4 317.6,3.1 C313.1,25.5 301.3,56.3 281.0,72.0 Z" fill="#c3d8bd" fillOpacity="0.44"/><path d="M281.0,72.0 L315.8,6.6" stroke="#6f8f6f" strokeOpacity="0.20" strokeWidth="1.1" fill="none"/><path d="M285.0,106.0 C259.8,89.2 243.3,53.9 236.2,28.0 C256.5,45.7 281.0,76.0 285.0,106.0 Z" fill="#8fae8f" fillOpacity="0.54"/><path d="M285.0,106.0 L238.7,31.9" stroke="#6f8f6f" strokeOpacity="0.24" strokeWidth="1.2" fill="none"/><path d="M288.0,120.0 C292.6,92.7 315.9,65.9 335.0,50.4 C327.7,73.8 311.6,105.5 288.0,120.0 Z" fill="#a9c4a3" fillOpacity="0.48"/><path d="M288.0,120.0 L332.6,53.8" stroke="#6f8f6f" strokeOpacity="0.22" strokeWidth="1.2" fill="none"/><path d="M291.0,158.0 C262.0,142.0 241.7,104.9 232.2,77.1 C255.7,94.6 284.7,125.5 291.0,158.0 Z" fill="#8fae8f" fillOpacity="0.58"/><path d="M291.0,158.0 L235.2,81.1" stroke="#6f8f6f" strokeOpacity="0.26" strokeWidth="1.4" fill="none"/><path d="M294.0,174.0 C300.8,145.0 327.8,118.2 349.4,103.1 C340.0,127.7 320.5,160.4 294.0,174.0 Z" fill="#a9c4a3" fillOpacity="0.50"/><path d="M294.0,174.0 L346.6,106.6" stroke="#6f8f6f" strokeOpacity="0.23" strokeWidth="1.2" fill="none"/><path d="M297.0,214.0 C263.8,200.3 237.8,162.6 224.7,133.7 C252.1,149.8 286.8,179.6 297.0,214.0 Z" fill="#8fae8f" fillOpacity="0.60"/><path d="M297.0,214.0 L228.3,137.8" stroke="#6f8f6f" strokeOpacity="0.27" strokeWidth="1.6" fill="none"/><path d="M299.0,232.0 C309.3,201.9 341.0,176.5 365.7,162.9 C353.0,188.1 328.7,220.7 299.0,232.0 Z" fill="#a9c4a3" fillOpacity="0.52"/><path d="M299.0,232.0 L362.4,166.4" stroke="#6f8f6f" strokeOpacity="0.23" strokeWidth="1.4" fill="none"/><path d="M301.0,276.0 C263.8,265.3 231.9,227.9 214.8,198.4 C246.0,212.3 286.5,240.1 301.0,276.0 Z" fill="#8fae8f" fillOpacity="0.60"/><path d="M301.0,276.0 L219.1,202.3" stroke="#6f8f6f" strokeOpacity="0.27" strokeWidth="1.7" fill="none"/><path d="M302.0,300.0 C314.1,269.6 348.4,246.1 374.8,234.4 C360.5,259.5 333.6,291.1 302.0,300.0 Z" fill="#a9c4a3" fillOpacity="0.52"/><path d="M302.0,300.0 L371.2,237.7" stroke="#6f8f6f" strokeOpacity="0.23" strokeWidth="1.5" fill="none"/><path d="M302.0,346.0 C262.4,342.5 224.0,310.4 201.9,283.5 C235.9,291.5 281.5,312.0 302.0,346.0 Z" fill="#8fae8f" fillOpacity="0.56"/><path d="M302.0,346.0 L206.9,286.6" stroke="#6f8f6f" strokeOpacity="0.25" strokeWidth="1.8" fill="none"/></g>
      <path d="M-5,392 C90,356 230,372 335,418 L335,440 L-5,440 Z" fill="#efe7d4" fillOpacity="0.55"/>
      <path d="M-5,398 C95,362 232,378 335,424" fill="none" stroke="#d8bd82" strokeOpacity="0.55" strokeWidth="1.6"/>
    </svg>
  );
}
