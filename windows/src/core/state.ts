// App state — mirror of AppState.swift (the parts the island needs).

import type { BotEmoteName, BotStateName, IslandMode, IslandViewName } from "./layout";
import type { EyeShape } from "../mochi/engine";

export type AgentSource = "claudeCode" | "n8n" | "agent";
export type PillBadge = "approval" | "finished" | "error";

export interface AgentTask {
  id: string;
  name: string;
  color: string;
  state: BotStateName;
  stepIndex: number;
  steps: string[];
  source: AgentSource;
  isIntegration: boolean;
  emote?: BotEmoteName | null;
  miniEye?: EyeShape | null;
  pillBadge?: PillBadge | null;
  sessionCwd?: string | null;
}

export interface ApprovalInfo {
  requestId: string;
  sessionId: string;
  tool: string;
  command: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  channel?: "whatsapp" | "instagram" | "tiktok";
  senderName?: string;
  agentId?: "coco_blanco" | "coco_verde" | "coco_rojo" | "coco_azul" | string;
  agentName?: string;
  agentColor?: string;
  agentRole?: string;
  gesture?: string;
  isHandOffAck?: boolean;
  intervention?: {
    from_coco_id: 'coco_blanco' | 'coco_verde' | 'coco_rojo' | 'coco_azul';
    from_name: string;
    badge_color: string;
    returned?: boolean;
  };
}

export type PromptContext =
  | { kind: "window"; appName: string; title: string; url?: string; path?: string; summary?: string; items?: string[] }
  | { kind: "file"; name: string; path?: string };

export interface ResultItem {
  label: string;
  detail: string;
  url?: string;
}

export interface SearchResult {
  title: string;
  items: ResultItem[];
  note?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export interface QuickNote {
  id: string;
  text: string;
  createdAt: number;
}

const task = (
  id: string, name: string, color: string, source: AgentSource,
): AgentTask => ({
  id, name, color, state: "idle", stepIndex: 0, steps: [], source, isIntegration: true,
});

/** Coco Squad members available in this build. */
export const SQUAD_MEMBERS: AgentTask[] = [
  task("coco_blanco", "Coco Blanco", "#FFFFFF", "agent"),
  task("coco_verde", "Coco Verde", "#10B981", "agent"),
  task("coco_rojo", "Coco Rojo", "#EF4444", "agent"),
  task("coco_azul", "Coco Azul", "#3B82F6", "agent"),
];

/** Dormant legacy event shape; no integration pollers are started. */
export interface IntegrationInfo {
  data: Record<string, unknown>;
  error: string | null;
  loaded: boolean;
  configured: boolean;
}

export interface Settings {
  soundEnabled: boolean;
  soundVolume: number;
  autoCloseInterval: number;
  absenceInterval: number;
  activeIntegrations: string[];
  screen: "primary" | "cursor";
  autostart: boolean;
  hooksInstalled: boolean;
  model: string;
  mochiOutfit: string;
}

export const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  soundVolume: 0.12,
  autoCloseInterval: 15,
  absenceInterval: 180,
  activeIntegrations: ["coco_verde", "coco_rojo", "coco_azul"],
  screen: "primary",
  autostart: false,
  hooksInstalled: false,
  model: "coco-squad",
  mochiOutfit: "auto",
};

type Listener = () => void;

class AppState {
  mode: IslandMode = "hidden";
  view: IslandViewName = "overview";

  tasks: AgentTask[] = [];
  focusId: string | null = null;

  stateOverride: BotStateName | null = null;

  /** Cursor in logical screen pixels, origin top-left (like AppState.mousePosition). */
  mouse = { x: 0, y: 0 };
  /** Cursor relative to the island's top-left corner. */
  mouseInIsland = { x: 0, y: 0 };

  isPinned = false;
  paused = false;

  uploadProgress = 0;
  uploadDuration = 2.4;
  fileDragOver = false;

  promptContext: PromptContext | null = null;
  droppedFile: { name: string; path?: string; base64?: string; size?: number } | null = null;
  noteMessage: string | null = null;
  searchResult: SearchResult | null = null;
  chatHistory: ChatMessage[] = [];
  pendingApproval: ApprovalInfo | null = null;
  wardrobePreview: any = null;
  mochiOnDesktop = false;

  integrations: Record<string, IntegrationInfo> = {};

  todos: TodoItem[] = [];
  quickNotes: QuickNote[] = [];

