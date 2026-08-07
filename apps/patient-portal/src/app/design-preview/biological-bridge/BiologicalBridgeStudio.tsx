'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';

import {
  BRIDGE_STAGES,
  BiologicalBridge,
  stageForProgress,
  type BridgeMode,
} from '@/components/design-preview/biological-bridge';

import styles from './studio.module.css';

const PRESETS = [10, 30, 50, 70, 90, 100] as const;
const HERO_PROGRESS = 62;

type ViewTab = 'hero' | 'assessment';

export function BiologicalBridgeStudio() {
  const [tab, setTab] = useState<ViewTab>('hero');
  const [progress, setProgress] = useState<number>(50);
  const [autoplay, setAutoplay] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const autoplayRef = useRef<number | null>(null);

  const stage = useMemo(() => stageForProgress(progress), [progress]);

  useEffect(() => {
    if (!autoplay) {
      if (autoplayRef.current) {
        window.clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
      return;
    }
    autoplayRef.current = window.setInterval(() => {
      setProgress((current) => {
        const next = current + 1.6;
        return next >= 100 ? 0 : next;
      });
    }, 90);
    return () => {
      if (autoplayRef.current) {
        window.clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
    };
  }, [autoplay]);

  const handlePreset = useCallback((value: number) => {
    setAutoplay(false);
    setProgress(value);
  }, []);

  const sliderStyle = {
    '--slider-progress': `${progress}%`,
  } as CSSProperties;

  return (
    <div className={styles.page}>
      <header className={styles.studioBar}>
        <div className={styles.studioTitle}>
          <span>DESIGN PREVIEW · Isolated approval prototype</span>
          <strong>Biological bridge · Dr. FACT</strong>
        </div>
        <nav className={styles.studioTabs} aria-label="Preview mode">
          <button
            type="button"
            className={`${styles.tabButton} ${tab === 'hero' ? styles.tabActive : ''}`}
            onClick={() => setTab('hero')}
          >
            Hero
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${tab === 'assessment' ? styles.tabActive : ''}`}
            onClick={() => setTab('assessment')}
          >
            Assessment progress
          </button>
        </nav>
      </header>

      {tab === 'assessment' && (
        <section className={styles.controls} aria-label="Progress controls">
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Progress</span>
            <input
              className={styles.slider}
              type="range"
              min={0}
              max={100}
              step={1}
              value={progress}
              onChange={(event) => {
                setAutoplay(false);
                setProgress(Number(event.target.value));
              }}
              aria-label="Assessment progress"
              style={sliderStyle}
            />
            <strong className={styles.value}>{Math.round(progress)}%</strong>
          </div>
          <div className={styles.presets} role="group" aria-label="Preset progress values">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`${styles.presetButton} ${
                  Math.round(progress) === preset ? styles.presetButtonActive : ''
                }`}
                onClick={() => handlePreset(preset)}
              >
                {preset}%
              </button>
            ))}
          </div>
          <div className={styles.toggleRow}>
            <button
              type="button"
              className={`${styles.toggle} ${autoplay ? styles.toggleActive : ''}`}
              onClick={() => setAutoplay((current) => !current)}
              aria-pressed={autoplay}
            >
              {autoplay ? (
                <>
                  <Pause size={13} aria-hidden="true" /> Pause autoplay
                </>
              ) : (
                <>
                  <Play size={13} aria-hidden="true" /> Autoplay stages
                </>
              )}
            </button>
            <button
              type="button"
              className={`${styles.toggle} ${reducedMotion ? styles.toggleActive : ''}`}
              onClick={() => setReducedMotion((current) => !current)}
              aria-pressed={reducedMotion}
            >
              <span className={styles.toggleDot} aria-hidden="true" />
              Reduced motion {reducedMotion ? 'on' : 'off'}
            </button>
          </div>
        </section>
      )}

      <section className={styles.surfaces}>
        {tab === 'hero' ? (
          <>
            <article className={styles.surfaceCard}>
              <header className={styles.surfaceHeader}>
                <div className={styles.surfaceLabel}>
                  <span>Hero · Desktop</span>
                  <strong>Landing artwork · ~{HERO_PROGRESS}% construction</strong>
                </div>
                <span className={styles.surfaceMeta}>
                  Full HTML copy · brand palette preserved
                </span>
              </header>
              <div className={styles.surfaceBody}>
                <div className={styles.heroStage}>
                  <div className={styles.heroCopy}>
                    <p className={styles.heroEyebrow}>Personalised hair pathway</p>
                    <h1 className={styles.heroHeadline}>
                      Understand what is <em>influencing</em> your hair.
                    </h1>
                    <p className={styles.heroSupport}>
                      Connect lifestyle, biology and scalp signals to build your
                      personalised recovery pathway.
                    </p>
                    <button type="button" className={styles.heroCta}>
                      Begin my hair evaluation
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <div className={styles.heroTrust}>
                      <span>~3 minutes</span>
                      <span>Private &amp; encrypted</span>
                      <span>Clinician-reviewed</span>
                    </div>
                  </div>
                  <div className={styles.heroArt}>
                    <BiologicalBridge
                      mode="hero"
                      progress={HERO_PROGRESS}
                      reducedMotion={reducedMotion}
                    />
                  </div>
                </div>
              </div>
            </article>

            <article className={styles.surfaceCard}>
              <header className={styles.surfaceHeader}>
                <div className={styles.surfaceLabel}>
                  <span>Hero · Mobile crop</span>
                  <strong>390 × 844 · single-column hero</strong>
                </div>
                <span className={styles.surfaceMeta}>Artwork upper, copy lower</span>
              </header>
              <div className={styles.surfaceBody}>
                <div className={styles.deviceHost}>
                  <span className={styles.deviceLabel}>Mobile · 390 × 844</span>
                  <div className={styles.mobileFrame}>
                    <div className={styles.mobileArt}>
                      <BiologicalBridge
                        mode="hero"
                        progress={HERO_PROGRESS}
                        reducedMotion={reducedMotion}
                      />
                    </div>
                    <div className={styles.mobileBody}>
                      <p className={styles.heroEyebrow}>Personalised hair pathway</p>
                      <h3>Understand what is influencing your hair.</h3>
                      <p>
                        Connect lifestyle, biology and scalp signals to build your
                        personalised recovery pathway.
                      </p>
                      <button type="button" className={styles.heroCta}>
                        Begin my hair evaluation
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </>
        ) : (
          <>
            <article className={styles.surfaceCard}>
              <header className={styles.surfaceHeader}>
                <div className={styles.surfaceLabel}>
                  <span>Assessment · Desktop</span>
                  <strong>{stage.title}</strong>
                </div>
                <span className={styles.surfaceMeta}>
                  Bridge is the progress indicator
                </span>
              </header>
              <div className={styles.surfaceBody}>
                <AssessmentSurface
                  progress={progress}
                  reducedMotion={reducedMotion}
                  mode="assessment"
                />
              </div>
            </article>

            <article className={styles.surfaceCard}>
              <header className={styles.surfaceHeader}>
                <div className={styles.surfaceLabel}>
                  <span>Assessment · Mobile crop</span>
                  <strong>390 × 844 · question shell frame</strong>
                </div>
                <span className={styles.surfaceMeta}>Follicle stays in frame</span>
              </header>
              <div className={styles.surfaceBody}>
                <div className={styles.frameStack}>
                  <div className={styles.deviceHost}>
                    <span className={styles.deviceLabel}>Mobile · 390 × 844</span>
                    <div className={styles.mobileFrame}>
                      <div className={styles.mobileArt}>
                        <BiologicalBridge
                          mode="assessment"
                          progress={progress}
                          reducedMotion={reducedMotion}
                        />
                      </div>
                      <div className={styles.mobileBody}>
                        <p className={styles.stageIndex}>
                          Chapter 0{stage.index} · Question 5 of 7
                        </p>
                        <h3>{stage.title}</h3>
                        <p>{stage.copy}</p>
                        <p className={styles.progressChip}>
                          <strong>{Math.round(progress)}%</strong>{' '}
                          <span aria-hidden="true">·</span> {stage.short}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className={styles.deviceHost}>
                    <span className={styles.deviceLabel}>
                      Reduced-motion · same content, no ambient animation
                    </span>
                    <div className={styles.mobileFrame}>
                      <div className={styles.mobileArt}>
                        <BiologicalBridge
                          mode="assessment"
                          progress={progress}
                          reducedMotion
                        />
                      </div>
                      <div className={styles.mobileBody}>
                        <p className={styles.stageIndex}>Reduced motion</p>
                        <h3>{stage.title}</h3>
                        <p>{stage.copy}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </>
        )}

        <article className={styles.surfaceCard}>
          <header className={styles.surfaceHeader}>
            <div className={styles.surfaceLabel}>
              <span>Narrative &amp; delivery notes</span>
              <strong>Approval context</strong>
            </div>
            <span className={styles.surfaceMeta}>Isolated route · production untouched</span>
          </header>
          <div className={styles.surfaceBody}>
            <div className={styles.notesCard}>
              <h4>Narrative</h4>
              <p>
                Different biological and lifestyle pressures can disrupt the hair-health
                pathway. As the patient answers questions, Dr. FACT connects those signals
                and constructs a clearer personalised recovery pathway. The bridge is the
                pathway — not a claim of instant cellular repair.
              </p>
              <h4 style={{ marginTop: 18 }}>Asset expectations</h4>
              <ul>
                <li>
                  Reference PNG must live at{' '}
                  <span className={styles.assetPath}>
                    /public/design-preview/biological-bridge/reference-hero.png
                  </span>
                </li>
                <li>
                  Ideal production pair: two aligned plates (unresolved-desktop,
                  complete-desktop) sharing camera, geometry, follicle positions and
                  lighting so the reveal mask stacks cleanly.
                </li>
                <li>
                  Mobile plate should re-crop with the primary follicle inside the safe
                  frame (approximately 62% × 42% object-position on the shared master).
                </li>
              </ul>
              <h4 style={{ marginTop: 18 }}>Production safety</h4>
              <p>
                This route is isolated. HairProgressV3, QuestionnaireShellV3,
                ChapterTransitionV3, the questionnaire runtime and the production landing
                page were not modified.
              </p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

type AssessmentSurfaceProps = {
  progress: number;
  reducedMotion: boolean;
  mode: BridgeMode;
};

function AssessmentSurface({ progress, reducedMotion, mode }: AssessmentSurfaceProps) {
  const stage = stageForProgress(progress);
  return (
    <div className={styles.assessmentStage}>
      <div className={styles.assessmentArt}>
        <BiologicalBridge
          mode={mode}
          progress={progress}
          reducedMotion={reducedMotion}
        />
      </div>
      <div className={styles.assessmentMeta}>
        <div className={styles.stageBlock}>
          <span className={styles.stageIndex}>
            Chapter 0{stage.index} of 5 · {stage.short}
          </span>
          <h2 className={styles.stageTitle}>{stage.title}</h2>
          <p className={styles.stageCopy}>{stage.copy}</p>
        </div>
        <span className={styles.progressChip}>
          <strong>{Math.round(progress)}%</strong>{' '}
          <span aria-hidden="true">·</span> {stage.short}
        </span>
      </div>
      <div className={styles.timeline} role="list" aria-label="Assessment stages">
        {BRIDGE_STAGES.map((step) => {
          const isActive = step.id === stage.id;
          const isDone = step.range[1] <= progress;
          const fill = isDone ? 1 : isActive ? Math.max(0, Math.min(1, (progress - step.range[0]) / (step.range[1] - step.range[0]))) : 0;
          return (
            <div
              key={step.id}
              role="listitem"
              className={`${styles.timelineStep} ${isActive ? styles.timelineStepActive : ''} ${
                isDone ? styles.timelineStepDone : ''
              }`}
            >
              <span className={styles.timelineIndex}>0{step.index}</span>
              <span className={styles.timelineTitle}>{step.short}</span>
              <span className={styles.timelineBar} aria-hidden="true">
                <span style={{ transform: `scaleX(${fill})` }} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
