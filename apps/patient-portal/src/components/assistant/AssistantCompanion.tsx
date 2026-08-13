"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { Activity, Coffee, Minus, Move, NotebookPen, PersonStanding, RotateCcw } from "lucide-react";
import { AssistantPet, type AssistantPetState } from "./AssistantPet";
import styles from "./AssistantCompanion.module.css";

export type CompanionState =
  | "idle-perched"
  | "roaming"
  | "listening"
  | "thinking"
  | "note-taking"
  | "coffee-break"
  | "answering"
  | "guide-mode"
  | "success"
  | "greeting"
  | "caution"
  | "error"
  | "sleep"
  | "page-transition"
  | "minimized";

export type CompanionMode = "doctor" | "patient" | "general";
export type CompanionAnchorId = "bottom-left" | "bottom-right" | "composer" | "suggested-prompts" | "sources" | string;

interface CompanionSnapshot {
  state: CompanionState;
  mode: CompanionMode;
  anchorId: CompanionAnchorId;
  minimized: boolean;
  motionReduced: boolean;
}

type CompanionEvent =
  | { type: "TRANSITION"; state: CompanionState; anchorId?: CompanionAnchorId }
  | { type: "SET_MODE"; mode: CompanionMode }
  | { type: "MINIMIZE" }
  | { type: "RESTORE" }
  | { type: "TOGGLE_MOTION" }
  | { type: "SET_MOTION"; reduced: boolean };

const initialSnapshot: CompanionSnapshot = {
  state: "idle-perched",
  mode: "general",
  anchorId: "bottom-right",
  minimized: false,
  motionReduced: false,
};

export const AssistantCompanionStateMachine = {
  initialState: initialSnapshot,
  transition(snapshot: CompanionSnapshot, event: CompanionEvent): CompanionSnapshot {
    switch (event.type) {
      case "TRANSITION":
        return { ...snapshot, state: event.state, anchorId: event.anchorId ?? snapshot.anchorId };
      case "SET_MODE":
        return { ...snapshot, mode: event.mode };
      case "MINIMIZE":
        return { ...snapshot, minimized: true, state: "minimized" };
      case "RESTORE":
        return { ...snapshot, minimized: false, state: "idle-perched" };
      case "TOGGLE_MOTION":
        return { ...snapshot, motionReduced: !snapshot.motionReduced };
      case "SET_MOTION":
        return { ...snapshot, motionReduced: event.reduced };
      default:
        return snapshot;
    }
  },
};

interface CompanionContextValue extends CompanionSnapshot {
  transition: (state: CompanionState, anchorId?: CompanionAnchorId, returnToIdleAfterMs?: number) => void;
  listen: (anchorId?: CompanionAnchorId) => void;
  think: (anchorId?: CompanionAnchorId) => void;
  takeNotes: (anchorId?: CompanionAnchorId) => void;
  answer: (anchorId?: CompanionAnchorId) => void;
  guide: (anchorId: CompanionAnchorId) => void;
  succeed: () => void;
  wave: (anchorId?: CompanionAnchorId) => void;
  caution: () => void;
  fail: () => void;
  setMode: (mode: CompanionMode) => void;
  minimize: () => void;
  restore: () => void;
  toggleReducedMotion: () => void;
}

const AssistantCompanionContext = createContext<CompanionContextValue | null>(null);

function reducer(snapshot: CompanionSnapshot, event: CompanionEvent) {
  return AssistantCompanionStateMachine.transition(snapshot, event);
}

const SUPPORTED_PATHS = ["/assistant", "/doctor", "/patient", "/assessment", "/reports"];

