/**
 * DoctorDashboardWaves
 *
 * Layered hero ribbons: translucent white wash, pale-sage pool, warm-cream ribbon, bright ivory band, and twin champagne contour lines tracing the crest. Uses preserveAspectRatio="none" so it stretches to the hero width while keeping its silhouette.
 *
 * Traced by hand from the reference dashboard artwork (1648x928 coordinate space).
 * Purely decorative: aria-hidden, no pointer events. Drop it into the matching
 * container as an absolutely-positioned background layer (see README.md).
 */
import * as React from "react";

type Props = React.SVGProps<SVGSVGElement>;

export default function DoctorDashboardWaves({ className, style, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 1260 300"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ pointerEvents: "none", ...style }}
      {...props}
    >
      <defs>
      <linearGradient id="hwIvory" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stopColor="#ffffff" stopOpacity="0"/><stop offset="0.35" stopColor="#f6f1e6" stopOpacity="0.9"/><stop offset="1" stopColor="#fffdf8" stopOpacity="0.95"/></linearGradient>
      <linearGradient id="hwCream" x1="0" y1="0" x2="1" y2="0.5"><stop offset="0" stopColor="#efe7d4" stopOpacity="0"/><stop offset="0.4" stopColor="#e9dcc0" stopOpacity="0.85"/><stop offset="1" stopColor="#efe7d4" stopOpacity="0.9"/></linearGradient>
      <linearGradient id="hwSage" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor="#dfe9df" stopOpacity="0"/><stop offset="0.5" stopColor="#cfe0d2" stopOpacity="0.75"/><stop offset="1" stopColor="#d9e7da" stopOpacity="0.4"/></linearGradient>
      </defs>
      <path d="M360,300 C540,238 720,196 900,200 C1050,203 1160,236 1260,220 L1260,300 Z" fill="#ffffff" fillOpacity="0.4"/>
      <path d="M440,300 C600,236 770,198 930,206 C1070,213 1170,250 1260,236 L1260,300 Z" fill="url(#hwSage)"/>
      <path d="M400,300 C580,210 770,150 950,150 C1090,150 1180,196 1260,180 L1260,300 C1180,266 1090,214 950,212 C770,210 580,254 400,300 Z" fill="url(#hwCream)"/>
      <path d="M430,300 C610,188 810,120 1000,120 C1120,120 1190,160 1260,150 L1260,198 C1190,214 1120,174 1000,174 C810,174 610,244 430,300 Z" fill="url(#hwIvory)"/>
      <path d="M405,298 C590,190 800,124 998,126 C1125,127 1195,170 1260,158" fill="none" stroke="#c9a24b" strokeOpacity="0.6" strokeWidth="2.6"/>
      <path d="M445,300 C625,202 820,142 1008,144 C1132,145 1200,186 1260,176" fill="none" stroke="#d8bd82" strokeOpacity="0.45" strokeWidth="1.5"/>
    </svg>
  );
}
