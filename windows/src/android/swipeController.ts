// Coco Squad Mobile — Horizontal Swipe Controller
// Modular, isolated gesture detection for cycling between squad agents:
// Coco -> Green -> Red -> Blu -> Coco

export interface SwipeControllerOptions {
  /** Target element to attach listeners to (defaults to document.body) */
  container?: HTMLElement | Window | Document | null;
  /** Ordered list of squad IDs in cycling order */
  squadIds?: string[];
  /** Function returning currently active agent ID */
  getCurrentAgentId: () => string;
  /** Callback fired when an agent switch is requested via swipe */
  onSwitchAgent: (agentId: string) => void;
  /** Optional guard checking if swipe is allowed in current app state */
  canSwipe?: () => boolean;
  /** Minimum horizontal distance in px to trigger switch (default: 60) */
  minDistance?: number;
  /** Required ratio of horizontal to vertical displacement (default: 1.5) */
  directionRatio?: number;
  /** Enable mouse/pointer fallback for desktop emulation (default: true) */
  enableMouseFallback?: boolean;
}

export interface SwipeController {
  destroy: () => void;
  next: () => void;
  prev: () => void;
}

/**
 * Safely triggers device haptic feedback without throwing on unsupported hardware.
 */
export function triggerHapticFeedback(durationMs: number = 12): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Graceful fallback for non-haptic devices / desktop browsers
  }
}

export function initSwipeController(options: SwipeControllerOptions): SwipeController {
  const squadIds = options.squadIds && options.squadIds.length > 0
    ? options.squadIds
    : ["coco_blanco", "coco_verde", "coco_rojo", "coco_azul"];

  const minDistance = options.minDistance ?? 60;
  const directionRatio = options.directionRatio ?? 1.5;
  const targetElement = (options.container as HTMLElement) || document.body;

  let isTouchTracking = false;
  let startX = 0;
  let startY = 0;

  let isMouseTracking = false;
  let mouseStartX = 0;
  let mouseStartY = 0;

  const switchToIndexDelta = (delta: number) => {
    const currentId = options.getCurrentAgentId();
    let currentIndex = squadIds.indexOf(currentId);
    if (currentIndex === -1) currentIndex = 0;

    const newIndex = (currentIndex + delta + squadIds.length) % squadIds.length;
    const targetAgentId = squadIds[newIndex];

    triggerHapticFeedback(12);
    options.onSwitchAgent(targetAgentId);
  };

  const next = () => switchToIndexDelta(1);
  const prev = () => switchToIndexDelta(-1);

  const isInteractiveTarget = (el: HTMLElement | null): boolean => {
    if (!el) return false;
    return !!el.closest(
      "input, textarea, select, button, #tools-popup-card, #devour-sheet-card, .top-bar-right, .bottom-nav-bar, #btn-tools-plus, #btn-send"
    );
  };

  // ── Touch Events ───────────────────────────────────────────────────────────

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) {
      isTouchTracking = false;
      return;
    }

    if (options.canSwipe && !options.canSwipe()) {
      isTouchTracking = false;
      return;
    }

    const target = e.target as HTMLElement | null;
    if (isInteractiveTarget(target)) {
      isTouchTracking = false;
      return;
    }

    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    isTouchTracking = true;
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!isTouchTracking) return;
    isTouchTracking = false;

    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Verificación de umbral seguro y clara dominancia horizontal
    if (absDx >= minDistance && absDx > absDy * directionRatio) {
      if (dx < 0) {
        // Deslizar a la izquierda -> siguiente Coco
        next();
      } else {
        // Deslizar a la derecha -> Coco anterior
        prev();
      }
    }
  };

  const onTouchCancel = () => {
    isTouchTracking = false;
  };

  // ── Mouse / Pointer Fallback (Desktop / DevTools) ──────────────────────────

  const onMouseDown = (e: MouseEvent) => {
    if (options.enableMouseFallback === false) return;
    if (e.button !== 0) return; // Only main left click

    if (options.canSwipe && !options.canSwipe()) {
      isMouseTracking = false;
      return;
    }

    const target = e.target as HTMLElement | null;
    if (isInteractiveTarget(target)) {
      isMouseTracking = false;
      return;
    }

    mouseStartX = e.clientX;
    mouseStartY = e.clientY;
    isMouseTracking = true;
  };

  const onMouseUp = (e: MouseEvent) => {
    if (!isMouseTracking) return;
    isMouseTracking = false;

    const dx = e.clientX - mouseStartX;
    const dy = e.clientY - mouseStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx >= minDistance && absDx > absDy * directionRatio) {
      if (dx < 0) {
        next();
      } else {
        prev();
      }
    }
  };

  // Register listeners
  targetElement.addEventListener("touchstart", onTouchStart as EventListener, { passive: true });
  targetElement.addEventListener("touchend", onTouchEnd as EventListener, { passive: true });
  targetElement.addEventListener("touchcancel", onTouchCancel as EventListener, { passive: true });

  if (options.enableMouseFallback !== false) {
    targetElement.addEventListener("mousedown", onMouseDown as EventListener);
    window.addEventListener("mouseup", onMouseUp as EventListener);
  }

  const destroy = () => {
    targetElement.removeEventListener("touchstart", onTouchStart as EventListener);
    targetElement.removeEventListener("touchend", onTouchEnd as EventListener);
    targetElement.removeEventListener("touchcancel", onTouchCancel as EventListener);
    if (options.enableMouseFallback !== false) {
      targetElement.removeEventListener("mousedown", onMouseDown as EventListener);
      window.removeEventListener("mouseup", onMouseUp as EventListener);
    }
  };

  return {
    destroy,
    next,
    prev,
  };
}
