import type { ReactNode } from "react";
import QRCode from "react-qr-code";
import type {
  OnePageReportViewModel,
  PrintClinicalSnapshotItem,
  PrintTreatmentKit,
  PrintTopical,
  PrintTimelineStage,
} from "@/lib/reports/one-page/viewModel";
import { clinicalOptionCodeForLabel, resolveClinicalOptionAsset } from "@/lib/reports/one-page/clinicalOptionAssets";
import { clinicalMeaningForKit, supportBenefitsForKit } from "@/lib/reports/one-page/clinicalCopy";
import { ClinicalOptionIcon } from "./ClinicalOptionIcon";
import "./one-page-report.css";

/* ==========================================================================
   Dr. FACT one-page hair-health assessment — CEO-approved "Ruchi" layout.

   Navy header + centered title + Doctor Reviewed chip.
   RowA: Patient (portrait + facts + Exact Grade card)
       | Doctor-Reviewed Result (clinical summary + green callout)
       | Key Clinical Snapshot (10-tile condition icon grid).
   Teal band: HOW YOUR FACTORS MAP TO YOUR CARE PLAN.
   Numbered mapping rows: Triggered by | Clinical meaning
                        | Recommended support | Why this support is included.
   Lower grid: Topical & Scalp Care | Recovery Timeline | Daily Support + QR.
   Slim navy footer.

   Exact-grade rule: the diagnosis card renders only the single matching
   grade illustration (no full Ludwig/Norwood ladder). `patternScale` is
   still on the view model for the doctor-facing variant.
   ========================================================================== */

export function OnePageHairReport({ data }: { data: OnePageReportViewModel }) {
  return <HairAssessmentPrintPage data={data} />;
}

export function HairAssessmentPrintPage({ data }: { data: OnePageReportViewModel }) {
  return (
    <main className="op-report-shell">
      <article
        className={`sheet op-page report-page op-mode-${data.layoutMode}`}
        data-one-page-report
        data-density={data.layoutMode}
        data-row-count={Math.min(8, Math.max(2, data.treatmentPlan.length))}
      >
        <ReportHeader />
        <RowA data={data} />
        <MappingBand data={data} />
        <LowerGrid data={data} />
        <ReportFooter data={data} />
      </article>
    </main>
  );
}

/* ============================== HEADER ================================= */
function ReportHeader() {
  return (
    <header className="hd">
      <div className="hd-lockup">
        <span className="cross" aria-hidden="true"><CrossPlus /></span>
        <div className="hd-word">
          <span className="serif">Dr. FACT</span>
          <small>AI TRICHOLOGIST</small>
        </div>
      </div>
      <div className="hd-title">
        <h1>Your Hair Health Assessment</h1>
        <p>Doctor-reviewed clinical summary &nbsp;&bull;&nbsp; Treatment plan &nbsp;&bull;&nbsp; Recovery journey</p>
      </div>
      <div className="hd-right">
        <DoctorReviewedChip />
        <div className="hd-meta">
          <span className="hd-meta-line">v1.0</span>
          <span className="hd-meta-line">Page 1 of 1</span>
        </div>
      </div>
    </header>
  );
}

function DoctorReviewedChip() {
  return (
    <div className="chip-dr">
      <ShieldSvg />
      <span>DOCTOR<br/>REVIEWED</span>
    </div>
  );
}

/* ==================== ROW A: PATIENT / RESULT / SNAPSHOT ================ */
function RowA({ data }: { data: OnePageReportViewModel }) {
  return (
    <section className="rowA">
      <PatientBlock data={data} />
      <ResultBlock data={data} />
      <SnapshotBlock data={data} />
    </section>
  );
}

