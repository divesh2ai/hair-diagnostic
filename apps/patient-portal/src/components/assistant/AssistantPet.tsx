"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Minus } from "lucide-react";
import styles from "./AssistantPet.module.css";

export type AssistantPetState = "idle" | "listening" | "thinking" | "notebook" | "coffee" | "answering" | "success" | "wink" | "wave" | "dance" | "caution" | "error" | "sleep" | "minimized";
type AssistantPetBehaviour = "neutral" | "blink" | "double-blink" | "slow-blink" | "look-left" | "look-right" | "look-up" | "head-tilt" | "coat-adjust" | "stethoscope-check" | "tiny-wave" | "waking";

export interface AssistantPetProps {
  state: AssistantPetState;
  size?: "sm" | "md" | "lg";
  mode?: "doctor" | "patient";
  interactive?: boolean;
  reducedMotion?: boolean;
  onActivate?: () => void;
  onHover?: () => void;
  label?: string;
  className?: string;
}

const STATE_LABELS: Record<AssistantPetState, string> = {
  idle: "Assistant is ready — tap to dance",
  listening: "Assistant is listening",
  thinking: "Assistant is checking the evidence",
  notebook: "Assistant is taking notes",
  coffee: "Assistant is taking a short coffee break",
  answering: "Assistant is answering",
  success: "Assistant completed the request",
  wink: "Assistant is winking",
  wave: "Assistant is waving hello",
  dance: "Assistant is celebrating",
  caution: "Assistant recommends caution",
  error: "Assistant needs you to try again",
  sleep: "Assistant is inactive",
  minimized: "Restore assistant companion",
};

const AUTHORED_STATE_ROWS: Record<AssistantPetState, { row: number; frames: number; interval: number }> = {
  idle: { row: 0, frames: 6, interval: 360 },
  listening: { row: 6, frames: 6, interval: 280 },
  thinking: { row: 7, frames: 6, interval: 300 },
  notebook: { row: 8, frames: 6, interval: 430 },
  coffee: { row: 7, frames: 6, interval: 520 },
  answering: { row: 6, frames: 6, interval: 340 },
  success: { row: 4, frames: 5, interval: 180 },
  wink: { row: 0, frames: 7, interval: 170 },
  wave: { row: 3, frames: 4, interval: 310 },
  dance: { row: 4, frames: 5, interval: 170 },
  caution: { row: 5, frames: 8, interval: 260 },
  error: { row: 5, frames: 8, interval: 260 },
  sleep: { row: 5, frames: 8, interval: 520 },
  minimized: { row: 0, frames: 1, interval: 1000 },
};

function AuthoredPetArtwork({ state, reducedMotion }: { state: AssistantPetState; reducedMotion: boolean }) {
  const animation = AUTHORED_STATE_ROWS[state];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (reducedMotion || animation.frames <= 1) return;
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % animation.frames), animation.interval);
    return () => window.clearInterval(timer);
  }, [animation.frames, animation.interval, reducedMotion, state]);

  const spriteStyle = {
    "--atlas-col": frame,
    "--atlas-row": animation.row,
  } as CSSProperties;

  return (
    <span className={styles.atlasViewport} role="presentation">
      <img
        className={styles.atlasImage}
        src="/assistant/dr-fact-v2/spritesheet-premium-v2.webp"
        alt=""
        draggable={false}
        style={spriteStyle}
      />
    </span>
  );
}

