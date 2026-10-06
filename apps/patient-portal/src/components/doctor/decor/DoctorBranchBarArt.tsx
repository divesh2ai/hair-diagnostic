/**
 * DoctorBranchBarArt
 *
 * Branch-selector strip overlay (right ~45%, fades left): an ivory ribbon with a champagne contour, a stepped clinic building silhouette with windows, and two sage leaf clusters.
 *
 * Traced by hand from the reference dashboard artwork (1648x928 coordinate space).
 * Purely decorative: aria-hidden, no pointer events. Drop it into the matching
 * container as an absolutely-positioned background layer (see README.md).
 */
import * as React from "react";

type Props = React.SVGProps<SVGSVGElement>;

export default function DoctorBranchBarArt({ className, style, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 640 64"
      preserveAspectRatio="xMaxYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ pointerEvents: "none", ...style }}
      {...props}
    >
      <defs>
      <linearGradient id="bbFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0"/><stop offset="0.28" stopColor="#fff" stopOpacity="0"/><stop offset="0.5" stopColor="#fff" stopOpacity="1"/><stop offset="1" stopColor="#fff" stopOpacity="1"/></linearGradient>
      <clipPath id="bbClip"><rect x="0" y="0" width="640" height="64"/></clipPath>
      </defs>
      <g clipPath="url(#bbClip)">
      <path d="M-20,58 C90,36 180,16 250,20 C330,24 420,44 660,30 L660,64 L-20,64 Z" fill="#f6f1e6" fillOpacity="0.65"/>
      <path d="M-20,56 C95,33 185,13 252,17 C332,21 430,41 660,27" fill="none" stroke="#c9a24b" strokeOpacity="0.55" strokeWidth="1.7"/>
      <g fill="#d8c3a2" fillOpacity="0.4"><rect x="360" y="24" width="66" height="40"/><rect x="418" y="6" width="56" height="58"/><rect x="468" y="30" width="48" height="34"/></g>
      <g fill="#ffffff" fillOpacity="0.45"><rect x="428" y="16" width="8" height="9"/><rect x="444" y="16" width="8" height="9"/><rect x="460" y="16" width="8" height="9"/><rect x="428" y="30" width="8" height="9"/><rect x="444" y="30" width="8" height="9"/><rect x="460" y="30" width="8" height="9"/><rect x="428" y="44" width="8" height="9"/><rect x="444" y="44" width="8" height="9"/><rect x="460" y="44" width="8" height="9"/></g>
      <rect x="440" y="46" width="14" height="18" fill="#c9b084" fillOpacity="0.6"/>
      <g><path d="M320.0,60.0 C313.1,44.4 320.8,26.3 329.6,15.0 C333.0,28.9 332.7,48.6 320.0,60.0 Z" fill="#a9c4a3" fillOpacity="0.50"/><path d="M320.0,60.0 L329.1,17.3" stroke="#8fae8f" strokeOpacity="0.23" strokeWidth="1.0" fill="none"/><path d="M332.0,60.0 C320.4,50.5 319.6,33.4 322.3,21.2 C330.4,30.7 337.8,46.2 332.0,60.0 Z" fill="#a9c4a3" fillOpacity="0.46"/><path d="M332.0,60.0 L322.8,23.1" stroke="#8fae8f" strokeOpacity="0.21" strokeWidth="0.9" fill="none"/><path d="M344.0,60.0 C342.9,43.8 355.8,30.0 367.3,22.7 C365.8,36.3 359.1,53.8 344.0,60.0 Z" fill="#a9c4a3" fillOpacity="0.46"/><path d="M344.0,60.0 L366.2,24.6" stroke="#8fae8f" strokeOpacity="0.21" strokeWidth="1.0" fill="none"/><path d="M330.0,58.0 C317.4,54.9 311.0,41.8 309.1,31.2 C318.8,35.7 330.0,45.0 330.0,58.0 Z" fill="#a9c4a3" fillOpacity="0.40"/><path d="M330.0,58.0 L310.1,32.5" stroke="#8fae8f" strokeOpacity="0.18" strokeWidth="0.8" fill="none"/><path d="M352.0,60.0 C355.3,46.2 369.6,38.4 381.1,35.6 C376.3,46.5 366.2,59.2 352.0,60.0 Z" fill="#a9c4a3" fillOpacity="0.42"/><path d="M352.0,60.0 L379.7,36.8" stroke="#8fae8f" strokeOpacity="0.19" strokeWidth="0.9" fill="none"/></g>
      <g><path d="M560.0,62.0 C549.5,43.0 557.8,19.5 568.1,4.6 C573.8,21.8 575.3,46.6 560.0,62.0 Z" fill="#a9c4a3" fillOpacity="0.55"/><path d="M560.0,62.0 L567.7,7.4" stroke="#8fae8f" strokeOpacity="0.28" strokeWidth="1.3" fill="none"/><path d="M548.0,62.0 C531.7,52.4 527.9,31.3 529.3,15.6 C541.1,26.0 553.0,43.8 548.0,62.0 Z" fill="#a9c4a3" fillOpacity="0.50"/><path d="M548.0,62.0 L530.2,18.0" stroke="#8fae8f" strokeOpacity="0.25" strokeWidth="1.2" fill="none"/><path d="M574.0,62.0 C573.5,42.3 590.0,27.3 604.6,19.9 C602.0,36.1 592.9,56.4 574.0,62.0 Z" fill="#a9c4a3" fillOpacity="0.50"/><path d="M574.0,62.0 L603.0,22.0" stroke="#8fae8f" strokeOpacity="0.25" strokeWidth="1.2" fill="none"/><path d="M556.0,60.0 C539.6,57.5 529.5,41.5 525.4,28.3 C538.5,32.9 554.0,43.6 556.0,60.0 Z" fill="#a9c4a3" fillOpacity="0.44"/><path d="M556.0,60.0 L527.0,29.9" stroke="#8fae8f" strokeOpacity="0.22" strokeWidth="1.0" fill="none"/><path d="M584.0,62.0 C589.6,45.6 607.8,38.1 622.1,36.3 C615.1,48.9 601.3,63.0 584.0,62.0 Z" fill="#a9c4a3" fillOpacity="0.46"/><path d="M584.0,62.0 L620.2,37.6" stroke="#8fae8f" strokeOpacity="0.23" strokeWidth="1.1" fill="none"/><path d="M566.0,62.0 C558.7,40.7 571.4,18.3 584.5,4.9 C587.3,23.5 584.4,49.1 566.0,62.0 Z" fill="#a9c4a3" fillOpacity="0.50"/><path d="M566.0,62.0 L583.6,7.8" stroke="#8fae8f" strokeOpacity="0.25" strokeWidth="1.4" fill="none"/></g>
      </g>
      <rect x="0" y="0" width="300" height="64" fill="url(#bbFade)" fillOpacity="0"/>
    </svg>
  );
}
