/**
 * DoctorHeroComposition
 *
 * ⚠️ ISOLATED VISUAL DISCREPANCY (see README.md).
 *
 * In the reference, the right third of the hero is a soft photographic / editorial
 * medical still-life: a gold + dark-green stethoscope resting on a pale stone desk,
 * a potted plant in the top-right corner, and a warm blurred background.
 *
 * That is a RASTER PHOTO, not vector art. Per the brief, decorative botanicals and
 * ribbons were traced as SVG, but this photographic composition must NOT be faked
 * with abstract medical icons. This component is therefore a deliberate placeholder:
 *
 *   1. If your project already owns a suitable asset (search: stethoscope / clinic
 *      desk / doctor desk / medical workspace / hero / clinical), pass its URL via
 *      the `src` prop and it will be used as a right-anchored cover image.
 *   2. If no owned asset exists, it renders a soft warm gradient wash that blends
 *      with DoctorDashboardWaves, so the hero still reads correctly — but this area
 *      is knowingly not a pixel match to the reference photograph.
 *
 * The flowing ribbons around this area are handled by <DoctorDashboardWaves/>.
 */
import * as React from "react";

type Props = {
  /** Owned/local photo asset to use for the editorial medical still-life. */
  src?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function DoctorHeroComposition({ src, className, style }: Props) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        // Warm editorial wash that fades in from the left so hero text stays readable.
        backgroundImage: src
          ? `linear-gradient(90deg, rgba(255,253,248,1) 0%, rgba(255,253,248,0) 34%), url(${src})`
          : `radial-gradient(120% 140% at 88% 24%, #eef3ec 0%, rgba(238,243,236,0) 42%),
             linear-gradient(90deg, rgba(255,253,248,1) 0%, rgba(255,253,248,0) 30%, rgba(247,241,230,0.6) 72%, rgba(238,231,215,0.75) 100%)`,
        backgroundSize: src ? "auto, cover" : undefined,
        backgroundPosition: src ? "left, right center" : undefined,
        backgroundRepeat: "no-repeat",
        ...style,
      }}
    />
  );
}
