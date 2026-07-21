"use client";

/* eslint-disable @next/next/no-img-element -- Exact layered artwork and explicit picture sources are required for this isolated preview. */

import Link from "next/link";
import { useState, type CSSProperties, type KeyboardEvent } from "react";

import type { ProgressState } from "@/runtime/progressEngine";
import type { Question, QuestionOption } from "@/types/questionnaire";

import styles from "./assessment-v3.module.css";

export type PreviewView = "desktop" | "mobile" | "chapter";

const PREVIEW_ASSET_ROOT = "/design-preview/assessment-v3";

const previewQuestion = {
  id: "preview-nutrition-protein-frequency",
  category: "nutrition",
  type: "single_select",
  title: "How often do you include protein-rich foods in your meals?",
  subtitle: "Choose the answer that feels closest to your usual week.",
  required: true,
  options: [
    { id: "daily", label: "Daily" },
    { id: "most-days", label: "Most days" },
    { id: "few-times", label: "A few times a week" },
    { id: "rarely", label: "Rarely" },
  ],
} satisfies Question;

const previewProgress: Record<"current" | "continued", ProgressState> = {
  current: {
    percentage: 59,
    visiblePosition: 5,
    visibleTotal: 7,
    rawIndex: 4,
    answeredCount: 4,
    unansweredVisible: 3,
  },
  continued: {
    percentage: 72,
    visiblePosition: 6,
    visibleTotal: 7,
    rawIndex: 5,
    answeredCount: 5,
    unansweredVisible: 2,
  },
};

const viewLabels: Record<PreviewView, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  chapter: "Chapter",
};

type HairGrowthProgressProps = {
  progress: ProgressState;
};

function HairGrowthProgress({ progress }: HairGrowthProgressProps) {
  const label = `Question ${progress.visiblePosition} of ${progress.visibleTotal} · ${progress.percentage}%`;
  const visualProgress = 18 + progress.percentage * 0.82;
  const progressStyle = {
    "--preview-progress": `${visualProgress}%`,
  } as CSSProperties;

  return (
    <section
      className={styles.progress}
      aria-label="Assessment progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress.percentage}
      aria-valuetext={label}
      role="progressbar"
      style={progressStyle}
    >
      <div className={styles.progressMeta}>
        <span>Nutrition</span>
        <strong aria-live="polite">{label}</strong>
      </div>
      <div className={styles.strand} aria-hidden="true">
        <img
          className={styles.strandLayer}
          src={`${PREVIEW_ASSET_ROOT}/strand/hair-progress-base.webp`}
          alt=""
          width={2175}
          height={723}
        />
        <span className={styles.strandReveal}>
          <img
            className={styles.strandLayer}
            src={`${PREVIEW_ASSET_ROOT}/strand/hair-progress-active.webp`}
            alt=""
            width={2175}
            height={723}
          />
        </span>
      </div>
    </section>
  );
}

type PreviewOptionCardProps = {
  option: QuestionOption;
  selected: boolean;
  tabIndex: number;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

function PreviewOptionCard({
  option,
  selected,
  tabIndex,
  onSelect,
  onKeyDown,
}: PreviewOptionCardProps) {
  return (
    <button
      className={`${styles.optionCard} ${selected ? styles.optionCardSelected : ""}`}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <span>{option.label}</span>
      <span className={styles.radioIndicator} aria-hidden="true" />
    </button>
  );
}

type PreviewQuestionProps = {
  compact: boolean;
};

function PreviewQuestion({ compact }: PreviewQuestionProps) {
  const options = previewQuestion.options ?? [];
  const [selectedOption, setSelectedOption] = useState(options[1]?.id ?? options[0]?.id ?? "");
  const [hasContinued, setHasContinued] = useState(false);
  const progress = hasContinued ? previewProgress.continued : previewProgress.current;

  const moveSelection = (event: KeyboardEvent<HTMLButtonElement>, optionIndex: number) => {
    const keyMoves: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };

    let nextIndex: number | undefined;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (event.key in keyMoves) {
      nextIndex = (optionIndex + keyMoves[event.key] + options.length) % options.length;
    }
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextOption = options[nextIndex];
    if (!nextOption) return;
    setSelectedOption(nextOption.id);
    const group = event.currentTarget.closest('[role="radiogroup"]');
    group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  };

  return (
    <div className={`${styles.assessmentShell} ${compact ? styles.assessmentShellCompact : ""}`}>
      <header className={styles.assessmentHeader}>
        <div className={styles.brand} aria-label="Dr. FACT Hair Health Diagnostic">
          <span className={styles.brandMark} aria-hidden="true">DF</span>
          <span className={styles.brandCopy}>
            <strong>Dr. FACT</strong>
            <small>{compact ? "Hair Health" : "Hair Health Diagnostic"}</small>
          </span>
        </div>
        <span className={compact ? styles.privacyDot : styles.privacyNote}>
          {compact ? <span className={styles.srOnly}>Private and secure</span> : "Private & secure"}
        </span>
      </header>

      <HairGrowthProgress progress={progress} />

      <main className={styles.questionStage}>
        <div className={styles.questionCopy}>
          <span className={styles.questionNumber}>QUESTION 05</span>
          <h1>{previewQuestion.title}</h1>
          <p>{compact ? "Choose the answer closest to your usual week." : previewQuestion.subtitle}</p>
        </div>

        <div className={styles.optionGrid} role="radiogroup" aria-label="Protein-rich food frequency">
          {options.map((option, index) => (
            <PreviewOptionCard
              key={option.id}
              option={option}
              selected={selectedOption === option.id}
              tabIndex={selectedOption === option.id ? 0 : -1}
              onSelect={() => setSelectedOption(option.id)}
              onKeyDown={(event) => moveSelection(event, index)}
            />
          ))}
        </div>

        <footer className={styles.questionActions}>
          <button className={styles.backButton} type="button" onClick={() => setHasContinued(false)}>
            <span aria-hidden="true">←</span> Back
          </button>
          <button
            className={styles.continueButton}
            type="button"
            onClick={() => setHasContinued(true)}
            disabled={!selectedOption}
          >
            Continue <span aria-hidden="true">→</span>
          </button>
        </footer>
      </main>
    </div>
  );
}

