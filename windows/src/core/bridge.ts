// Thin wrapper over the Tauri commands/events. Every call is a no-op when the
// page is opened in a plain browser, so the island can be iterated on with
// `npm run dev` alone.

import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { State, type Settings } from "./state";

export const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!IS_TAURI) return null;
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.error(`[coucou] ${cmd} failed`, err);
    return null;
  }
}

export interface BootInfo {
  settings: Settings;
  /** Logical screen rect of the monitor the island lives on. */
  screen: { x: number; y: number; width: number; height: number; scale: number };
  version: string;
  hookPath: string;
  /** False where the OS has no global cursor (Wayland): see Island.followPageCursor. */
  cursorPoll: boolean;
}

export const Bridge = {
  boot: () => call<BootInfo>("boot"),

  saveSettings: (settings: Settings) => call<void>("save_settings", { settings }),

  /** Shrink the window down to the invisible wake strip (hidden) or back to full. */
  setCollapsed: (collapsed: boolean) => call<void>("set_collapsed", { collapsed }),

  /**
   * Pushes the island shape in window coordinates. Rust flips click-through from
   * its own cursor poll, so the flag is never a frame behind a click.
   */
  setIslandRect: (x: number, y: number, width: number, height: number) =>
    call<void>("set_island_rect", { x, y, width, height }),

  /** Give the window keyboard focus (chat field) and take it away again. */
  focusWindow: (focused: boolean) => call<void>("focus_window", { focused }),

  reposition: () => call<void>("reposition"),

  openUrl: (url: string) => call<void>("open_url", { url }),

  /** "Open terminal" → opens the folder in VS Code when `code` is on PATH. */
  openInVSCode: (path: string | null) => call<boolean>("open_in_vscode", { path }),

  quit: () => call<void>("quit_app"),

  openSettingsWindow: () => call<void>("open_settings_window"),
  closeSettingsWindow: async () => {
    await call<void>("close_settings_window");
    if (IS_TAURI) {
      try {
        const win = getCurrentWebviewWindow();
        await win.hide();
      } catch {}
    }
  },

  /** Writes to %LOCALAPPDATA%\Coucou\coucou.log, next to the Rust lines. */
  log: (message: string) => call<void>("log_line", { message }),

  // ── Claude Code hooks ─────────────────────────────────────────────────────
  hooksStatus: () => call<HookStatus>("hooks_status"),
  /** Diff to show before anything is written. `install: false` previews removal. */
  hooksPreview: (install: boolean) => callOrThrow<HookPreview>("hooks_preview", { install }),
  /**
   * Writes ~/.claude/settings.json — only ever after an explicit click, and only
   * when the file still matches the preview the user looked at.
   */
  hooksApply: (install: boolean, fingerprint: string) =>
    callOrThrow<string>("hooks_apply", { install, fingerprint }),

  approvalDecision: (requestId: string, decision: "allow" | "deny") =>
    call<void>("approval_decision", { requestId, decision }),
  /** "The card is up" — until this lands the relay only waits a moment. */
  approvalAck: (requestId: string) => call<void>("approval_ack", { requestId }),
  /** "Nobody can act on this" — Claude Code asks in the terminal right away. */
  approvalDecline: (requestId: string) => call<void>("approval_decline", { requestId }),

  /** One chat turn to the Coco Squad Server. */
  chatSend: async (query: string, context: ChatContext | null, cocoId?: string | null): Promise<ChatReply> => {
    if (!IS_TAURI) {
      const activeId = cocoId || "coco_blanco";
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
      const apiBase = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080";
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${apiBase}/api/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: query,
            chat_id: 1,
            tenant_id: 1,
            coco_id: activeId,
            contexto: context,
            file: context && context.kind === "file" && context.base64 ? {
              name: context.name,
              data: context.base64,
              mime: context.name.endsWith(".pdf") ? "application/pdf" : (context.name.endsWith(".png") || context.name.endsWith(".jpg") ? "image/jpeg" : "text/plain"),
            } : null,
            todos: State.todos,
            notes: State.quickNotes,
          }),
        });
        if (res.status === 401) {
          return {
            text: "🔒 Necesitás una sesión activa para chatear. Iniciá sesión en Coco Squad y volvé a intentarlo.",
            cocoId: activeId,
          };
        }
        if (!res.ok) {
          throw new Error(`Servidor devolvió status ${res.status}`);
        }
        const data = await res.json();
        const text = data.reply || data.respuesta || "Sin respuesta del servidor";
        return {
          text,
          cocoId: data.coco_id || activeId,
          cocoNombre: data.coco_nombre || (activeId === "coco_verde" ? "Coco Verde" : activeId === "coco_rojo" ? "Coco Rojo" : activeId === "coco_azul" ? "Coco Azul" : "Coco Blanco"),
          color: data.color || (activeId === "coco_verde" ? "#10b981" : activeId === "coco_rojo" ? "#ef4444" : activeId === "coco_azul" ? "#3b82f6" : "#ffffff"),
        };
      } catch (err) {
        console.error("[bridge] Error conectando al servidor:", err);
        return {
          text: `⚠️ No se pudo conectar con el servidor local (${apiBase}): ${err instanceof Error ? err.message : String(err)}\n\nAsegurate de que el backend esté corriendo en http://127.0.0.1:8080`,
          cocoId: activeId,
        };
      }
    }
    return callOrThrow<ChatReply>("chat_send", { query, context, cocoId: cocoId ?? null });
  },
  chatReset: () => call<void>("chat_reset"),
  /** Copies a dropped file into the inbox. */
  ingestFile: async (path: string) => {
    if (!IS_TAURI) {
      const name = path.split(/[\\/]/).pop() || "file";
      return { name, path };
    }
    return callOrThrow<DroppedFile>("ingest_file", { path });
  },
  /** Only ever tells you whether a key exists — never its value. */
  secretPresent: (key: string) => call<boolean>("secret_present", { key }),
  secretSet: (key: string, value: string) => callOrThrow<void>("secret_set", { key, value }),
  secretClear: (key: string) => callOrThrow<void>("secret_clear", { key }),

  // ── Integrations ──────────────────────────────────────────────────────────
  refreshIntegration: (id: string) => call<void>("refresh_integration", { id }),
  /** Opens the configured n8n instance in the browser. */
  openN8n: () => call<void>("open_n8n"),

  /** Tray → Pause. Stops the integration pollers, not just the island. */
  setPaused: (paused: boolean) => call<void>("set_paused", { paused }),

  // ── Mochi on the desktop (src-tauri/src/desktop.rs) ─────────────────────────
  desktopInfo: () => call<DesktopInfo>("desktop_mochi_info"),
  /** Dragged out of the island: (x, y) is the pointer in island-window coordinates. */
  desktopPickUp: (x: number, y: number) => call<boolean>("desktop_mochi_pick_up", { x, y }),
  /** Linux: the pointer moved during that drag (Windows carries him from Rust). */
  desktopCarry: (x: number, y: number) => call<void>("desktop_mochi_carry", { x, y }),
  desktopCarryEnd: (x: number, y: number) => call<void>("desktop_mochi_carry_end", { x, y }),
  /** A drag started on the desktop Mochi; resolves to his top-left corner. */
  desktopDragBegin: () => call<[number, number] | null>("desktop_mochi_drag_begin"),
  /** X11: top-left corner, physical pixels. */
  desktopDragMove: (x: number, y: number) => call<void>("desktop_mochi_drag_move", { x, y }),
  desktopDragEnd: (x: number, y: number) => call<void>("desktop_mochi_drag_end", { x, y }),
  /** From the island to his spot. False: no spot on any connected display.
   *  `anywhere`: the first-visit corner then, rather than staying home. */
  desktopFlyOut: (anywhere = false) => call<boolean>("desktop_mochi_fly_out", { anywhere }),
  /** To the island, then hidden. `forget`: he lives in the island again. */
  desktopFlyHome: (forget: boolean) => call<boolean>("desktop_mochi_fly_home", { forget }),
  /** Asleep, the cursor poll stops. */
  desktopSetAsleep: (asleep: boolean) => call<void>("desktop_mochi_set_asleep", { asleep }),
  /** Captures window context at screen physical point (Win32). */
  captureWindowAt: (x: number, y: number) =>
    call<{ appName: string; title: string; url?: string } | null>("capture_window_at", { x, y }),
};