function PetArtwork() {
  return (
    <svg className={styles.artwork} viewBox="0 0 80 100" preserveAspectRatio="xMidYMid meet" role="presentation" focusable="false">
      <defs>
        <radialGradient id="pet-shell" cx="0" cy="0" r="1" gradientTransform="translate(27 18) rotate(51) scale(72 64)" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity=".9" />
          <stop offset=".22" stopColor="var(--pet-shell-highlight)" />
          <stop offset=".68" stopColor="var(--pet-shell)" />
          <stop offset="1" stopColor="var(--pet-shell-shadow)" />
        </radialGradient>
        <linearGradient id="pet-face" x1="25" y1="31" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--pet-face-top)" />
          <stop offset="1" stopColor="var(--pet-face-bottom)" />
        </linearGradient>
        <linearGradient id="pet-apron" x1="31" y1="57" x2="50" y2="84" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset=".5" stopColor="#f3fbfa" />
          <stop offset="1" stopColor="#d8ecea" />
        </linearGradient>
        <linearGradient id="pet-shirt" x1="36" y1="58" x2="44" y2="84" gradientUnits="userSpaceOnUse">
          <stop stopColor="#203442" />
          <stop offset="1" stopColor="#091823" />
        </linearGradient>
      </defs>
      <ellipse className={styles.shadow} cx="40" cy="96.5" rx="22" ry="3" />
      <g className={styles.petBody}>
        <g className={styles.fullBody}>
          <g className={`${styles.armLeftUnit} ${styles.greetingArmRig}`}>
            <circle className={styles.shoulderJointLeft} cx="25.5" cy="62.5" r="3.2" />
            <g className={styles.greetingUpperArm}>
              <path className={`${styles.armLeft} ${styles.coatSleeve}`} fill="url(#pet-apron)" d="M27.5 59.2c-5.3-.2-9.2 2.4-11.9 7.2l4.6 5.2c2.2-3.9 5.2-6 9.1-6.4l-1.8-6Z" />
              <path className={styles.sleeveSeam} d="M19.7 66.8c2.2-1.8 4.5-2.8 7-3" />
              <g className={styles.greetingForearm}>
                <path className={`${styles.armLeft} ${styles.coatSleeve}`} fill="url(#pet-apron)" d="M16 66c-2.7 3.8-4.4 9-3.7 14.3.4 3.5 2.2 5.7 5 6 2.8.2 5-2 5.7-5.2.7-3.5-.1-7-2.8-10.1L16 66Z" />
                <path className={styles.elbowCrease} d="M15.2 70.4c2.2.2 4.1 1.2 5.7 3" />
                <path className={styles.coatCuff} d="M12.7 78.2c-.2 4 1.5 7 4.6 8.1 2.2.2 4.3-1.7 5.2-5l-1-4.1-8.8 1Z" />
                <g className={`${styles.rightWaveHand} ${styles.greetingWrist}`}>
                  <path className={styles.handLeft} d="M12.8 83.6c-.3-1 .2-2 1.2-2.1l.4-3c.1-.8 1.1-.8 1.2 0l.1 2.1.7-3.2c.2-.8 1.2-.6 1.1.2l-.3 3 .9-2.4c.3-.7 1.3-.3 1 .5l-.6 2.5 1.2-1.5c.5-.6 1.3 0 .9.6L19 83.4c-.8 1.7-2.3 2.5-4 2l-.9-.2c-.7-.2-1.1-.7-1.3-1.6Z" />
                  <path className={styles.handPalmDetail} d="M14.5 81.2c1.4.6 2.8.8 4.2.3" />
                </g>
              </g>
            </g>
          </g>
          <g className={styles.armRightUnit}>
            <circle className={styles.shoulderJointRight} cx="54.5" cy="62.5" r="3.2" />
            <circle className={styles.handRight} cx="63.5" cy="84" r="3.4" />
            <path className={`${styles.armRight} ${styles.coatSleeve}`} fill="url(#pet-apron)" d="M55 59c7 1 12 6 14 14 1 5 1 9-2 12-2 2-6 2-8 0-2-2-2-5-3-9-1-4-3-7-6-9l5-8Z" />
            <path className={styles.coatCuff} d="M67 78c0 4-2 7-5 8-2 0-4-2-5-5l1-4 9 1Z" />
          </g>
          <path className={styles.torso} d="M25 57c2-5 8-8 15-8s13 3 15 8l3 16c1 7-3 12-9 13H31c-6-1-10-6-9-13l3-16Z" />
          <path className={styles.torsoHighlight} d="M29 59c3-4 7-5 11-5 5 0 8 1 11 5" />
          <path className={styles.legLeft} d="M27 80v9c-1 4 1 6 5 6h4c3 0 4-2 4-5v-9l-13-1Z" />
          <path className={styles.legRight} d="M40 81v9c0 3 1 5 4 5h4c4 0 6-2 5-6v-9l-13 1Z" />
          <g className={styles.doctorApron}>
            <path className={styles.apronBody} fill="url(#pet-apron)" d="M27 58c3-3 7-4 10-4l3 6 3-6c4 0 7 1 10 4l3 24c-3 4-9 6-16 5-7 1-13-1-16-5l3-24Z" />
            <path className={styles.innerShirt} fill="url(#pet-shirt)" d="M35 56l5 7 5-7 2 28c-2 1-4 1-7 1s-5 0-7-1l2-28Z" />
            <path className={styles.apronLapelLeft} d="M31 56l9 7-5 7-7-11 3-3Z" />
            <path className={styles.apronLapelRight} d="M49 56l-9 7 5 7 7-11-3-3Z" />
            <path className={styles.shirtButton} d="M40 69h.01M40 75h.01M40 81h.01" />
            <path className={styles.apronPocketLeft} d="M27.5 73h7.5v8h-6.5" />
            <path className={styles.apronPocketRight} d="M45 73h7.5l-1 8H45" />
            <path className={styles.stethoscopeTube} d="M32.5 58.5v5c0 6 3 9.5 7.5 9.5s7.5-3.5 7.5-9.5v-5" />
            <g className={styles.stethoscopePendant}>
              <path className={styles.stethoscopeTube} d="M40 72.5c1 4.5-.5 8.5-4.5 11.5" />
              <circle className={styles.stethoscopeChest} cx="34.8" cy="85" r="4" />
              <circle className={styles.stethoscopeChestRing} cx="34.8" cy="85" r="2.15" />
              <circle className={styles.stethoscopeChestHighlight} cx="33.6" cy="83.7" r="1.05" />
            </g>
            <rect className={styles.apronBadge} x="46" y="74.5" width="5" height="4.8" rx="1.2" />
            <path className={styles.apronCross} d="M48.5 75.5v2.8M47.1 76.9h2.8" />
          </g>
          <path className={styles.footLineLeft} d="M29 92c3 1 7 1 10 0" />
          <path className={styles.footLineRight} d="M41 92c3 1 7 1 10 0" />
        </g>
        <g className={styles.head}>
          <path className={styles.sideGlowLeft} d="M10 34c-4 2-5 7-4 12 1 4 3 7 7 8l3-18-6-2Z" />
          <path className={styles.sideGlowRight} d="M70 34c4 2 5 7 4 12-1 4-3 7-7 8l-3-18 6-2Z" />
          <path className={styles.shell} fill="url(#pet-shell)" d="M40 4c6 0 10 2 14 6 6-1 11 2 13 7 5 2 8 7 7 12 3 4 2 10-1 14 1 8-4 15-11 18-5 4-12 6-22 6s-17-2-22-6C11 58 6 51 7 43c-3-4-4-10-1-14-1-5 2-10 7-12 2-5 7-8 13-7 4-4 8-6 14-6Z" />
          <path className={styles.shellRim} d="M19 30c4-8 11-13 21-13s17 5 21 13" />
          <path className={styles.shellSpecular} d="M18 22c5-7 12-11 21-11" />
          <rect className={styles.facePanel} x="15.5" y="26" width="49" height="34" rx="13.5" fill="url(#pet-face)" />
          <rect className={styles.faceReflection} x="20" y="29" width="40" height="3" rx="1.5" />
          <g className={styles.eyes}>
            <path className={`${styles.eye} ${styles.eyeLeft}`} d="M27 42.5c1.8 2.7 5.2 2.7 7 0" />
            <path className={`${styles.eye} ${styles.eyeRight}`} d="M46 42.5c1.8 2.7 5.2 2.7 7 0" />
          </g>
          <path className={styles.cautionMark} d="M40 39v7m0 4h.01" />
          <circle className={styles.templeLight} cx="59" cy="47" r="1.7" />
        </g>
        <g className={styles.waveMotion} aria-hidden="true">
          <path d="m-19 36-4-2m5-5-3-5m9 2v-6m6 7 3-5" />
        </g>
        <g className={styles.waveHelloBadge} aria-hidden="true">
          <rect x="55" y="8" width="25" height="16" rx="8" />
          <path d="m58 20-6 6 9-3" />
          <text x="67.5" y="18.8" textAnchor="middle">Hi!</text>
        </g>
      </g>
    </svg>
  );
}