  loadProductivityData() {
    try {
      if (typeof localStorage !== "undefined") {
        const savedTodos = localStorage.getItem("coco_blanco_todos");
        if (savedTodos) this.todos = JSON.parse(savedTodos);
        const savedNotes = localStorage.getItem("coco_blanco_notes");
        if (savedNotes) this.quickNotes = JSON.parse(savedNotes);
      }
    } catch {}
  }

  saveProductivityData() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("coco_blanco_todos", JSON.stringify(this.todos));
        localStorage.setItem("coco_blanco_notes", JSON.stringify(this.quickNotes));
      }
    } catch {}
  }

  addTodo(text: string): TodoItem {
    const item: TodoItem = {
      id: "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      text: text.trim(),
      done: false,
      createdAt: Date.now(),
    };
    this.todos.unshift(item);
    this.saveProductivityData();
    this.notify();
    return item;
  }

  toggleTodo(id: string) {
    const t = this.todos.find((x) => x.id === id);
    if (t) {
      t.done = !t.done;
      this.saveProductivityData();
      this.notify();
    }
  }

  removeTodo(id: string) {
    this.todos = this.todos.filter((x) => x.id !== id);
    this.saveProductivityData();
    this.notify();
  }

  addNote(text: string): QuickNote {
    const note: QuickNote = {
      id: "n_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      text: text.trim(),
      createdAt: Date.now(),
    };
    this.quickNotes.unshift(note);
    this.saveProductivityData();
    this.notify();
    return note;
  }

  removeNote(id: string) {
    this.quickNotes = this.quickNotes.filter((x) => x.id !== id);
    this.saveProductivityData();
    this.notify();
  }

  lastActivity = performance.now();

  settings: Settings = { ...DEFAULT_SETTINGS };

  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Callback for triggering character animations from anywhere. */
  mochiAction: ((action: "greet" | "slap" | "blink" | "squash" | "love" | "finished" | "dizzy") => void) | null = null;

  triggerMochi(action: "greet" | "slap" | "blink" | "squash" | "love" | "finished" | "dizzy") {
    this.mochiAction?.(action);
  }

  /** Marks the UI dirty; the island re-renders on the next frame. */
  notify() {
    for (const fn of this.listeners) fn();
  }

  get focusTask(): AgentTask | null {
    return this.tasks.find((t) => t.id === this.focusId) ?? this.tasks[0] ?? null;
  }

  get effectiveState(): BotStateName {
    return this.stateOverride ?? this.focusTask?.state ?? "idle";
  }

  get otherTasks(): AgentTask[] {
    return this.tasks.filter((t) => t.id !== this.focusId);
  }

  setFocus(id: string) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    this.focusId = id;
    t.pillBadge = null;
    this.notify();
  }

  updateTask(id: string, state: BotStateName) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    t.state = state;
    this.notify();
  }

  appendStep(id: string, step: string) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    t.steps.push(step);
    if (t.steps.length > 20) t.steps.shift();
    t.stepIndex = t.steps.length - 1;
    this.notify();
  }

  setPillBadge(id: string, badge: PillBadge | null) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    t.pillBadge = badge;
    this.notify();
  }

  loadSquadMembers() {
    for (const proto of SQUAD_MEMBERS) {
      const idx = this.tasks.findIndex((t) => t.id === proto.id);
      if (idx < 0) this.tasks.push({ ...proto, steps: [] });
    }
    const order = SQUAD_MEMBERS.map((t) => t.id);
    this.tasks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    this.tasks = this.tasks.filter((t) => order.includes(t.id));
    if (!this.focusId || !this.tasks.some((t) => t.id === this.focusId)) this.focusId = "coco_blanco";
    this.notify();
  }

  removeTask(id: string) {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    this.tasks.splice(idx, 1);
    if (this.focusId === id) this.focusId = this.tasks[0]?.id ?? "coco_blanco";
    this.notify();
  }

  /** Kept for the dormant external hook module; the handler is not registered. */
  upsertExternalAgent(id: string, name: string, color: string) {
    if (this.tasks.some((t) => t.id === id)) return;
    this.tasks.push({
      id, name, color, state: "idle", stepIndex: 0, steps: [],
      source: "agent", isIntegration: false,
    });
    this.notify();
  }

  defaultView(): IslandViewName {
    return "overview";
  }
}

export const State = new AppState();
State.loadProductivityData();