function ChapterTransition() {
  return (
    <section className={styles.chapterTransition} aria-labelledby="nutrition-chapter-title">
      <picture className={styles.chapterPicture}>
        <source
          media="(max-width: 700px)"
          type="image/avif"
          srcSet={`${PREVIEW_ASSET_ROOT}/chapters/nutrition-mobile.avif 1x, ${PREVIEW_ASSET_ROOT}/chapters/nutrition-mobile@2x.avif 2x`}
        />
        <source
          media="(max-width: 700px)"
          type="image/webp"
          srcSet={`${PREVIEW_ASSET_ROOT}/chapters/nutrition-mobile.webp 1x, ${PREVIEW_ASSET_ROOT}/chapters/nutrition-mobile@2x.webp 2x`}
        />
        <source
          type="image/avif"
          srcSet={`${PREVIEW_ASSET_ROOT}/chapters/nutrition-desktop.avif 1x, ${PREVIEW_ASSET_ROOT}/chapters/nutrition-desktop@2x.avif 2x`}
        />
        <img
          src={`${PREVIEW_ASSET_ROOT}/chapters/nutrition-desktop.webp`}
          srcSet={`${PREVIEW_ASSET_ROOT}/chapters/nutrition-desktop.webp 1x, ${PREVIEW_ASSET_ROOT}/chapters/nutrition-desktop@2x.webp 2x`}
          alt="Amla, pomegranate, almonds, pumpkin seeds and leafy greens arranged in a dark ceramic bowl."
          width={1440}
          height={900}
        />
      </picture>
      <div className={styles.chapterScrim} aria-hidden="true" />
      <div className={styles.chapterCopy}>
        <span>CHAPTER 03</span>
        <h1 id="nutrition-chapter-title">Nutrition</h1>
        <p>How everyday nourishment supports stronger, healthier growth.</p>
        <Link className={styles.chapterButton} href="?view=desktop">
          Begin chapter <span aria-hidden="true">→</span>
        </Link>
      </div>
      <span className={styles.chapterIndex} aria-hidden="true">03</span>
    </section>
  );
}

type PreviewShellProps = {
  view: PreviewView;
};

function PreviewShell({ view }: PreviewShellProps) {
  return (
    <main className={styles.previewStudio} data-preview-view={view}>
      <header className={styles.studioBar}>
        <div className={styles.studioTitle}>
          <span>DESIGN PREVIEW</span>
          <strong>Assessment V3</strong>
        </div>
        <nav className={styles.viewSwitcher} aria-label="Preview mode">
          {(Object.keys(viewLabels) as PreviewView[]).map((previewView) => (
            <Link
              key={previewView}
              className={`${styles.viewLink} ${view === previewView ? styles.viewLinkActive : ""}`}
              href={`?view=${previewView}`}
              aria-current={view === previewView ? "page" : undefined}
              scroll={false}
            >
              {viewLabels[previewView]}
            </Link>
          ))}
        </nav>
      </header>

      <section className={styles.canvas} aria-label={`${viewLabels[view]} assessment preview`}>
        {view === "chapter" ? (
          <div className={styles.chapterFrame}>
            <ChapterTransition />
          </div>
        ) : (
          <div className={view === "mobile" ? styles.mobileFrame : styles.desktopFrame}>
            <PreviewQuestion compact={view === "mobile"} />
          </div>
        )}
      </section>
    </main>
  );
}

export function AssessmentV3Preview({ view }: PreviewShellProps) {
  return <PreviewShell view={view} />;
}