function PremiumPetArtwork() {
  return (
    <svg className={`${styles.artwork} ${styles.premiumArtwork}`} viewBox="0 0 80 100" preserveAspectRatio="xMidYMid meet" role="presentation" focusable="false">
      <ellipse className={styles.factShadow} cx="40" cy="95.5" rx="17" ry="2.3" />
      <g className={styles.factFloat}>
        <g className={styles.factStethoscopeTail}>
          <path className={styles.factStethoscopeTube} d="M34 63v5c0 7 3 11 8 11 4 0 6-3 6-9m0 0c7 0 13 4 15 10" />
          <circle className={styles.factStethoscopeTip} cx="64.2" cy="82.5" r="3.2" />
          <circle className={styles.factStethoscopeTipInner} cx="64.2" cy="82.5" r="1.45" />
        </g>

        <g className={styles.factCompactBody}>
          <path className={styles.factBodyShell} d="M30 59h20c4 3 6 8 6 14v8c0 6-4 9-10 9H34c-6 0-10-3-10-9v-8c0-6 2-11 6-14Z" />
          <path className={styles.factBodyAccent} d="M27 68c4 2 8 3 13 3 6 0 10-1 14-4v14c0 4-3 6-8 6H34c-5 0-8-2-8-6l1-13Z" />
          <g className={styles.factInsignia}>
            <circle cx="40" cy="78" r="3.5" />
            <path d="M40 75.8v4.4m-2.2-2.2h4.4" />
          </g>
        </g>

        <g className={`${styles.factTinyHand} ${styles.factHandLeft}`}>
          <circle cx="23" cy="73" r="2.8" />
          <path d="m20.6 71.6-1.8-1m3.2.1-.5-2m2.2 2 .7-1.8" />
        </g>
        <g className={`${styles.factTinyHand} ${styles.factHandRight}`}>
          <circle cx="57" cy="73" r="2.8" />
          <path d="m59.4 71.6 1.8-1m-3.2.1.5-2m-2.2 2-.7-1.8" />
        </g>

        <g className={styles.factHead}>
          <path className={styles.factOuterShell} d="M38 6C55 4 68 13 72 28c2 10 1 20-4 28-5 8-14 12-26 13-15 1-27-4-33-14-4-8-4-18-1-27C12 15 23 7 36 7l2-1Z" />
          <path className={styles.factSecondaryShell} d="M62 16c6 6 9 14 9 24 0 13-7 22-18 26 7-7 10-15 10-25 0-9-2-17-6-23l5-2Z" />
          <path className={styles.factShellHighlight} d="M17 19c6-7 14-10 24-10 7 0 13 2 18 5" />
          <path className={styles.factFaceGlass} d="M27 17h27c10 0 16 7 16 17v4c0 11-7 18-18 18H27C16 56 9 49 9 38v-2c0-12 7-19 18-19Z" />
          <path className={styles.factGlassReflection} d="M19 22c7-3 18-4 31-3 6 0 11 2 14 5" />
          <g className={styles.factEyeLook}>
            <g className={styles.factNeutralEyes}>
              <rect className={`${styles.factEye} ${styles.factEyeLeft}`} x="23.5" y="35.2" width="10.5" height="4.3" rx="2.15" />
              <rect className={`${styles.factEye} ${styles.factEyeRight}`} x="46.5" y="34.9" width="10.5" height="4.3" rx="2.15" />
            </g>
            <g className={styles.factHappyEyes}>
              <path d="M23.5 36.2q5.2 5 10.5 0m12.5-.3q5.2 5 10.5 0" />
            </g>
          </g>
          <circle className={styles.factTempleLight} cx="63.2" cy="46.5" r="1.4" />
        </g>

        <g className={styles.factWaveHand}>
          <path className={styles.factMicroArm} d="M27 69c-5-1-10-5-13-10" />
          <circle className={styles.factMicroPalm} cx="12" cy="57.5" r="3.2" />
          <path className={styles.factMicroFingers} d="m9.8 55.4-1.8-1.8m3.2 1-.4-2.5m2.2 2.8.8-2.3m.4 3.4 1.8-1.3" />
        </g>

        <g className={styles.factThinkingHand}>
          <path className={styles.factMicroArm} d="M54 69c2-3 3-6 2-9" />
          <circle className={styles.factMicroPalm} cx="56" cy="58" r="3" />
          <path className={styles.factMicroFingers} d="m54 56-1-1.8m2.6 1.5.1-2m1.4 2.4 1-1.5" />
        </g>

        <g className={styles.factClapHands}>
          <g className={styles.factClapLeft}><circle cx="34" cy="76" r="2.7" /><path d="m32.4 73.8-.8-1.4m2.4 1.1.1-1.7" /></g>
          <g className={styles.factClapRight}><circle cx="46" cy="76" r="2.7" /><path d="m47.6 73.8.8-1.4m-2.4 1.1-.1-1.7" /></g>
        </g>
      </g>
    </svg>
  );
}