/** How the desktop Mochi's window works here (platform::DesktopMode). */
export type DesktopMode = "poll" | "window" | "layer" | "off";

export interface DesktopInfo {
  mode: DesktopMode;
  /** He was on the desktop when the app last quit. */
  onDesktop: boolean;
}

/** An event for one window only (island ⇄ desktop Mochi). Never throws. */
export async function emitToWindow(label: string, event: string, payload?: unknown) {
  if (!IS_TAURI) return;
  try {
    await emitTo(label, event, payload);
  } catch (err) {
    console.error(`[coucou] emit ${event} failed`, err);
  }
}

export interface IntegrationUpdate {
  id: string;
  data: Record<string, unknown>;
  error: string | null;
  event: { success: boolean; label: string; detail: string | null } | null;
}

export interface ChatReply {
  text: string;
  cocoId?: string | null;
  cocoNombre?: string | null;
  color?: string | null;
}

export type ChatContext =
  | { kind: "file"; name: string; path?: string; base64?: string }
  | { kind: "window"; appName: string; title: string; url?: string };

export interface DroppedFile {
  name: string;
  path: string;
  size: number;
}

export interface HookStatus {
  installed: boolean;
  settingsPath: string;
  hookPath: string;
  hookReady: boolean;
}

export interface HookPreview {
  diff: string;
  backup: string;
  settingsPath: string;
  /** Hand back to hooksApply so only the reviewed diff is ever written. */
  fingerprint: string;
}

/** Same as `call`, but surfaces the error so the UI can show what went wrong. */
async function callOrThrow<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!IS_TAURI) throw new Error("not running inside Coucou");
  return invoke<T>(cmd, args);
}

export type BridgeEvent =
  | { name: "cursor"; payload: { x: number; y: number } }
  | { name: "tray"; payload: string }
  | { name: "hook"; payload: Record<string, unknown> }
  | { name: "screen-changed"; payload: null };

export interface DragDropPayload {
  type: "enter" | "over" | "drop" | "leave";
  paths?: string[];
}

/** Files dragged onto the island. Only reaches us when the window takes the mouse. */
export async function onDragDrop(handler: (e: DragDropPayload) => void) {
  if (!IS_TAURI) return () => {};
  const unlistenCustom = await listen<DragDropPayload>("file-drag-drop", (e) => {
    handler(e.payload);
  });
  const unlistenNative = await getCurrentWebview().onDragDropEvent((event) => {
    handler(event.payload as DragDropPayload);
  });
  return () => {
    unlistenCustom();
    unlistenNative();
  };
}

export async function onEvent<T>(name: string, handler: (payload: T) => void) {
  if (!IS_TAURI) return () => {};
  const unlistenGlobal = await listen<T>(name, (e) => handler(e.payload));
  let unlistenWin = () => {};
  try {
    const win = getCurrentWebviewWindow();
    if (win) {
      unlistenWin = await win.listen<T>(name, (e) => handler(e.payload));
    }
  } catch {}
  return () => {
    unlistenGlobal();
    unlistenWin();
  };
}