export function AssistantCompanionProvider({ children }: { children: ReactNode }) {
  const [snapshot, dispatch] = useReducer(reducer, initialSnapshot);
  const pathname = usePathname();
  const previousPathRef = useRef(pathname);
  const transientRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coffeeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageReadyRef = useRef(false);

  const clearTransient = useCallback(() => {
    if (transientRef.current) clearTimeout(transientRef.current);
    transientRef.current = null;
  }, []);

  const resetSleep = useCallback(() => {
    if (sleepRef.current) clearTimeout(sleepRef.current);
    if (snapshot.minimized) return;
    sleepRef.current = setTimeout(() => {
      dispatch({ type: "TRANSITION", state: "sleep", anchorId: snapshot.anchorId });
    }, 60_000);
  }, [snapshot.anchorId, snapshot.minimized]);

  const transition = useCallback((state: CompanionState, anchorId?: CompanionAnchorId, returnToIdleAfterMs?: number) => {
    clearTransient();
    dispatch({ type: "TRANSITION", state, anchorId });
    resetSleep();
    if (returnToIdleAfterMs) {
      transientRef.current = setTimeout(() => dispatch({ type: "TRANSITION", state: "idle-perched" }), returnToIdleAfterMs);
    }
  }, [clearTransient, resetSleep]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("drfact-companion-preferences");
      if (saved) {
        const preferences = JSON.parse(saved) as { minimized?: boolean; motionReduced?: boolean };
        if (preferences.motionReduced) dispatch({ type: "SET_MOTION", reduced: true });
        if (preferences.minimized) dispatch({ type: "MINIMIZE" });
      }
    } catch { /* Preference storage is optional. */ }
    queueMicrotask(() => { storageReadyRef.current = true; });
  }, []);

  useEffect(() => {
    if (!storageReadyRef.current) return;
    try {
      window.localStorage.setItem("drfact-companion-preferences", JSON.stringify({ minimized: snapshot.minimized, motionReduced: snapshot.motionReduced }));
    } catch { /* Preference storage is optional. */ }
  }, [snapshot.minimized, snapshot.motionReduced]);

  useEffect(() => {
    const handleCompanionEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: CompanionState; anchorId?: CompanionAnchorId; mode?: CompanionMode; action?: "minimize" | "restore" | "toggle-motion" }>).detail;
      if (!detail) return;
      if (detail.mode) dispatch({ type: "SET_MODE", mode: detail.mode });
      if (detail.action === "minimize") dispatch({ type: "MINIMIZE" });
      else if (detail.action === "restore") dispatch({ type: "RESTORE" });
      else if (detail.action === "toggle-motion") dispatch({ type: "TOGGLE_MOTION" });
      else if (detail.state) transition(detail.state, detail.anchorId);
    };
    window.addEventListener("drfact:companion", handleCompanionEvent);
    return () => window.removeEventListener("drfact:companion", handleCompanionEvent);
  }, [transition]);

  useEffect(() => {
    if (previousPathRef.current !== pathname) {
      dispatch({ type: "TRANSITION", state: "page-transition", anchorId: "bottom-right" });
      transientRef.current = setTimeout(() => dispatch({ type: "TRANSITION", state: "idle-perched" }), 720);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    const markActivity = () => {
      if (snapshot.state === "sleep") dispatch({ type: "TRANSITION", state: "idle-perched" });
      resetSleep();
    };
    window.addEventListener("pointerdown", markActivity, { passive: true });
    window.addEventListener("keydown", markActivity);
    resetSleep();
    return () => {
      window.removeEventListener("pointerdown", markActivity);
      window.removeEventListener("keydown", markActivity);
      if (sleepRef.current) clearTimeout(sleepRef.current);
    };
  }, [resetSleep, snapshot.state]);

  useEffect(() => () => {
    clearTransient();
    if (sleepRef.current) clearTimeout(sleepRef.current);
    if (coffeeRef.current) clearTimeout(coffeeRef.current);
  }, [clearTransient]);

  useEffect(() => {
    if (coffeeRef.current) clearTimeout(coffeeRef.current);
    if (snapshot.minimized || snapshot.motionReduced || snapshot.state !== "idle-perched") return;
    const delay = 45_000 + Math.round(Math.random() * 30_000);
    coffeeRef.current = setTimeout(() => transition("coffee-break", snapshot.anchorId, 3_600), delay);
    return () => { if (coffeeRef.current) clearTimeout(coffeeRef.current); };
  }, [snapshot.anchorId, snapshot.minimized, snapshot.motionReduced, snapshot.state, transition]);

  const value = useMemo<CompanionContextValue>(() => ({
    ...snapshot,
    transition,
    listen: (anchorId = "composer") => transition("listening", anchorId),
    think: (anchorId = "bottom-left") => transition("thinking", anchorId),
    takeNotes: (anchorId = "bottom-left") => transition("note-taking", anchorId),
    answer: (anchorId = "composer") => transition("answering", anchorId),
    guide: (anchorId) => transition("guide-mode", anchorId, 2600),
    succeed: () => transition("success", undefined, 1100),
    wave: (anchorId = "composer") => {
      transition("idle-perched", anchorId);
      window.requestAnimationFrame(() => transition("greeting", anchorId, 1650));
    },
    caution: () => transition("caution"),
    fail: () => transition("error"),
    setMode: (mode) => dispatch({ type: "SET_MODE", mode }),
    minimize: () => dispatch({ type: "MINIMIZE" }),
    restore: () => dispatch({ type: "RESTORE" }),
    toggleReducedMotion: () => dispatch({ type: "TOGGLE_MOTION" }),
  }), [snapshot, transition]);

  const isSupportedPage = SUPPORTED_PATHS.some((prefix) => pathname.startsWith(prefix));

  return (
    <AssistantCompanionContext.Provider value={value}>
      {children}
      {isSupportedPage ? <AssistantCompanionLayer /> : null}
    </AssistantCompanionContext.Provider>
  );
}