const PREMIUM_FACT_ARTWORK = false;

export function AssistantPet({ state, size = "md", mode = "patient", interactive = false, reducedMotion = false, onActivate, onHover, label, className = "" }: AssistantPetProps) {
  const rootClassName = `${styles.pet} ${styles[size]} ${reducedMotion ? styles.reducedMotion : ""} ${className}`;
  const rootRef = useRef<HTMLElement | null>(null);
  const [behaviour, setBehaviour] = useState<AssistantPetBehaviour>("neutral");
  const lastBehaviourRef = useRef<AssistantPetBehaviour>("neutral");
  const previousStateRef = useRef<AssistantPetState>(state);
  const hoverStartedAtRef = useRef(0);
  const hoverReactedRef = useRef(false);
  const setRootRef = useCallback((node: HTMLButtonElement | HTMLSpanElement | null) => { rootRef.current = node; }, []);

  useEffect(() => {
    const previousState = previousStateRef.current;
    previousStateRef.current = state;
    if (reducedMotion) return;
    if (previousState === "sleep" && state === "idle") {
      const wakeStartTimer = window.setTimeout(() => setBehaviour("waking"), 0);
      const wakeTimer = window.setTimeout(() => setBehaviour("neutral"), 900);
      return () => { window.clearTimeout(wakeStartTimer); window.clearTimeout(wakeTimer); };
    }
    if (state !== "idle") {
      const resetTimer = window.setTimeout(() => setBehaviour("neutral"), 0);
      return () => window.clearTimeout(resetTimer);
    }

    let actionTimer = 0;
    let resetTimer = 0;
    const choices: AssistantPetBehaviour[] = ["blink", "blink", "double-blink", "slow-blink", "look-left", "look-right", "look-up", "head-tilt", "coat-adjust", "stethoscope-check", "tiny-wave"];
    const schedule = () => {
      const calmDelay = 2500 + Math.random() * 5500;
      actionTimer = window.setTimeout(() => {
        const available = choices.filter((choice) => choice !== lastBehaviourRef.current);
        const next = available[Math.floor(Math.random() * available.length)] ?? "blink";
        lastBehaviourRef.current = next;
        setBehaviour(next);
        const duration = next === "slow-blink" ? 850 : next === "tiny-wave" ? 1050 : 620;
        resetTimer = window.setTimeout(() => { setBehaviour("neutral"); schedule(); }, duration);
      }, calmDelay);
    };
    schedule();
    return () => { window.clearTimeout(actionTimer); window.clearTimeout(resetTimer); };
  }, [reducedMotion, state]);

  useEffect(() => {
    if (reducedMotion || state === "sleep" || state === "minimized") return;
    let frame = 0;
    let headTimer = 0;
    const lookTowardPointer = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = rootRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height * .4;
        const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
        const dx = distance > 220 ? 0 : Math.max(-2.1, Math.min(2.1, (event.clientX - centerX) / 70));
        const dy = distance > 220 ? 0 : Math.max(-1.45, Math.min(1.45, (event.clientY - centerY) / 85));
        root.style.setProperty("--fact-look-x", `${dx.toFixed(2)}px`);
        root.style.setProperty("--fact-look-y", `${dy.toFixed(2)}px`);
        root.style.setProperty("--pet-eye-x", `${dx.toFixed(2)}px`);
        root.style.setProperty("--pet-eye-y", `${dy.toFixed(2)}px`);
        window.clearTimeout(headTimer);
        headTimer = window.setTimeout(() => {
          root.style.setProperty("--pet-head-x", `${(dx * .38).toFixed(2)}px`);
          root.style.setProperty("--pet-head-y", `${(dy * .25).toFixed(2)}px`);
        }, 110);

        if (distance <= Math.max(rect.width, rect.height) * .55) {
          if (!hoverStartedAtRef.current) hoverStartedAtRef.current = performance.now();
          const hoverDuration = performance.now() - hoverStartedAtRef.current;
          root.dataset.proximity = hoverDuration > 1000 ? "hover" : "near";
          if (hoverDuration > 2400 && !hoverReactedRef.current && state === "idle") {
            hoverReactedRef.current = true;
            setBehaviour(Math.random() < .7 ? "head-tilt" : "tiny-wave");
          }
        } else {
          hoverStartedAtRef.current = 0;
          hoverReactedRef.current = false;
          root.dataset.proximity = distance < 220 ? "near" : "far";
        }
      });
    };
    window.addEventListener("pointermove", lookTowardPointer, { passive: true });
    return () => { window.removeEventListener("pointermove", lookTowardPointer); cancelAnimationFrame(frame); window.clearTimeout(headTimer); };
  }, [reducedMotion, state]);

  const content = <AuthoredPetArtwork state={state} reducedMotion={reducedMotion} />;
  const renderedBehaviour = reducedMotion || state !== "idle" ? "neutral" : behaviour;
  return interactive ? (
    <button ref={setRootRef} type="button" className={`${rootClassName} ${styles.interactive}`} data-state={state} data-behaviour={renderedBehaviour} data-mode={mode} aria-label={label ?? STATE_LABELS[state]} onClick={onActivate} onPointerEnter={state === "sleep" ? onActivate : onHover}>{content}</button>
  ) : <span ref={setRootRef} className={rootClassName} data-state={state} data-behaviour={renderedBehaviour} data-mode={mode} aria-hidden="true">{content}</span>;
}

