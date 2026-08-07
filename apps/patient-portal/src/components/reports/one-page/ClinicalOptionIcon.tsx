import type { ClinicalIconUsage } from "@/lib/reports/one-page/clinicalOptionAssets";
import { resolveClinicalOptionAsset } from "@/lib/reports/one-page/clinicalOptionAssets";

export function ClinicalOptionIcon({
  optionCode,
  label,
  usage,
}: {
  optionCode?: string | null;
  label: string;
  usage: ClinicalIconUsage;
}) {
  const resolved = resolveClinicalOptionAsset({ optionCode, label });
  return (
    <span
      className={`clinical-option-icon clinical-option-icon-${usage}`}
      data-option-code={resolved.optionCode}
      data-option-status={resolved.status}
      title={resolved.status === "exact" ? undefined : `${label}: ${resolved.status.replaceAll("_", " ")}`}
    >
      <img
        src={resolved.asset.src}
        alt={resolved.asset.alt}
        data-asset-key={resolved.asset.key}
        data-asset-role={usage === "trigger" ? "trigger" : "snapshot"}
      />
    </span>
  );
}