export function useAssistantCompanion() {
  const context = useContext(AssistantCompanionContext);
  if (!context) throw new Error("useAssistantCompanion must be used inside AssistantCompanionProvider");
  return context;
}

export interface ResolvedAnchor { x: number; y: number; }

export function AssistantAnchorResolver(anchorId: CompanionAnchorId, state: CompanionState, width = 104, height = 116): ResolvedAnchor {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  const margin = window.innerWidth < 640 ? 12 : 24;
  const safeTop = window.innerWidth < 640 ? 72 : margin;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(safeTop, window.innerHeight - height - margin);
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  if (anchorId === "bottom-left") return { x: margin, y: maxY };
  if (anchorId === "bottom-right") return { x: maxX, y: maxY };

  const target = document.querySelector<HTMLElement>(`[data-companion-anchor="${CSS.escape(anchorId)}"]`);
  if (!target) return state === "listening" ? { x: margin, y: maxY } : { x: maxX, y: maxY };
  const rect = target.getBoundingClientRect();
  if (window.innerWidth < 640) {
    return { x: margin, y: clamp(rect.top - height - 8, safeTop, maxY) };
  }
  if (anchorId === "sources") {
    const right = rect.right + 14;
    return { x: right + width < window.innerWidth ? right : clamp(rect.left - width - 14, margin, maxX), y: clamp(rect.top, safeTop, maxY) };
  }
  return { x: clamp(rect.right - width, margin, maxX), y: clamp(rect.top - height - 12, safeTop, maxY) };
}

function companionDimensions(state: CompanionState) {
  if (state === "minimized") return { width: 52, height: 52 };
  if (typeof window !== "undefined" && window.innerWidth < 768) return { width: 108, height: 124 };
  return { width: 148, height: 168 };
}

type DragLocomotion = "stand" | "pickup" | "turn" | "shuffle" | "walk" | "fast-walk" | "run" | "takeoff" | "airborne" | "land" | "stop-settle";

const DRAG_MOTION = {
  desktopThreshold: 6,
  touchThreshold: 9,
  shuffleDistance: 28,
  walkSpeed: 150,
  runSpeed: 620,
  takeoffDistance: 38,
  maxLean: 5,
  releaseMs: 520,
  turnMs: 230,
} as const;

function locomotionFor(speed: number, totalDistance: number): DragLocomotion {
  if (totalDistance < DRAG_MOTION.shuffleDistance) return "shuffle";
  if (speed < DRAG_MOTION.walkSpeed) return "walk";
  if (speed < DRAG_MOTION.runSpeed) return "fast-walk";
  return "run";
}

function signedDirection(value: number, fallback: -1 | 0 | 1): -1 | 0 | 1 {
  if (Math.abs(value) < 18) return fallback;
  return value > 0 ? 1 : -1;
}