export function AssistantPetMinimized(props: Omit<AssistantPetProps, "state" | "size">) {
  return <AssistantPet {...props} state="minimized" size="sm" interactive label="Restore assistant companion" />;
}

export function AssistantPetTooltip({ state, children }: { state: AssistantPetState; children: ReactNode }) {
  return <span className={styles.tooltipHost}>{children}<span className={styles.tooltip} role="tooltip">{STATE_LABELS[state]}</span></span>;
}

interface AssistantPetControllerProps {
  state: AssistantPetState;
  mode?: "doctor" | "patient";
  minimized: boolean;
  reducedMotion?: boolean;
  onWake: () => void;
  onPlay?: () => void;
  onWink?: () => void;
  onMinimize: () => void;
}

export function AssistantPetController({ state, mode = "patient", minimized, reducedMotion, onWake, onPlay, onWink, onMinimize }: AssistantPetControllerProps) {
  if (minimized) return <AssistantPetTooltip state="minimized"><AssistantPetMinimized mode={mode} reducedMotion={reducedMotion} onActivate={onWake} /></AssistantPetTooltip>;
  return (
    <div className={styles.dock}>
      <AssistantPetTooltip state={state}><AssistantPet state={state} size="lg" mode={mode} interactive reducedMotion={reducedMotion} onActivate={state === "sleep" ? onWake : (onPlay ?? onWake)} onHover={onWink} /></AssistantPetTooltip>
      <button type="button" className={styles.minimizeButton} onClick={onMinimize} aria-label="Minimize assistant companion"><Minus aria-hidden="true" /></button>
    </div>
  );
}