function PatientBlock({ data }: { data: OnePageReportViewModel }) {
  const firstName = data.patient.name.split(/\s+/).filter(Boolean)[0] ?? data.patient.name;
  const ageNum = data.patient.age.replace(" yrs", "").trim();
  const snap = (label: string) =>
    data.snapshotStrip.find((row) => row.label.toLowerCase() === label.toLowerCase())?.value?.trim() ?? "";
  const isEmpty = (v: string) =>
    !v || /^(—|-|not (applicable|recorded|flagged)|n\/a|unknown)$/i.test(v.trim());
  const duration = snap("Duration");
  const shedding = snap("Shedding");
  const activity = data.clinicalResult.supportingLine;
  // Merge shedding + activity when they carry the same message so we don't
  // ship the "Noticeable shedding" tautology twice. Formatting rule from
  // the Turn F polish brief: `Shedding: ~50–100 strands · Noticeable`.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const sheddingCombined = (() => {
    if (isEmpty(shedding) && isEmpty(activity)) return "";
    if (isEmpty(shedding)) return activity;
    if (isEmpty(activity)) return shedding;
    if (norm(shedding).includes(norm(activity)) || norm(activity).includes(norm(shedding))) return shedding;
    const strandMatch = shedding.match(/([~\d\-–— ]+strands?)/i);
    if (strandMatch) return `${strandMatch[1].trim()} · ${activity}`.replace(/\s+·\s+·/, " ·");
    return `${shedding} · ${activity}`;
  })();
  return (
    <div className="blk patient-blk">
      <div className="patient-top">
        <img
          className="portrait"
          src={data.patient.imageAsset.src}
          alt={data.patient.imageAsset.alt}
          data-asset-key={data.patient.imageAsset.key}
        />
        <div className="patient-hd">
          <div className="serif name">{firstName}</div>
          <div className="sub">{ageNum} &nbsp;&bull;&nbsp; {data.patient.gender}</div>
        </div>
      </div>
      <ul className="patient-facts">
        <li><CalSvg /><div><small>Assessment date</small><b>{data.generatedAt}</b></div></li>
        {!isEmpty(duration) ? (
          <li><HourSvg /><div><small>Duration</small><b>{duration}</b></div></li>
        ) : null}
        {sheddingCombined ? (
          <li><StrandSvg /><div><small>Shedding</small><b>{sheddingCombined}</b></div></li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * (Kept for future doctor-facing variant.) The landscape production layout
 * moves the grade to a compact chip inside the Snapshot column — see
 * SnapshotGradeChip below. This component is no longer rendered.
 */
function ExactGradeCard({ data }: { data: OnePageReportViewModel }) {
  const scale = data.patternScale;
  if (!scale) return null;
  const selected = scale.stages.find((s) => s.selected) ?? scale.stages[0];
  const isNorwood = scale.type === "Norwood";
  const patternLabel = isNorwood ? "MPHL" : "FPHL";
  return (
    <div className="grade">
      <div className="grade-label">Hair Pattern</div>
      <div className="grade-title serif">
        {patternLabel} &mdash; {selected.value}
      </div>
      <div className="grade-thumb">
        <img
          src={selected.asset.src}
          alt={selected.asset.alt}
          data-asset-key={selected.asset.key}
          data-asset-role="grade"
        />
      </div>
      <div className="grade-exact">
        Exact Grade: <b>{selected.value}</b>
      </div>
    </div>
  );
}

function ResultBlock({ data }: { data: OnePageReportViewModel }) {
  const { primary, conclusion } = data.clinicalResult;
  const [head, tail] = splitOnLastDash(primary);
  // Doctor-Reviewed Result targets 55–80 words (diagnosis + active trigger
  // + contributors + strategy). Cap at 100 as a safety net; the validation
  // layer already warns when the composed conclusion exceeds 80 words so
  // this cap should almost never fire in practice.
  const summary = limitWords(conclusion, 100);
  return (
    <div className="blk result-blk">
      <div className="pill-doctor">
        <ShieldFilledSvg />
        <span>DOCTOR-REVIEWED RESULT</span>
      </div>
      <h2 className="serif result-title">
        {head}
        {tail ? <> &mdash; <span className="grade-em">{tail}</span></> : null}
      </h2>
      <p className="result-body">{summary}</p>
    </div>
  );
}
function splitOnLastDash(text: string): [string, string | null] {
  const match = text.match(/^(.*)\s+[—–-]\s+(.+)$/);
  if (!match) return [text, null];
  return [match[1].trim(), match[2].trim()];
}

function limitWords(text: string, maximum: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maximum) return text.trim();
  return `${words.slice(0, maximum).join(" ").replace(/[,:;.!?]+$/, "")}.`;
}
function SnapshotBlock({ data }: { data: OnePageReportViewModel }) {
  const tiles = data.keyClinicalSnapshot ?? deriveSnapshot(data);
  const scale = data.patternScale;
  const selected = scale?.stages.find((s) => s.selected) ?? scale?.stages[0] ?? null;
  const gradeChip = selected
    ? `Hair pattern: ${scale?.type === "Norwood" ? "MPHL" : "FPHL"} — ${selected.value}`
    : null;
  return (
    <div className="blk snapshot-blk">
      <div className="snap-hd">
        <div className="snap-title">KEY CLINICAL SNAPSHOT</div>
        <div className="snap-sub">(From your responses)</div>
      </div>
      {/*
        No slice — every clinically-meaningful patient selection surfaces as a
        tile. The grid's data-tile-count drives CSS density so 6 tiles render
        comfortably and 12+ compact without changing layout or shrinking below
        legible size.
      */}
      <div className="snap-grid" data-tile-count={tiles.length}>
        {tiles.map((tile) => (
          <div className="snap-tile" key={tile.label}>
            <div className="snap-ico">
              <ClinicalOptionIcon optionCode={tile.optionCode} label={tile.label} usage="snapshot" />
            </div>
            <div className="snap-cap">{tile.label}</div>
          </div>
        ))}
      </div>
      {gradeChip ? (
        <div className="snap-grade-chip"><b>{gradeChip}</b></div>
      ) : null}
    </div>
  );
}

function deriveSnapshot(_data: OnePageReportViewModel): PrintClinicalSnapshotItem[] {
  // Legacy fallback: earlier fixtures did not carry `keyClinicalSnapshot`.
  // The snapshot must reflect only options the patient actually selected on
  // the questionnaire — the source data lives on the ClinicalReport and is
  // populated by the viewModel. No kit-derived or driver-derived tiles.
  return [];
}

/* ============================== MAPPING BAND =========================== */
function MappingBand({ data }: { data: OnePageReportViewModel }) {
  return (
    <section className="mapband">
      <div className="map-title">
        <MapPinSvg />
        <span>HOW YOUR FACTORS MAP TO YOUR CARE PLAN</span>
      </div>
      <div className="map-header">
        <div className="map-header-num" aria-hidden="true"></div>
        <div className="map-header-cell">TRIGGERED BY</div>
        <div className="map-header-arrow" aria-hidden="true"></div>
        <div className="map-header-cell">CLINICAL MEANING</div>
        <div className="map-header-cell">RECOMMENDED SUPPORT</div>
        <div className="map-header-cell">HOW THIS SUPPORT WILL HELP</div>
      </div>
      <div className="map-rows" data-row-count={data.treatmentPlan.length}>
        {/* Render every doctor-approved kit in the approved order. No slice.
           Density downshift (comfortable / compact / ultra-compact) is applied
           by one-page-report.css keyed off data-row-count and the sheet-level
           layoutMode. Approved kits are never cropped, hidden, overflowed, or
           demoted into an additionalCare bucket. */}
        {data.treatmentPlan.map((kit, i) => (
          <MappingRow key={kit.id} kit={kit} index={i + 1} />
        ))}
      </div>
    </section>
  );
}

function MappingRow({ kit, index }: { kit: PrintTreatmentKit; index: number }) {
  // Show every patient signal this kit actually addresses (up to 4 — the
  // cap already applied upstream in patientLinkedTags). Previously capped
  // at 2 here, which hid signals like Smoking / Vaping and Alcohol on the
  // Phenotype Inflammation row when scalp signals filled both slots — the
  // row then read like it only addressed scalp inflammation even though
  // the kit was clinically selected for the oxidative-lifestyle load too.
  // chip-row wraps, so extra chips flow onto a second line inside the cell.
  const triggers = (kit.linkedDrivers.length > 0 ? kit.linkedDrivers : [kit.mappedCondition]).slice(0, 4);
  // Clinical safety: the CLINICAL MEANING copy must only reference factors
  // the patient actually sees as trigger chips. Passing the DISPLAYED
  // triggers (not the full linkedDrivers bag) prevents the meaning talking
  // about a driver that never made it into the chips row — e.g. a chip row
  // showing "Redness + Recurrent Acne" while the copy explains smoking.
  const meaning = conciseClinicalMeaning(kit, triggers);
  // Column 4: bullet 1 lists the patient signals this kit is mitigating
  // (driven by kit.linkedDrivers — the full bag, not just the top 2 chips
  // — so the patient sees every reported factor this kit addresses).
  // Bullet 2 is the canonical benefit sentence. Cap at 2 bullets so the
  // 5-row density fits.
  const benefits = benefitLinesForKit(kit);
  return (
    <div className="map-row">
      <div className="map-num">{index}</div>
      <div className="map-cell map-triggered">
        <div className="chip-row">
          {triggers.map((label) => {
            const optionCode = clinicalOptionCodeForLabel(label);
            return (
              <div className="chip" key={label} title={label}>
                <ClinicalOptionIcon optionCode={optionCode} label={label} usage="trigger" />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="map-arrow"><ArrowSvg /></div>
      <div className="map-cell map-meaning">
        <div className="cell-text">{meaning}</div>
      </div>
      <div className="map-cell map-support">
        <div className="support-row">
          <div className="support-shot">
            {kit.asset ? (
              <img
                src={kit.asset.src}
                alt={kit.asset.alt}
                data-asset-key={kit.asset.key}
                data-asset-role="product"
              />
            ) : (
              <span className="support-shot-fallback">{kit.name}</span>
            )}
          </div>
          <div className="support-name serif">{kit.name}</div>
        </div>
      </div>
      <div className="map-cell map-why">
        {benefits.length > 1 ? (
          <ul className="benefit-list">
            {benefits.map((line, i) => (
              <li key={i}><span className="benefit-dot" aria-hidden="true">•</span><span>{line}</span></li>
            ))}
          </ul>
        ) : (
          <div className="cell-text">{benefits[0] ?? ""}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Patient-facing benefit copy for the "How this support will help" column.
 *
 * Content Master §1 and §2.6: this column carries the KIT'S PURPOSE and must
 * not repeat the trigger list — the first column already shows every factor
 * as a chip. An earlier version spent bullet 1 on a "Targets: <signals>"
 * restatement of those same chips, which both duplicated column 1 and pushed
 * the kit's actual second purpose line off the row. Both bullets now come
 * from the approved kit definition.
 */
function benefitLinesForKit(kit: PrintTreatmentKit): string[] {
  const canonical = canonicalBenefitsForKit(kit.name, kit.kitCode);
  const fromModel = (kit.benefits ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    // Drop lines that look like the old "selectedBecause" — those are
    // typically single "kit picked because X" sentences. Point-wise
    // production copy comes from `canonical` when this fixture predates
    // the copy lock.
    .slice(0, 2);
  const source = (canonical ?? fromModel).filter(Boolean);
  // Render only the purpose lines that actually exist. Padding a one-line kit
  // with a generic second bullet ("Supports the doctor-reviewed treatment
  // plan") adds no clinical information and reads as filler next to the
  // two-line rows around it.
  const lines = source.slice(0, 2).filter((line, index, all) => all.indexOf(line) === index);
  return lines.length > 0 ? lines : ["Supports the doctor-reviewed treatment plan."];
}


function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]*[.!?]/);
  return match ? match[0].trim() : trimmed;
}

function limitChars(text: string, maximum: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maximum) return trimmed;
  const clipped = trimmed.slice(0, maximum + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const body = clipped.slice(0, lastSpace > maximum / 2 ? lastSpace : maximum).replace(/[,:;\s]+$/, "");
  return /[.!?]$/.test(body) ? body : `${body}…`;
}

/**
 * CLINICAL MEANING column.
 *
 * Copy comes from the approved registry in `lib/reports/one-page/clinicalCopy`
 * (Content Master §1: one combined explanation, 18–32 words, one primary
 * mechanism plus at most two contributing ones, hedged language).
 *
 * `displayedTriggers` — the chips the row actually renders — gates every
 * trigger-specific variant, so the column can never assert a factor the
 * patient does not see on the row.
 *
 * The clinical engine's per-signal interpretation is the fallback, used only
 * for kits with no registry entry. Those rows are written in clinician voice
 * and routinely run past the patient-facing word budget, so they cannot lead
 * this column; the registry variants carry the same patient specificity in
 * the approved voice.
 */
function conciseClinicalMeaning(kit: PrintTreatmentKit, displayedTriggers?: readonly string[]): string {
  const triggers =
    displayedTriggers && displayedTriggers.length > 0 ? displayedTriggers : kit.linkedDrivers;

  const approved = clinicalMeaningForKit({
    kitCode: kit.kitCode,
    name: kit.name,
    triggers,
    patientInterpretation: kit.mappedInterpretation,
  });
  if (approved) return approved;

  // ── Fallback: kit outside the registry ──────────────────────────────────
  const patientSpecific = (kit.mappedInterpretation ?? "").trim();
  if (patientSpecific.length > 0) return limitChars(firstSentence(patientSpecific), 360);

  const context = `${kit.kitCode} ${kit.name} ${kit.mappedCondition}`.toLowerCase();
  if (/ludwig|norwood|pattern/.test(context)) {
    return "Pattern-sensitive follicular thinning consistent with the underlying hair-loss pattern.";
  }
  return limitChars(
    firstSentence(kit.mappedInterpretation ?? kit.mappedCondition ?? "Doctor-approved follicle support."),
    180,
  );
}

/**
 * HOW THIS SUPPORT WILL HELP column — the kit's purpose, taken from the
 * approved kit definition via the copy registry. Returns null for kits with
 * no registry entry so the caller can fall back to the view model's
 * engine-derived benefit bullets.
 */
function canonicalBenefitsForKit(name: string, code: string): string[] | null {
  return supportBenefitsForKit(code, name);
}

/* ============================== LOWER GRID ============================= */
function LowerGrid({ data }: { data: OnePageReportViewModel }) {
  return (
    <section className="lower">
      <TopicalCard data={data} />
      <RecoveryTimelineCard data={data} />
      <DailySupportCard data={data} />
    </section>
  );
}

function TopicalCard({ data }: { data: OnePageReportViewModel }) {
  const topicals = data.topicalCare.slice(0, 2);
  const count = topicals.length;
  const hasAdditionalTopicals = data.topicalCare.length > 2;
  return (
    <div className="card topical-card" data-topical-count={count}>
      <div className="card-title navy">TOPICAL &amp; SCALP CARE PLAN</div>
      <div className="topical-body" data-count={count}>
        {topicals.map((t) => <TopicalRow key={t.topicalCode} topical={t} />)}
      </div>
      {hasAdditionalTopicals ? (
        <div className="topical-note">
          <InfoSvg />
          <span>See the complete approved topical plan in the digital report.</span>
        </div>
      ) : null}
    </div>
  );
}

function TopicalRow({ topical }: { topical: PrintTopical }) {
  const instructions = usageAsBullets(topical.usage);
  return (
    <div className="topical-row">
      <div className="topical-shot">
        {topical.asset ? (
          <img src={topical.asset.src} alt={topical.asset.alt} data-asset-key={topical.asset.key} />
        ) : (
          <span>{topical.name}</span>
        )}
      </div>
      <div className="topical-body-text">
        <div className="topical-name serif">{topical.name}</div>
        <ul className="topical-list">
          {instructions.map((line, i) => (
            <li key={i}><CheckSvg /><span>{line}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function usageAsBullets(usage: string): string[] {
  return usage
    .split(/(?<=[.!?])\s+|\s*;\s*/)
    .map((s) => s.replace(/\.+$/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

// Canonical recovery-timeline copy. Overrides whatever the fixtures /
// view-model builder produced, so a copy change lands in one place and
// every fixture inherits it. Titles + support lines locked 2026-08-03.
const CANONICAL_RECOVERY_TIMELINE: Array<{ window: string; title: string; stageCode: string }> = [
  { window: "Day 0-30", title: "Reduce active shedding", stageCode: "DAY_0_30" },
  { window: "Day 30-60", title: "Early recovery signs", stageCode: "DAY_30_60" },
  { window: "Day 60-120", title: "Progressive improvement", stageCode: "DAY_60_120" },
  { window: "Beyond Day 120", title: "Consolidate progress", stageCode: "BEYOND_120" },
];

function RecoveryTimelineCard({ data }: { data: OnePageReportViewModel }) {
  // 2x2 layout gives every stage enough vertical room for the canonical
  // supporting line, so we no longer gate that copy behind kit count.
  const stages = CANONICAL_RECOVERY_TIMELINE.map((canonical, i) => ({
    ...canonical,
    asset: data.recoveryJourney[i]?.asset ?? null,
  }));
  return (
    <div className="card recovery-card">
      <div className="card-title navy">YOUR RECOVERY TIMELINE</div>
      <div className="recovery-grid recovery-grid-2x2">
        {stages.map((s, i) => (
          <div className="rec-stage rec-stage-grid" key={s.stageCode}>
            <div className="rec-stage-head">
              <div className={`rec-badge rec-badge-${i + 1}`}>{i + 1}</div>
              <div className="rec-window">{s.window}</div>
            </div>
            <div className="rec-stage-body">
              <div className="rec-thumb">
                {s.asset ? <img src={s.asset.src} alt={s.asset.alt} data-asset-key={s.asset.key} /> : null}
              </div>
              <div className="rec-stage-text">
                <div className="rec-title">{s.title}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="recovery-note">
        <ShieldSmallSvg />
        <span>Improvement happens gradually and varies between patients.</span>
      </div>
    </div>
  );
}

function RecoveryStage({ stage, idx }: { stage: PrintTimelineStage; idx: number }) {
  const badgeClass = ["rec-badge", `rec-badge-${idx}`].join(" ");
  return (
    <div className="rec-stage">
      <div className={badgeClass}>{idx}</div>
      <div className="rec-window">{stage.window}</div>
      <div className="rec-thumb">
        {stage.asset ? (
          <img src={stage.asset.src} alt={stage.asset.alt} data-asset-key={stage.asset.key} />
        ) : null}
      </div>
      <div className="rec-title">{stage.title}</div>
    </div>
  );
}

function DailySupportCard({ data }: { data: OnePageReportViewModel }) {
  const supports = ["Follow the prescribed plan", "Iron-rich nutrition", "Gentle scalp care", "Stress management", "Consistent sleep"];
  const slows = ["Inconsistent treatment", "Excess alcohol", "Uncontrolled inflammation", "Harsh chemical or heat styling"];
  return (
    <div className="card daily-card">
      <div className="card-title navy">DAILY SUPPORT &amp; RECOVERY HABITS</div>
      <div className="daily-cols">
        <div className="daily-col">
          <div className="daily-hd good">SUPPORTS RECOVERY</div>
          <ul className="daily-list">
            {supports.map((item) => (
              <li key={item}><CheckSmSvg /><span>{item}</span></li>
            ))}
          </ul>
        </div>
        <div className="daily-col">
          <div className="daily-hd bad">MAY SLOW RECOVERY</div>
          <ul className="daily-list">
            {slows.map((item) => (
              <li key={item}><XSmSvg /><span>{item}</span></li>
            ))}
          </ul>
        </div>
      </div>
      {data.guideUrl ? (
        <div className="qr-row">
          <div className="qr-code">
            <QRCode value={data.guideUrl} size={64} bgColor="transparent" fgColor="#0B2545" />
          </div>
          <div className="qr-text">
            <div className="qr-title">SCAN TO VIEW COMPLETE PATIENT GUIDE</div>
            <div className="qr-sub">Your full guide with nutrition, scalp care, and treatment instructions.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================== FOOTER ================================= */
function ReportFooter({ data }: { data: OnePageReportViewModel }) {
  const signatureUrl = data.doctorApproval.signatureUrl ?? null;
  return (
    <footer className="ft">
      <FooterCell icon={<UserSvg />} label="Reviewed & Recommended by">
        <b>{data.clinician.name}</b>
        {signatureUrl ? (
          <img className="sig-img" src={signatureUrl} alt="Reviewing doctor signature" />
        ) : null}
      </FooterCell>
      <FooterCell icon={<PinSvg />} label="Clinic">
        <b>{data.clinic.name}</b>
      </FooterCell>
      <FooterCell icon={<CalSmallSvg />} label="Next review">
        <b>{data.doctorApproval.nextReviewDate}</b>
        <small>Discuss with your doctor</small>
      </FooterCell>
      <FooterCell icon={<InfoSvg />} label="">
        <small className="ft-disc">{data.disclaimer}</small>
      </FooterCell>
      <div className="ft-chip"><DoctorReviewedChip /></div>
    </footer>
  );
}

function FooterCell({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="ft-cell">
      <span className="ft-ico">{icon}</span>
      <div className="ft-body">
        {label ? <div className="ft-label">{label}</div> : null}
        {children}
      </div>
    </div>
  );
}

/* ============================== ICONS =================================== */
function CrossPlus() {
  return (
    <svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true">
      <rect x="0.75" y="0.75" width="24.5" height="24.5" rx="5" fill="#0F2A50" stroke="#F6C15B" strokeWidth="1.2"/>
      <path d="M13 6.5v13M6.5 13h13" stroke="#F6C15B" strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  );
}
function ShieldSvg() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" fill="none" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ShieldFilledSvg() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" fill="#1E7A5A"/>
      <path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ShieldSmallSvg() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" fill="#1E7A5A"/>
      <path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function HeartSvg() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 20s-7-4.35-9-9.5C1.5 6 5 3 8.5 4.5 10.5 5.4 12 7 12 7s1.5-1.6 3.5-2.5C19 3 22.5 6 21 10.5c-2 5.15-9 9.5-9 9.5z" fill="#1E7A5A"/>
    </svg>
  );
}
function CalSvg() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="#0B2545" strokeWidth="1.6"/>
      <path d="M3 9h18M8 3v4M16 3v4" stroke="#0B2545" strokeWidth="1.6"/>
    </svg>
  );
}
function HourSvg() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <path d="M6 3h12v3l-4 5 4 5v3H6v-3l4-5-4-5z" fill="none" stroke="#0B2545" strokeWidth="1.6"/>
    </svg>
  );
}
function StrandSvg() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <path d="M6 4c2 4 2 8 0 12M12 4c2 4 2 10 0 14M18 4c2 4 2 8 0 12" fill="none" stroke="#0B2545" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function PulseSvg() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <path d="M3 12h4l2-6 3 12 3-9 2 3h4" fill="none" stroke="#0B2545" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ArrowSvg() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="#0B2545" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function MapPinSvg() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M12 22s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z" fill="none" stroke="#fff" strokeWidth="1.7"/>
      <circle cx="12" cy="10" r="2.5" fill="#fff"/>
    </svg>
  );
}
function CheckSvg() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1E7A5A"/>
      <path d="M8 12l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function CheckSmSvg() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
      <path d="M5 12l4 4 10-11" fill="none" stroke="#1E7A5A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function XSmSvg() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
      <path d="M6 6l12 12M18 6l-12 12" stroke="#B04A3E" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
function InfoSvg() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="#0B2545" strokeWidth="1.6"/>
      <path d="M12 10v6M12 7.5v.01" stroke="#0B2545" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function UserSvg() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="none" stroke="#F2EEE3" strokeWidth="1.6"/>
      <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" fill="none" stroke="#F2EEE3" strokeWidth="1.6"/>
    </svg>
  );
}
function PinSvg() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 22s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z" fill="none" stroke="#F2EEE3" strokeWidth="1.6"/>
      <circle cx="12" cy="10" r="2.4" fill="#F2EEE3"/>
    </svg>
  );
}
function CalSmallSvg() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="#F2EEE3" strokeWidth="1.6"/>
      <path d="M3 9h18M8 3v4M16 3v4" stroke="#F2EEE3" strokeWidth="1.6"/>
    </svg>
  );
}