export function AssistantMovementController({ anchorId, state, reducedMotion, debug = false, motionRate = 1, onDragWake, children }: { anchorId: CompanionAnchorId; state: CompanionState; reducedMotion: boolean; debug?: boolean; motionRate?: number; onDragWake?: () => void; children: ReactNode }) {
  const [position, setPosition] = useState<ResolvedAnchor>({ x: 24, y: 24 });
  const [flying, setFlying] = useState(false);
  const moverRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(0);
  const initializedRef = useRef(false);
  const currentRef = useRef<ResolvedAnchor>({ x: 24, y: 24 });
  const targetRef = useRef<ResolvedAnchor>({ x: 24, y: 24 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const manualPositionRef = useRef<ResolvedAnchor | null>(null);
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didDragRef = useRef(false);
  const pointerDownRef = useRef<{ id: number; x: number; y: number; grabX: number; grabY: number; type: string; lastX: number; lastY: number; lastAt: number; floorY: number } | null>(null);
  const directionRef = useRef<-1 | 0 | 1>(0);
  const requestedDirectionRef = useRef<-1 | 0 | 1>(0);
  const pointerVelocityRef = useRef({ x: 0, y: 0 });
  const totalDistanceRef = useRef(0);
  const gaitDistanceRef = useRef(0);
  const lastRootRef = useRef<ResolvedAnchor>({ x: 24, y: 24 });
  const facingRef = useRef({ eyes: 0, head: 0, body: 0 });
  const turnUntilRef = useRef(0);
  const takeoffUntilRef = useRef(0);
  const airborneRef = useRef(false);
  const draggingRef = useRef(false);
  const settlingRef = useRef<DragLocomotion>("stand");

  const clampToViewport = useCallback((x: number, y: number) => {
    const dimensions = companionDimensions(state);
    const margin = window.innerWidth < 640 ? 12 : 24;
    const safeTop = window.innerWidth < 640 ? 72 : margin;
    return {
      x: Math.min(Math.max(x, margin), Math.max(margin, window.innerWidth - dimensions.width - margin)),
      y: Math.min(Math.max(y, safeTop), Math.max(safeTop, window.innerHeight - dimensions.height - margin)),
    };
  }, [state]);

  const flyTo = useCallback((next: ResolvedAnchor) => {
    manualPositionRef.current = next;
    setPosition(next);
    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    if (reducedMotion) return;
    setFlying(true);
    flyTimerRef.current = setTimeout(() => setFlying(false), 680);
  }, [reducedMotion]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (manualPositionRef.current) {
          const next = clampToViewport(manualPositionRef.current.x, manualPositionRef.current.y);
          manualPositionRef.current = next;
          setPosition(next);
          return;
        }
        const dimensions = companionDimensions(state);
        setPosition(AssistantAnchorResolver(anchorId, state, dimensions.width, dimensions.height));
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", update); window.removeEventListener("scroll", update); };
  }, [anchorId, clampToViewport, state]);

  useEffect(() => {
    targetRef.current = position;
    if (!initializedRef.current) {
      currentRef.current = position;
      lastRootRef.current = position;
      initializedRef.current = true;
    }
  }, [position]);

  useEffect(() => {
    if (["idle-perched", "sleep"].includes(state)) return;
    manualPositionRef.current = null;
  }, [anchorId, state]);

  useEffect(() => {
    const handlePointerDestination = (event: PointerEvent) => {
      if (event.button !== 0 || state !== "idle-perched" || draggingRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, a, input, textarea, select, label, [role="button"], [role="link"], [contenteditable="true"], [data-companion-ignore-pointer]')) return;
      const dimensions = companionDimensions(state);
      flyTo(clampToViewport(event.clientX - dimensions.width / 2, event.clientY - dimensions.height / 2));
    };
    window.addEventListener("pointerdown", handlePointerDestination, { passive: true });
    return () => window.removeEventListener("pointerdown", handlePointerDestination);
  }, [clampToViewport, flyTo, state]);

  useEffect(() => () => {
    cancelAnimationFrame(frameRef.current);
    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
    if (dockTimerRef.current) clearTimeout(dockTimerRef.current);
  }, []);

  const dimensions = companionDimensions(state);
  const margin = typeof window !== "undefined" && window.innerWidth < 640 ? 12 : 24;
  const safeTop = typeof window !== "undefined" && window.innerWidth < 640 ? 72 : margin;
  const maxX = typeof window !== "undefined" ? Math.max(margin, window.innerWidth - dimensions.width - margin) : margin;
  const maxY = typeof window !== "undefined" ? Math.max(safeTop, window.innerHeight - dimensions.height - margin) : safeTop;
  useEffect(() => {
    let previous = performance.now();
    const tick = (now: number) => {
      const mover = moverRef.current;
      const dt = Math.min(.032, Math.max(.001, (now - previous) / 1000)) * motionRate;
      previous = now;
      if (mover) {
        const current = currentRef.current;
        const target = targetRef.current;
        const velocity = velocityRef.current;
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        const stiffness = reducedMotion ? 220 : draggingRef.current ? 78 : 105;
        const damping = reducedMotion ? 28 : draggingRef.current ? 13.5 : 17;
        velocity.x += (dx * stiffness - velocity.x * damping) * dt;
        velocity.y += (dy * stiffness - velocity.y * damping) * dt;
        const maxSpeed = draggingRef.current ? 1300 : 900;
        const speedBeforeClamp = Math.hypot(velocity.x, velocity.y);
        if (speedBeforeClamp > maxSpeed) {
          velocity.x = velocity.x / speedBeforeClamp * maxSpeed;
          velocity.y = velocity.y / speedBeforeClamp * maxSpeed;
        }
        if (Math.abs(dx) < .08 && Math.abs(velocity.x) < .8) { current.x = target.x; velocity.x = 0; }
        else current.x += velocity.x * dt;
        if (Math.abs(dy) < .08 && Math.abs(velocity.y) < .8) { current.y = target.y; velocity.y = 0; }
        else current.y += velocity.y * dt;

        const rootDx = current.x - lastRootRef.current.x;
        const rootSpeed = Math.hypot(velocity.x, velocity.y);
        const pointer = pointerDownRef.current;
        const floorDelta = pointer ? target.y - pointer.floorY : 0;
        const wantsAir = draggingRef.current && Math.abs(floorDelta) >= DRAG_MOTION.takeoffDistance;
        if (wantsAir && !airborneRef.current) {
          airborneRef.current = true;
          takeoffUntilRef.current = now + 170;
        } else if (airborneRef.current && draggingRef.current && Math.abs(floorDelta) < 16) {
          airborneRef.current = false;
          settlingRef.current = "land";
          takeoffUntilRef.current = now + 360;
        }

        let locomotion: DragLocomotion = settlingRef.current;
        if (draggingRef.current) {
          if (airborneRef.current) locomotion = now < takeoffUntilRef.current ? "takeoff" : "airborne";
          else if (now < takeoffUntilRef.current && settlingRef.current === "land") locomotion = "land";
          else if (now < turnUntilRef.current) locomotion = "turn";
          else locomotion = locomotionFor(Math.max(rootSpeed, Math.hypot(pointerVelocityRef.current.x, pointerVelocityRef.current.y) * .45), totalDistanceRef.current);
        }

        const desiredDirection = draggingRef.current || settlingRef.current === "stop-settle" || settlingRef.current === "land" ? directionRef.current : 0;
        const approach = (value: number, destination: number, rate: number) => value + (destination - value) * Math.min(1, dt * rate);
        facingRef.current.eyes = approach(facingRef.current.eyes, desiredDirection, 18);
        facingRef.current.head = approach(facingRef.current.head, desiredDirection, 10);
        facingRef.current.body = approach(facingRef.current.body, desiredDirection, 6.5);
        const bodyFacing = facingRef.current.body;
        const facing = Math.abs(bodyFacing) < .14 ? "front" : Math.abs(bodyFacing) < .7 ? (bodyFacing < 0 ? "front-left" : "front-right") : (bodyFacing < 0 ? "left" : "right");

        if (draggingRef.current && !airborneRef.current && ["shuffle", "walk", "fast-walk", "run"].includes(locomotion)) gaitDistanceRef.current += Math.abs(rootDx);
        const stride = locomotion === "run" ? 4.5 : locomotion === "fast-walk" ? 3.8 : locomotion === "walk" ? 3.1 : 2.2;
        const gaitPhase = (gaitDistanceRef.current / (stride * 2)) % 1;
        const authoredGaitFrame = Math.floor(gaitPhase * 8) % 8;
        const footPose = (phase: number) => {
          const p = phase % 1;
          if (p < .5) return { x: stride / 2 - (p / .5) * stride, y: 0, rotate: 0, planted: true };
          const swing = (p - .5) / .5;
          return { x: -stride / 2 + swing * stride, y: -Math.sin(swing * Math.PI) * (locomotion === "run" ? 2.5 : 1.7), rotate: Math.sin(swing * Math.PI) * 5 * (bodyFacing || 1), planted: false };
        };
        const leftFoot = footPose(gaitPhase);
        const rightFoot = footPose((gaitPhase + .5) % 1);
        const bob = airborneRef.current ? 0 : Math.sin(gaitPhase * Math.PI * 2) * (locomotion === "run" ? .9 : .55);
        const armSwing = Math.sin(gaitPhase * Math.PI * 2) * (locomotion === "run" ? 5 : locomotion === "shuffle" ? 1.5 : 3);
        const lean = reducedMotion ? 0 : Math.max(-DRAG_MOTION.maxLean, Math.min(DRAG_MOTION.maxLean, velocity.x / 180));
        const verticalVector = Math.max(-1, Math.min(1, dy / 90));

        mover.style.transform = `translate3d(${current.x.toFixed(2)}px,${current.y.toFixed(2)}px,0)`;
        mover.style.setProperty("--drag-lean", `${lean.toFixed(2)}deg`);
        mover.style.setProperty("--drag-trail", `${(-lean * 1.25).toFixed(2)}deg`);
        mover.style.setProperty("--gait-bob", `${bob.toFixed(2)}px`);
        mover.style.setProperty("--head-bob", `${(-bob * .42).toFixed(2)}px`);
        mover.style.setProperty("--left-foot-x", `${leftFoot.x.toFixed(2)}px`);
        mover.style.setProperty("--left-foot-y", `${leftFoot.y.toFixed(2)}px`);
        mover.style.setProperty("--left-foot-r", `${leftFoot.rotate.toFixed(2)}deg`);
        mover.style.setProperty("--right-foot-x", `${rightFoot.x.toFixed(2)}px`);
        mover.style.setProperty("--right-foot-y", `${rightFoot.y.toFixed(2)}px`);
        mover.style.setProperty("--right-foot-r", `${rightFoot.rotate.toFixed(2)}deg`);
        mover.style.setProperty("--left-arm-swing", `${armSwing.toFixed(2)}deg`);
        mover.style.setProperty("--right-arm-swing", `${(-armSwing).toFixed(2)}deg`);
        mover.style.setProperty("--head-shift", `${(facingRef.current.head * 3.8).toFixed(2)}px`);
        mover.style.setProperty("--head-scale-x", `${(1 - Math.abs(facingRef.current.head) * .09).toFixed(3)}`);
        mover.style.setProperty("--face-shift", `${(facingRef.current.head * 3).toFixed(2)}px`);
        mover.style.setProperty("--body-shift", `${(bodyFacing * 2.5).toFixed(2)}px`);
        mover.style.setProperty("--body-skew", `${(-bodyFacing * 4.2).toFixed(2)}deg`);
        mover.style.setProperty("--eye-travel-x", `${(facingRef.current.eyes * 2.4).toFixed(2)}px`);
        mover.style.setProperty("--eye-travel-y", `${(verticalVector * 1.25).toFixed(2)}px`);
        mover.style.setProperty("--air-tilt", `${(airborneRef.current ? Math.max(-7, Math.min(7, velocity.x / 125)) : 0).toFixed(2)}deg`);
        mover.style.setProperty("--stethoscope-trail-x", `${(-lean * .35).toFixed(2)}px`);
        mover.style.setProperty("--pet-sprite-col", authoredGaitFrame.toString());
        mover.style.setProperty("--pet-sprite-row", directionRef.current < 0 ? "2" : "1");
        mover.dataset.ready = "true";
        mover.dataset.locomotion = locomotion;
        mover.dataset.facing = facing;
        mover.dataset.direction = directionRef.current > 0 ? "right" : directionRef.current < 0 ? "left" : "still";
        mover.dataset.grounded = airborneRef.current ? "false" : "true";
        mover.dataset.gaitPhase = gaitPhase.toFixed(3);
        mover.dataset.leftFoot = leftFoot.planted ? "contact" : "pass";
        mover.dataset.rightFoot = rightFoot.planted ? "contact" : "pass";
        mover.dataset.headOrientation = facingRef.current.head.toFixed(2);
        mover.dataset.bodyOrientation = bodyFacing.toFixed(2);
        mover.dataset.velocity = Math.round(rootSpeed).toString();
        mover.dataset.current = `${Math.round(current.x)},${Math.round(current.y)}`;
        mover.dataset.target = `${Math.round(target.x)},${Math.round(target.y)}`;
        mover.dataset.targetVector = `${Math.round(dx)},${Math.round(dy)}`;
        mover.dataset.distance = Math.round(Math.hypot(dx, dy)).toString();
        lastRootRef.current = { ...current };
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [motionRate, reducedMotion]);

  const finishLead = useCallback((cancelled = false) => {
    const mover = moverRef.current;
    const pointer = pointerDownRef.current;
    if (!pointer) return;
    if (mover?.hasPointerCapture(pointer.id)) mover.releasePointerCapture(pointer.id);
    pointerDownRef.current = null;
    draggingRef.current = false;
    pointerVelocityRef.current = { x: 0, y: 0 };
    if (!didDragRef.current || cancelled) {
      settlingRef.current = "stand";
      if (mover) { mover.dataset.dragging = "false"; mover.dataset.dragPhase = "idle"; mover.dataset.locomotion = "stand"; }
      return;
    }
    const wasAirborne = airborneRef.current;
    airborneRef.current = false;
    settlingRef.current = wasAirborne ? "land" : "stop-settle";
    if (mover) { mover.dataset.dragging = "false"; mover.dataset.dragPhase = "release"; mover.dataset.locomotion = settlingRef.current; }
    const finalPosition = clampToViewport(targetRef.current.x, targetRef.current.y);
    manualPositionRef.current = finalPosition;
    setPosition(finalPosition);
    if (mover) {
      const edgeDock = finalPosition.x <= margin + 8 ? "left" : finalPosition.x >= maxX - 8 ? "right" : finalPosition.y >= maxY - 8 ? "bottom" : "none";
      mover.dataset.edgeDock = edgeDock;
      mover.dataset.edgePerched = "false";
      if (edgeDock === "bottom" && state === "idle-perched" && !reducedMotion) {
        dockTimerRef.current = setTimeout(() => {
          if (moverRef.current?.dataset.edgeDock === "bottom" && moverRef.current.dataset.dragPhase === "idle") moverRef.current.dataset.edgePerched = "true";
        }, 12000);
      }
    }
    dragTimerRef.current = setTimeout(() => {
      settlingRef.current = "stand";
      directionRef.current = 0;
      if (moverRef.current) { moverRef.current.dataset.dragPhase = "idle"; moverRef.current.dataset.locomotion = "stand"; moverRef.current.dataset.boundary = "none"; }
    }, reducedMotion ? 0 : DRAG_MOTION.releaseMs);
    window.setTimeout(() => { didDragRef.current = false; }, 0);
  }, [clampToViewport, margin, maxX, maxY, reducedMotion, state]);

  useEffect(() => {
    const finish = () => { if (pointerDownRef.current) finishLead(false); };
    const cancel = () => { if (pointerDownRef.current) finishLead(true); };
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [finishLead]);

  return (
    <div
      ref={moverRef}
      className={styles.mover}
      onPointerDown={(event) => {
        if (event.button !== 0 || state === "page-transition") return;
        if (state === "sleep") onDragWake?.();
        if (dockTimerRef.current) clearTimeout(dockTimerRef.current);
        if (moverRef.current) {
          moverRef.current.dataset.edgeDock = "none";
          moverRef.current.dataset.edgePerched = "false";
        }
        const current = currentRef.current;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerDownRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, grabX: event.clientX - current.x, grabY: event.clientY - current.y, type: event.pointerType, lastX: event.clientX, lastY: event.clientY, lastAt: performance.now(), floorY: current.y };
        totalDistanceRef.current = 0;
        gaitDistanceRef.current = 0;
        settlingRef.current = "pickup";
        event.currentTarget.dataset.dragPhase = "pickup";
        event.currentTarget.dataset.locomotion = "pickup";
      }}
      onPointerMove={(event) => {
        const pointer = pointerDownRef.current;
        if (!pointer || pointer.id !== event.pointerId) return;
        const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
        const threshold = pointer.type === "touch" ? DRAG_MOTION.touchThreshold : DRAG_MOTION.desktopThreshold;
        if (!draggingRef.current && distance < threshold) return;
        if (!draggingRef.current) {
          draggingRef.current = true;
          didDragRef.current = true;
          event.currentTarget.dataset.dragging = "true";
          event.currentTarget.dataset.dragPhase = "moving";
          if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
          if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
          setFlying(false);
        }
        const now = performance.now();
        const elapsed = Math.max(8, now - pointer.lastAt) / 1000;
        pointerVelocityRef.current = { x: (event.clientX - pointer.lastX) / elapsed, y: (event.clientY - pointer.lastY) / elapsed };
        totalDistanceRef.current += Math.hypot(event.clientX - pointer.lastX, event.clientY - pointer.lastY);
        const next = clampToViewport(event.clientX - pointer.grabX, event.clientY - pointer.grabY);
        targetRef.current = next;
        const nextDirection = signedDirection(pointerVelocityRef.current.x || next.x - currentRef.current.x, directionRef.current);
        requestedDirectionRef.current = nextDirection;
        if (directionRef.current && nextDirection !== directionRef.current) turnUntilRef.current = now + DRAG_MOTION.turnMs;
        if (nextDirection) directionRef.current = nextDirection;
        pointer.lastX = event.clientX;
        pointer.lastY = event.clientY;
        pointer.lastAt = now;
        event.currentTarget.dataset.boundary = next.x <= margin + 2 ? "left" : next.x >= maxX - 2 ? "right" : next.y <= safeTop + 2 ? "top" : next.y >= maxY - 2 ? "bottom" : "none";
      }}
      onPointerUp={() => finishLead(false)}
      onPointerCancel={() => {
        finishLead(true);
        didDragRef.current = false;
      }}
      onClickCapture={(event) => {
        if (!didDragRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      data-companion-state={state}
      data-flying={flying ? "true" : "false"}
      data-dragging="false"
      data-drag-phase="idle"
      data-locomotion="stand"
      data-direction="still"
      data-facing="front"
      data-grounded="true"
      data-gait-phase="0"
      data-left-foot="contact"
      data-right-foot="contact"
      data-boundary="none"
      data-edge-dock="none"
      data-edge-perched="false"
      data-velocity="0"
      data-target={`${Math.round(position.x)},${Math.round(position.y)}`}
      data-current={`${Math.round(position.x)},${Math.round(position.y)}`}
      data-target-vector="0,0"
      data-distance="0"
      data-head-orientation="0"
      data-body-orientation="0"
      data-cursor-zone="companion"
      data-quiet-mode={["thinking", "note-taking", "answering", "guide-mode"].includes(state) ? "true" : "false"}
      data-expression={petStateFor(state)}
      data-motion-rate={motionRate.toString()}
      data-debug={debug ? "true" : "false"}
    >
      {children}
    </div>
  );
}

export function AssistantPropRenderer({ state }: { state: CompanionState }) {
  if (state === "thinking") {
    return (
      <div className={`${styles.prop} ${styles.laptop}`} aria-hidden="true">
        <span className={styles.laptopScreen}><i className={styles.scanLine} /></span>
        <span className={styles.laptopBase} />
      </div>
    );
  }
  if (state === "listening") return <div className={`${styles.prop} ${styles.microphone}`} aria-hidden="true"><span /><i /><b /></div>;
  if (state === "guide-mode") return <div className={`${styles.prop} ${styles.guidePointer}`} aria-hidden="true"><span>›</span></div>;
  return null;
}

function petStateFor(state: CompanionState): AssistantPetState {
  const map: Record<CompanionState, AssistantPetState> = {
    "idle-perched": "idle", roaming: "dance", listening: "listening", thinking: "thinking", "note-taking": "notebook", "coffee-break": "coffee",
    answering: "answering", "guide-mode": "answering", success: "success", greeting: "wave", caution: "caution", error: "error",
    sleep: "sleep", "page-transition": "dance", minimized: "minimized",
  };
  return map[state];
}

export function AssistantCompanion() {
  const companion = useAssistantCompanion();
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [motionRate, setMotionRate] = useState(1);
  const slowGreetingAppliedRef = useRef(false);
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(systemReducedMotion || companion.motionReduced);
  const isExplicitPreview = companion.state === "note-taking" || companion.state === "coffee-break";
  const petState = petStateFor(companion.state);
  const label = companion.minimized ? "Restore Dr. FACT companion" : `Dr. FACT draggable companion: ${companion.state.replaceAll("-", " ")}`;

  useEffect(() => {
    if (companion.state !== "greeting") {
      slowGreetingAppliedRef.current = false;
      return;
    }
    if (motionRate >= 1 || slowGreetingAppliedRef.current) return;
    slowGreetingAppliedRef.current = true;
    companion.transition("greeting", companion.anchorId, Math.round(1650 / motionRate));
  }, [companion, motionRate]);

  return (
    <AssistantMovementController anchorId={companion.anchorId} state={companion.state} reducedMotion={reducedMotion} debug={debugEnabled} motionRate={motionRate} onDragWake={() => companion.transition("idle-perched", companion.anchorId)}>
      <div className={styles.companion} data-mode={companion.mode} data-reduced-motion={reducedMotion ? "true" : "false"}>
        <button type="button" className={styles.characterButton} onClick={companion.minimized ? companion.restore : companion.succeed} aria-label={label} title={companion.minimized ? "Drag or click to restore" : "Drag me, or click an empty area to make me fly there"}>
          <AssistantPet state={petState} size={companion.minimized ? "sm" : "lg"} mode={companion.mode === "doctor" ? "doctor" : "patient"} reducedMotion={reducedMotion && !isExplicitPreview} />
          <AssistantPropRenderer state={companion.state} />
        </button>
        {process.env.NODE_ENV !== "production" && !companion.minimized ? (
          <div className={styles.animationPreviews} aria-label="Mascot animation previews">
            <button type="button" data-active={companion.state === "note-taking" ? "true" : "false"} onClick={() => companion.transition("note-taking", companion.anchorId, 10_000)} aria-label="Play notebook and pen animation" aria-pressed={companion.state === "note-taking"}>
              <NotebookPen /><span>Notes</span>
            </button>
            <button type="button" data-active={companion.state === "coffee-break" ? "true" : "false"} onClick={() => companion.transition("coffee-break", companion.anchorId, 10_000)} aria-label="Play coffee drinking animation" aria-pressed={companion.state === "coffee-break"}>
              <Coffee /><span>Coffee</span>
            </button>
            {isExplicitPreview ? <span className={styles.previewStatus} role="status">Playing {companion.state === "coffee-break" ? "coffee" : "notes"}</span> : null}
          </div>
        ) : null}
        <div className={styles.controls} aria-label="Assistant companion controls">
          {process.env.NODE_ENV !== "production" ? (
            <>
              <button type="button" onClick={() => setDebugEnabled((enabled) => !enabled)} aria-pressed={debugEnabled} aria-label="Toggle companion motion debug" title="Motion debug">
                <Activity />
              </button>
              {debugEnabled ? ([.25, .5, 1] as const).map((rate) => (
                <button key={rate} type="button" className={styles.rateButton} onClick={() => setMotionRate(rate)} aria-pressed={motionRate === rate} aria-label={`Set companion motion to ${rate} times speed`} title={`${rate}× speed`}>
                  {rate === .25 ? "¼" : rate === .5 ? "½" : "1"}
                </button>
              )) : null}
            </>
          ) : null}
          <button type="button" onClick={companion.toggleReducedMotion} aria-pressed={companion.motionReduced} aria-label={companion.motionReduced ? "Enable companion motion" : "Reduce companion motion"} title={companion.motionReduced ? "Enable motion" : "Reduce motion"}>
            {companion.motionReduced ? <RotateCcw /> : <PersonStanding />}
          </button>
          <button type="button" onClick={companion.minimized ? companion.restore : companion.minimize} aria-label={companion.minimized ? "Restore assistant companion" : "Minimize assistant companion"} title={companion.minimized ? "Restore" : "Minimize"}>
            {companion.minimized ? <Move /> : <Minus />}
          </button>
        </div>
      </div>
    </AssistantMovementController>
  );
}

export function AssistantCompanionLayer() {
  return <div className={styles.layer} aria-live="off"><AssistantCompanion /></div>;
}

export const AssistantBehaviourEngine = AssistantCompanionProvider;
export const AssistantPageTransitionController = AssistantCompanionProvider;