export function useAssistantPetController(inactiveAfterMs = 60_000) {
  const [state, setState] = useState<AssistantPetState>("idle");
  const [minimized, setMinimized] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transientRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTransient = useCallback(() => {
    if (transientRef.current) clearTimeout(transientRef.current);
    transientRef.current = null;
  }, []);
  const resetInactivity = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState((current) => ["thinking", "answering", "caution", "error"].includes(current) ? current : "sleep"), inactiveAfterMs);
  }, [inactiveAfterMs]);
  const transition = useCallback((next: AssistantPetState, returnToIdleAfterMs?: number) => {
    clearTransient(); setState(next); resetInactivity();
    if (returnToIdleAfterMs) transientRef.current = setTimeout(() => setState("idle"), returnToIdleAfterMs);
  }, [clearTransient, resetInactivity]);
  const wake = useCallback(() => { setMinimized(false); transition("idle"); }, [transition]);

  useEffect(() => {
    resetInactivity();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); clearTransient(); };
  }, [clearTransient, resetInactivity]);

  return {
    state, minimized, transition, wake,
    minimize: () => setMinimized(true),
    listen: () => transition("listening"), idle: () => transition("idle"), think: () => transition("thinking"),
    answer: () => transition("answering"), succeed: () => transition("success", 1100), wink: () => transition("wink", 720), play: () => transition("dance", 1500), caution: () => transition("caution"), fail: () => transition("error"),
  };
}
