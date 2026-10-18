// Coco Squad Mobile — Android Application Entry Point
// Authentic Material 3 / iOS mobile companion with Mochi, Squad Bar, Oracle Chat & Devour

import "./android.css";
import { BotEngine } from "../mochi/engine";
import { Ease } from "../core/anim";
import { Sound } from "../core/sound";
import { State, type ChatMessage, type TodoItem, type QuickNote } from "../core/state";
import { marked } from "marked";
import { initSwipeController, triggerHapticFeedback, type SwipeController } from "./swipeController";
import { GreenManager } from "./greenManager";
import {
  notifyAgentCompletion,
  notifyRequestStart,
  notifyRequestEnd,
  registerAgentNavigator,
  initSystemPresence,
  clearAppBadge,
  setAppBadge,
  requestNotificationPermission,
} from "./notifications";
import {
  formatFileSize,
  saveDevouredFileRecord,
} from "./fileGuard";

marked.setOptions({
  gfm: true,
  breaks: true,
});

interface SquadMember {
  id: string;
  name: string;
  role: string;
  color: string;
  glow: string;
  bgTint: string;
  squadRole: "white" | "green" | "red" | "blue";
  greeting: string;
  sendTextColor?: string;
}

export interface SquadIntervention {
  from_coco_id: 'coco_blanco' | 'coco_verde' | 'coco_rojo' | 'coco_azul';
  from_name: string;
  badge_color: string;
  reply: string;
  micro_reply?: string;
  delay_ms?: number;
  user_prompt?: string;
}

declare global {
  interface Window {
    testSquadAssist?: () => Promise<void>;
  }
}

interface QuickToolItem {
  icon: string;
  title: string;
  desc: string;
  prompt?: string;
  actionType?: "todo" | "note";
}

const SQUAD_TOOLS: Record<string, QuickToolItem[]> = {
  coco_blanco: [
    {
      icon: "💡",
      title: "¿Quién sos y qué hacés?",
      desc: "Conocé al escuadrón y sus capacidades",
      prompt: "¿Quién sos y qué funciones tenés en el escuadrón?",
    },
    {
      icon: "📋",
      title: "Resumir pendientes",
      desc: "Repasar prioridades y tareas del día",
      prompt: "Resumí mis pendientes y prioridades del día.",
    },
    {
      icon: "📝",
      title: "Nueva tarea rápida",
      desc: "Agregar un ítem a la lista de tareas",
      actionType: "todo",
    },
    {
      icon: "📌",
      title: "Guardar nota rápida",
      desc: "Crear una nota en Taby",
      actionType: "note",
    },
  ],
  coco_verde: [
    {
      icon: "💬",
      title: "Mensajes pendientes",
      desc: "Revisar WhatsApp y chats por contestar",
      prompt: "Revisar comunicaciones de redes y mensajes pendientes de WhatsApp.",
    },
    {
      icon: "📅",
      title: "Recordatorio de turnos",
      desc: "Redactar confirmación para pacientes",
      prompt: "Redactá un mensaje de WhatsApp para recordar y confirmar los turnos de mañana.",
    },
    {
      icon: "⚡",
      title: "Plantillas de respuesta",
      desc: "Respuestas prearmadas para dudas frecuentes",
      prompt: "Mostrame las plantillas de respuesta rápida para pacientes en WhatsApp.",
    },
    {
      icon: "🔍",
      title: "Buscar contacto / historial",
      desc: "Consultar mensajes anteriores",
      prompt: "Buscar conversaciones y consultas recientes de pacientes.",
    },
  ],
  coco_rojo: [
    {
      icon: "🔬",
      title: "Investigación profunda",
      desc: "Análisis exhaustivo de un tema o técnica",
      prompt: "Iniciar una investigación profunda sobre tendencias y protocolos clínicos.",
    },
    {
      icon: "📚",
      title: "Buscar evidencia / papers",
      desc: "Revisión bibliográfica y científica",
      prompt: "Buscá evidencia clínica y papers científicos recientes sobre este caso.",
    },
    {
      icon: "📑",
      title: "Sintetizar documento",
      desc: "Resumir puntos clave de un archivo o PDF",
      prompt: "Sintetizá los puntos clave del documento o archivo adjunto.",
    },
    {
      icon: "🧪",
      title: "Comparar tratamientos",
      desc: "Contraste de protocolos clínicos",
      prompt: "Compará ventajas y desventajas de los distintos enfoques terapéuticos.",
    },
  ],
  coco_azul: [
    {
      icon: "📊",
      title: "Métricas del mes",
      desc: "Rendimiento, consultas e ingresos",
      prompt: "Mostrame el reporte de métricas y rendimiento mensual.",
    },
    {
      icon: "📈",
      title: "Evolución y asistencia",
      desc: "Tasa de asistencia y cancelaciones",
      prompt: "Analizá la tasa de asistencia, reprogramaciones y cancelaciones recientes.",
    },
    {
      icon: "⏱️",
      title: "Productividad semanal",
      desc: "Horas y volumen de atención clínica",
      prompt: "Generá un resumen de productividad y carga horaria de la última semana.",
    },
    {
      icon: "📉",
      title: "Detección de patrones",
      desc: "Horarios pico y demanda estacional",
      prompt: "Identificá los patrones y horarios con mayor demanda de pacientes.",
    },
  ],
};

const SQUAD: SquadMember[] = [
  {
    id: "coco_blanco",
    name: "Coco",
    role: "General",
    color: "#FFFFFF",
    glow: "rgba(255, 255, 255, 0.40)",
    bgTint: "rgba(255, 255, 255, 0.05)",
    squadRole: "white",
    greeting: "¡Hola Gregorio! Soy Coco, tu asistente general de productividad y chat.",
    sendTextColor: "#000000",
  },
  {
    id: "coco_verde",
    name: "Green",
    role: "WhatsApp",
    color: "#00E676",
    glow: "rgba(0, 230, 118, 0.45)",
    bgTint: "rgba(0, 230, 118, 0.08)",
    squadRole: "green",
    greeting: "¡Qué tal! Green a cargo de comunicaciones y WhatsApp.",
    sendTextColor: "#05160c",
  },
  {
    id: "coco_rojo",
    name: "Red",
    role: "Investigador",
    color: "#FF2D55",
    glow: "rgba(255, 45, 85, 0.45)",
    bgTint: "rgba(255, 45, 85, 0.08)",
    squadRole: "red",
    greeting: "Red listo. Investigaciones profundas, síntesis y análisis técnico.",
    sendTextColor: "#ffffff",
  },
  {
    id: "coco_azul",
    name: "Blu",
    role: "Analista",
    color: "#0084FF",
    glow: "rgba(0, 132, 255, 0.45)",
    bgTint: "rgba(0, 132, 255, 0.08)",
    squadRole: "blue",
    greeting: "Blu aquí. Análisis de métricas, reportes mensuales y hábitos.",
    sendTextColor: "#ffffff",
  },
];

interface MiniMochiChip {
  member: SquadMember;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  engine: BotEngine;
  w: number;
  h: number;
  dpr: number;
  nextActionTime: number;
}

interface AttachedMedia {
  name: string;
  base64: string;
  dataUri?: string;
  fileSizeStr: string;
  isImage: boolean;
  isVideo: boolean;
}

class AndroidApp {
  private activeMember: SquadMember = SQUAD[0];
  private activeTab: "chat" | "devour" | "tasks" = "chat";
  private engine: BotEngine = new BotEngine();
  private mascotCanvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animId: number = 0;
  private isToolsMenuOpen: boolean = false;
  private isDevourSheetOpen: boolean = false;
  private nextIdleActionTime: number = performance.now() + 3000;
  private miniMochis: MiniMochiChip[] = [];
  private swipeController: SwipeController | null = null;
  private devourCanvas: HTMLCanvasElement | null = null;
  private devourCtx: CanvasRenderingContext2D | null = null;
  private devourEngine: BotEngine = new BotEngine();
  private devourAnimId: number = 0;

  private chatHistories: Record<string, ChatMessage[]> = {
    coco_blanco: [],
    coco_verde: [],
    coco_rojo: [],
    coco_azul: [],
  };

  private get messages(): ChatMessage[] {
    if (!this.chatHistories[this.activeMember.id]) {
      this.chatHistories[this.activeMember.id] = [];
    }
    return this.chatHistories[this.activeMember.id];
  }

  private thinkingByAgent: Record<string, boolean> = {
    coco_blanco: false,
    coco_verde: false,
    coco_rojo: false,
    coco_azul: false,
  };

  private attachedFilesByAgent: Record<string, AttachedMedia | null> = {
    coco_blanco: null,
    coco_verde: null,
    coco_rojo: null,
    coco_azul: null,
  };

  private taskCompletedUnread: Record<string, boolean> = {
    coco_blanco: false,
    coco_verde: false,
    coco_rojo: false,
    coco_azul: false,
  };

  private todos: TodoItem[] = [];
  private notes: QuickNote[] = [];
  private greenManager: GreenManager = new GreenManager();

  constructor() {
    this.loadStorage();
    this.greenManager.setOnInterventionToggle((isIntervened, contact) => {
      if (this.activeMember.id === "coco_verde") {
        const input = document.getElementById("chat-input") as HTMLInputElement | null;
        if (input) {
          input.placeholder = isIntervened
            ? `Escribir como asesor humano a ${contact.name}...`
            : `Escribir a Green (o simular mensaje de cliente)...`;
        }
      }
    });
    this.greenManager.setOnContactChange((contact) => {
      if (this.activeMember.id === "coco_verde") {
        const input = document.getElementById("chat-input") as HTMLInputElement | null;
        if (input) {
          input.placeholder = !contact.isBotActive
            ? `Escribir como asesor humano a ${contact.name}...`
            : `Escribir a Green (o simular mensaje de cliente)...`;
        }
      }
    });
  }

  private loadStorage() {
    try {
      const t = localStorage.getItem("coco_mobile_todos");
      if (t) this.todos = JSON.parse(t);
      const n = localStorage.getItem("coco_mobile_notes");
      if (n) this.notes = JSON.parse(n);
      const chats = localStorage.getItem("coco_mobile_chat_histories");
      if (chats) {
        this.chatHistories = JSON.parse(chats);
      }
    } catch {
      this.todos = [];
      this.notes = [];
      this.chatHistories = {
        coco_blanco: [],
        coco_verde: [],
        coco_rojo: [],
        coco_azul: [],
      };
    }
  }

  private saveStorage() {
    try {
      localStorage.setItem("coco_mobile_todos", JSON.stringify(this.todos));
      localStorage.setItem("coco_mobile_notes", JSON.stringify(this.notes));
      localStorage.setItem("coco_mobile_chat_histories", JSON.stringify(this.chatHistories));
      State.todos = this.todos;
      State.quickNotes = this.notes;
    } catch {}
  }

  public render() {
    const root = document.getElementById("root");
    if (!root) return;

    root.innerHTML = `
      <div id="app">
        <!-- 1. Compact Top App Bar -->
        <header class="compact-top-bar">
          <div class="top-bar-left">
            <div class="avatar-wrapper" id="avatar-btn" title="Tocar a Mochi">
              <canvas id="mascot-mini-canvas"></canvas>
            </div>
            <div class="agent-meta-info">
              <div class="agent-title-row">
                <span class="agent-name-text coco-name-animated" id="header-agent-name">${this.activeMember.name}</span>
                <div class="status-dot-pulse" id="header-pulse"></div>
              </div>
              <span class="agent-subtitle-text" id="header-agent-role">${this.activeMember.role} · En línea</span>
            </div>
          </div>

          <!-- 4 Compact Squad Chips on the Right -->
          <div class="top-bar-right" id="top-squad-chips"></div>
        </header>

        <!-- 2. Main Views Area (Maximized Chat Area) -->
        <main class="main-view-container">
          <!-- Chat Page -->
          <div class="view-page active" id="page-chat">
            <div class="chat-page">
              <!-- Empty State View (Welcome screen) -->
              <div class="chat-empty-state" id="chat-empty-state">
                <div class="empty-state-glow"></div>
                <div class="empty-state-content">
                  <h1 class="empty-state-title">¿Qué hacemos hoy?</h1>
                  <p class="empty-state-subtitle" id="empty-state-agent-hint"><span class="coco-name-animated">${this.activeMember.name}</span> está listo para ayudarte</p>
                </div>
              </div>

              <!-- Chat Message History -->
              <div class="chat-history" id="chat-history" style="display: none;"></div>

              <!-- Green Inbox & Live Takeover (Dedicated modular view for WhatsApp & Customer chats) -->
              <div id="green-inbox-container" style="display: none; flex: 1; flex-direction: column; height: 100%; min-height: 0; width: 100%; overflow: hidden;"></div>

              <!-- Floating Tools Popup Card (+) -->
              <div class="tools-popup-overlay hidden" id="tools-popup-overlay"></div>
              <div class="tools-popup-card hidden" id="tools-popup-card">
                <div class="tools-popup-header">
                  <div class="tools-popup-title-row">
                    <span class="tools-popup-dot" id="tools-popup-dot"></span>
                    <span class="tools-popup-title" id="tools-popup-title">Herramientas · ${this.activeMember.name}</span>
                  </div>
                  <button class="tools-popup-close-btn" id="btn-close-tools" title="Cerrar">✕</button>
                </div>
                <div class="tools-popup-grid" id="tools-popup-list"></div>
              </div>

              <div id="attached-chip-container" style="padding: 0 14px;"></div>
              <input type="file" id="mobile-devour-input" style="display:none;" accept="image/*,video/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.txt" />

              <div class="chat-input-bar">
                <button class="btn-icon-round btn-tools-trigger" id="btn-tools-plus" title="Herramientas y atajos">+</button>
                <input type="text" class="chat-input-field" id="chat-input" placeholder="Preguntale a Coco..." />
                <button class="btn-send-round" id="btn-send" title="Enviar">➤</button>
              </div>
            </div>
          </div>

          <!-- Devour Page -->
          <div class="view-page" id="page-devour">
            <div class="devour-page">
              <div class="devour-main-card">
                <h2 class="devour-header-title">Alimentar a Coco</h2>
                <p class="devour-header-desc">Subí fotos, documentos o capturas. Coco los absorberá con su boca de succión y los analizará con IA.</p>

                <div class="devour-stage-box">
                  <canvas id="devour-canvas"></canvas>
                </div>

                <div class="devour-button-row">
                  <button class="devour-action-btn primary" id="btn-camera">
                    📸 Tomar Foto
                  </button>
                  <button class="devour-action-btn secondary" id="btn-gallery">
                    📁 Subir Archivo
                  </button>
                </div>

                <input type="file" id="input-camera" accept="image/*,.heic,.heif" capture="environment" style="display:none;" />
                <input type="file" id="input-gallery" accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.txt" style="display:none;" />
              </div>
            </div>
          </div>

          <!-- Tasks Page -->
          <div class="view-page" id="page-tasks">
            <div class="tasks-page">
              <div class="card-box">
                <div class="card-box-header">
                  <span>Tareas Pendientes</span>
                  <button class="card-action-chip" id="btn-add-todo">+ Nueva Tarea</button>
                </div>
                <div id="todo-container" style="display:flex; flex-direction:column; gap:8px;"></div>
              </div>

              <div class="card-box">
                <div class="card-box-header">
                  <span>Notas Rápidas (Taby)</span>
                  <button class="card-action-chip" id="btn-add-note">+ Nueva Nota</button>
                </div>
                <div id="notes-container" style="display:flex; flex-direction:column; gap:8px;"></div>
              </div>
            </div>
          </div>
        </main>

        <!-- 3. Bottom Navigation Bar -->
        <nav class="bottom-nav-bar">
          <button class="nav-item-btn active" data-tab="chat">
            <span class="nav-item-icon">💬</span>
            <span class="nav-item-label">Chat</span>
          </button>
          <button class="nav-item-btn" data-tab="devour">
            <span class="nav-item-icon">🥥</span>
            <span class="nav-item-label">Devorar</span>
          </button>
          <button class="nav-item-btn" data-tab="tasks">
            <span class="nav-item-icon">📋</span>
            <span class="nav-item-label">Tareas</span>
          </button>
        </nav>

        <!-- 4. Devour Source Selector Bottom Sheet (Dark Glassmorphism) -->
        <div class="devour-sheet-overlay hidden" id="devour-sheet-overlay"></div>
        <div class="devour-sheet-card hidden" id="devour-sheet-card">
          <div class="devour-sheet-handle"></div>
          <div class="devour-sheet-header">
            <div class="devour-sheet-title-col">
              <div class="devour-sheet-title">Devorar con Coco</div>
              <div class="devour-sheet-subtitle">Elegí el origen para que Coco lo engulla y analice con IA</div>
            </div>
            <button class="devour-sheet-close" id="btn-close-devour-sheet" title="Cerrar">✕</button>
          </div>

          <div class="devour-sheet-options">
            <button class="devour-option-btn" id="sheet-btn-camera">
              <div class="devour-option-icon-box camera">
                <span class="devour-option-emoji">📷</span>
              </div>
              <div class="devour-option-text">
                <span class="devour-option-title">Cámara</span>
                <span class="devour-option-desc">Sacar foto o grabar video en directo</span>
              </div>
              <span class="devour-option-arrow">›</span>
            </button>

            <button class="devour-option-btn" id="sheet-btn-gallery">
              <div class="devour-option-icon-box gallery">
                <span class="devour-option-emoji">📁</span>
              </div>
              <div class="devour-option-text">
                <span class="devour-option-title">Archivos / Galería</span>
                <span class="devour-option-desc">Fotos, videos, documentos o PDFs</span>
              </div>
              <span class="devour-option-arrow">›</span>
            </button>
          </div>

          <input type="file" id="devour-sheet-input-camera" accept="image/*,video/*,.heic,.heif" capture="environment" style="display:none;" />
          <input type="file" id="devour-sheet-input-gallery" accept="image/*,video/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.txt" style="display:none;" />
        </div>

        <!-- 5. Green WhatsApp Contacts Bottom Sheet (Modal vertical) -->
        <div class="green-sheet-overlay hidden" id="green-sheet-overlay"></div>
        <div class="green-sheet-card hidden" id="green-sheet-card"></div>
      </div>
    `;

    // Set initial CSS variables
    document.documentElement.style.setProperty("--coco-accent", this.activeMember.color);
    document.documentElement.style.setProperty("--coco-glow", this.activeMember.glow);
    document.documentElement.style.setProperty("--coco-bg-tint", this.activeMember.bgTint);
    document.documentElement.style.setProperty("--coco-send-color", this.activeMember.sendTextColor || "#000000");

    this.initMascotCanvas();
    this.initDevourCanvas();
    this.renderTopSquadChips();
    this.renderChatMessages();
    this.renderAttachedFileChip();
    this.renderTasks();
    this.bindEvents();
    void Sound.preload();

    // Register native system notification navigator and presence handler
    registerAgentNavigator((agentId: string) => {
      const found = SQUAD.find((s) => s.id === agentId || s.squadRole === agentId);
      if (found) {
        this.switchToChatView();
        this.selectSquadMember(found);
      }
    });

    initSystemPresence(() => {
      const hasAnyUnread = Object.values(this.taskCompletedUnread).some(Boolean);
      if (!hasAnyUnread) {
        void clearAppBadge();
      }
    });

    // Check URL parameters for fast debugging/testing: ?agent=coco_verde&unread=coco_blanco
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetAgent = urlParams.get("agent");
      if (targetAgent) {
        const found = SQUAD.find((s) => s.id === targetAgent || s.squadRole === targetAgent);
        if (found) {
          this.selectSquadMember(found);
        }
      }
      const unreadAgent = urlParams.get("unread");
      if (unreadAgent && Object.prototype.hasOwnProperty.call(this.taskCompletedUnread, unreadAgent)) {
        this.taskCompletedUnread[unreadAgent] = true;
        this.renderTopSquadChips();
      }
      if (urlParams.get("sheet") === "green") {
        setTimeout(() => this.greenManager.openSheet(), 150);
      }
      if (urlParams.get("test") === "squad_assist") {
        setTimeout(() => window.testSquadAssist?.(), 600);
      }
    } catch {
      // ignore
    }

    // Expose test trigger in console
    window.testSquadAssist = async () => {
      this.switchToChatView();

      const blu = SQUAD.find((s) => s.id === "coco_azul") || SQUAD[3];
      this.selectSquadMember(blu);

      this.messages.push({
        id: Date.now(),
        role: "assistant",
        content: "Detecté una consulta entrante de un paciente sobre confirmación de turnos y reprogramaciones por WhatsApp. Nuestro especialista en comunicaciones es Green, así que le doy paso de inmediato...",
      });
      this.saveStorage();
      this.renderChatMessages();

      await this.executeSquadIntervention({
        from_coco_id: "coco_verde",
        from_name: "Green",
        badge_color: "#00E676",
        reply: "¡Hola! 💬 Ya revisé el hilo de WhatsApp con el paciente: confirmó el turno de mañana a las 15:30 hs y ya registré la respuesta en el sistema. ¡Todo listo!",
        delay_ms: 1000,
      });
    };
  }

  private initMascotCanvas() {
    this.mascotCanvas = document.getElementById("mascot-mini-canvas") as HTMLCanvasElement;
    if (!this.mascotCanvas) return;
    this.ctx = this.mascotCanvas.getContext("2d")!;

    if (this.animId) {
      cancelAnimationFrame(this.animId);
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = 40;
    const h = 40;
    this.mascotCanvas.width = Math.round(w * dpr);
    this.mascotCanvas.height = Math.round(h * dpr);
    this.mascotCanvas.style.width = `${w}px`;
    this.mascotCanvas.style.height = `${h}px`;

    this.engine.setState("idle");
    this.engine.setCocoSquadRole(this.activeMember.squadRole);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Frequent spontaneous playful animations every 3-6 seconds for protagonist Mochi
      if (now > this.nextIdleActionTime) {
        if (!this.engine.isUserTracking) {
          this.triggerPlayfulAction(this.engine, false);
        }
        this.nextIdleActionTime = now + 3000 + Math.random() * 3000;
      }

      this.engine.update(dt);

      this.ctx.resetTransform();
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.clearRect(0, 0, w, h);
      this.engine.draw(this.ctx, w, h);

      // Render the mini Mochis in top squad selector with independent blinks, breathing & micro-actions
      for (const mini of this.miniMochis) {
        const hasUnread = !!this.taskCompletedUnread[mini.member.id];
        if (hasUnread) {
          const nowSec = now / 1000;
          mini.engine.hands = 1;
          mini.engine.waveStart = nowSec - 0.2;
          mini.engine.waveUntil = nowSec + 2.0;
          mini.engine.eyeOverride = "happy";
          mini.engine.eyeOverrideUntil = nowSec + 2.0;

          if (now > mini.nextActionTime) {
            this.triggerUnreadCelebrationAction(mini.engine);
            mini.nextActionTime = now + 900;
          }
        } else if (now > mini.nextActionTime) {
          if (mini.engine.state === "idle") {
            this.triggerPlayfulAction(mini.engine, true);
          }
          mini.nextActionTime = now + 3500 + Math.random() * 3500;
        }

        mini.engine.update(dt);
        mini.ctx.setTransform(mini.dpr, 0, 0, mini.dpr, 0, 0);
        mini.ctx.clearRect(0, 0, mini.w, mini.h);
        mini.engine.draw(mini.ctx, mini.w, mini.h);
      }

      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  public initDevourCanvas() {
    this.devourCanvas = document.getElementById("devour-canvas") as HTMLCanvasElement | null;
    if (!this.devourCanvas) return;
    this.devourCtx = this.devourCanvas.getContext("2d");
    if (!this.devourCtx) return;

    if (this.devourAnimId) {
      cancelAnimationFrame(this.devourAnimId);
      this.devourAnimId = 0;
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.devourCanvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (this.devourCanvas.parentElement?.clientWidth || 280);
    const h = rect.height > 0 ? rect.height : (this.devourCanvas.parentElement?.clientHeight || 180);

    this.devourCanvas.width = Math.round(w * dpr);
    this.devourCanvas.height = Math.round(h * dpr);
    this.devourCanvas.style.width = `${w}px`;
    this.devourCanvas.style.height = `${h}px`;

    // 1. Limpieza total y reinicio de matriz para descartar cualquier desfasaje previo o restos de animación
    this.devourCtx.resetTransform();
    this.devourCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.devourCtx.clearRect(0, 0, w, h);

    // 2. Sincronizar el motor del Mochi devorador con el rol y postura del agente activo
    this.devourEngine.resetToBase();
    this.devourEngine.setCocoSquadRole(this.activeMember.squadRole);
    this.devourEngine.setState("idle");

    let last = performance.now();
    const loop = (now: number) => {
      if (this.devourCanvas && this.devourCtx) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        this.devourEngine.update(dt);

        this.devourCtx.resetTransform();
        this.devourCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.devourCtx.clearRect(0, 0, w, h);

        // Reposicionamiento simétrico y proporcional de cuerpo, ambos ojos y boca del Mochi
        this.devourEngine.draw(this.devourCtx, w, h);
      }
      this.devourAnimId = requestAnimationFrame(loop);
    };

    this.devourAnimId = requestAnimationFrame(loop);
  }

  private triggerPlayfulAction(engine: BotEngine, isMini = false) {
    if (engine.state !== "idle" && !isMini) return;

    const action = Math.floor(Math.random() * 4);
    const mult = isMini ? 0.7 : 1.0;

    switch (action) {
      case 0: {
        // 1. Doble pestañeo simétrico (ambos ojos parpadean juntos) + micro-tilt
        engine.blink();
        engine.anim("tilt", [
          [0.10 * mult, 140, Ease.out],
          [0.10 * mult, isMini ? 400 : 600, Ease.lin],
          [0, 180, Ease.inOut],
        ]);
        if (!isMini) Sound.play("blip");
        break;
      }
      case 1: {
        // 2. Saludar con un rebote alegre y ojos felices ^^
        engine.eyeOverride = "happy";
        engine.eyeOverrideUntil = (performance.now() / 1000) + (isMini ? 0.7 : 0.9);
        engine.anim("oy", [
          [-0.20 * mult, 130, Ease.out],
          [0.05 * mult, 150, Ease.inOut],
          [-0.08 * mult, 110, Ease.out],
          [0, 130, Ease.back],
        ]);
        engine.anim("sy", [
          [1.18 * mult, 130, Ease.out],
          [0.90, 150, Ease.inOut],
          [1.06, 110, Ease.out],
          [1, 130, Ease.back],
        ]);
        engine.anim("sx", [
          [0.88, 130, Ease.out],
          [1.08, 150, Ease.inOut],
          [0.94, 110, Ease.out],
          [1, 130, Ease.back],
        ]);
        if (!isMini) Sound.play("pop");
        break;
      }
      case 2: {
        // 3. Pequeña compresión esponjosa (squash) elástica
        engine.squash();
        if (!isMini) Sound.play("tap");
        break;
      }
      case 3:
      default: {
        // 4. Inclinación de curiosidad tierna con mirada atenta y simétrica
        const side = Math.random() < 0.5 ? 1 : -1;
        engine.anim("tilt", [
          [0.12 * side * mult, 160, Ease.out],
          [0.12 * side * mult, isMini ? 500 : 700, Ease.lin],
          [0, 180, Ease.inOut],
        ]);
        engine.anim("pitch", [
          [-0.14 * mult, 160, Ease.out],
          [-0.14 * mult, isMini ? 500 : 700, Ease.lin],
          [0, 180, Ease.inOut],
        ]);
        engine.anim("es", [
          [1.15, 140, Ease.out],
          [1.15, isMini ? 500 : 700, Ease.lin],
          [1, 180, Ease.inOut],
        ]);
        break;
      }
    }
  }

  private triggerUnreadCelebrationAction(engine: BotEngine) {
    const t = performance.now() / 1000;
    engine.eyeOverride = "happy";
    engine.eyeOverrideUntil = t + 2.0;

    // 1. Agitar manitos enérgicamente (wave / flapping arms continuo)
    engine.hands = 1;
    engine.waveStart = t - 0.2;
    engine.waveUntil = t + 2.0;
    engine.anim("hands", [[1, 100, Ease.out], [1, 700, Ease.lin], [0.85, 120, Ease.inOut]]);

    // 2. Rebote alegre y enérgico (bounce continuo)
    engine.anim("oy", [
      [-0.32, 130, Ease.out],
      [0.08, 140, Ease.inOut],
      [-0.16, 110, Ease.out],
      [0, 130, Ease.back],
    ]);
    engine.anim("sy", [
      [1.28, 130, Ease.out],
      [0.82, 140, Ease.inOut],
      [1.12, 110, Ease.out],
      [1, 130, Ease.back],
    ]);
    engine.anim("sx", [
      [0.78, 130, Ease.out],
      [1.18, 140, Ease.inOut],
      [0.92, 110, Ease.out],
      [1, 130, Ease.back],
    ]);
  }

  private renderTopSquadChips() {
    const bar = document.getElementById("top-squad-chips");
    if (!bar) return;

    bar.innerHTML = "";
    this.miniMochis = [];

    // Only display members OTHER than the active one (dynamic swap filter)
    const available = SQUAD.filter((m) => m.id !== this.activeMember.id);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = 30;
    const h = 30;

    available.forEach((m, idx) => {
      const isThinking = !!this.thinkingByAgent[m.id];
      const hasUnread = !isThinking && !!this.taskCompletedUnread[m.id];
      const btn = document.createElement("button");
      btn.className = `squad-mochi-chip ${isThinking ? "thinking" : ""} ${hasUnread ? "has-unread" : ""}`;
      btn.dataset.agentId = m.id;
      btn.id = `squad-chip-${m.id}`;
      btn.style.setProperty("--chip-accent", m.color);
      btn.title = isThinking
        ? `${m.name} está procesando con IA...`
        : hasUnread
        ? `¡${m.name} completó el análisis! Toca para ver la respuesta`
        : `Cambiar a ${m.name} (${m.role})`;
      btn.setAttribute("aria-label", m.name);

      const canvas = document.createElement("canvas");
      canvas.className = "squad-mochi-canvas";
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      btn.appendChild(canvas);

      if (hasUnread) {
        const unreadBadge = document.createElement("span");
        unreadBadge.className = "mini-mochi-unread-badge";
        unreadBadge.style.backgroundColor = m.color;
        unreadBadge.style.boxShadow = `0 0 10px ${m.glow}`;
        btn.appendChild(unreadBadge);
      } else if (isThinking) {
        const pulseBadge = document.createElement("span");
        pulseBadge.className = "mini-mochi-thinking-badge";
        pulseBadge.style.backgroundColor = m.color;
        pulseBadge.style.boxShadow = `0 0 6px ${m.glow}`;
        btn.appendChild(pulseBadge);
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const engine = new BotEngine();
      engine.setState(isThinking ? "thinking" : "idle");
      engine.setCocoSquadRole(m.squadRole);
      engine.isUserTracking = false;
      if (hasUnread) {
        engine.eyeOverride = "happy";
        engine.eyeOverrideUntil = (performance.now() / 1000) + 3600;
        engine.hands = 1;
        engine.waveStart = (performance.now() / 1000) - 0.2;
        engine.waveUntil = (performance.now() / 1000) + 3600;
      }

      this.miniMochis.push({
        member: m,
        canvas,
        ctx,
        engine,
        w,
        h,
        dpr,
        nextActionTime: performance.now() + 600 + Math.random() * 800 + idx * 400,
      });

      btn.addEventListener("click", () => {
        engine.triggerEmote("wink", 0.8);
        this.selectSquadMember(m);
      });

      bar.appendChild(btn);
    });
  }

  public selectSquadMember(m: SquadMember) {
    this.activeMember = m;
    // Apagar aviso persistente y resetear flag al entrar al chat de este Coco
    this.taskCompletedUnread[m.id] = false;
    const remainingUnread = Object.values(this.taskCompletedUnread).filter(Boolean).length;
    if (remainingUnread === 0) {
      void clearAppBadge();
    } else {
      void setAppBadge(remainingUnread);
    }
    for (const mini of this.miniMochis) {
      if (mini.member.id === m.id || !this.taskCompletedUnread[mini.member.id]) {
        mini.engine.waveStart = 0;
        mini.engine.waveUntil = 0;
        mini.engine.hands = 0;
        mini.engine.eyeOverride = null;
      }
    }
    this.renderTopSquadChips();
    if (this.isToolsMenuOpen) {
      this.renderToolsMenu();
    }

    // Update CSS variables
    document.documentElement.style.setProperty("--coco-accent", m.color);
    document.documentElement.style.setProperty("--coco-glow", m.glow);
    document.documentElement.style.setProperty("--coco-bg-tint", m.bgTint);
    document.documentElement.style.setProperty("--coco-send-color", m.sendTextColor || "#000000");

    // Update Header info
    const nameEl = document.getElementById("header-agent-name");
    const roleEl = document.getElementById("header-agent-role");
    const pulseEl = document.getElementById("header-pulse");
    if (nameEl) nameEl.textContent = m.name;
    if (roleEl) roleEl.textContent = `${m.role} · En línea`;
    if (pulseEl) {
      pulseEl.style.backgroundColor = m.color;
      if (this.thinkingByAgent[m.id]) {
        pulseEl.classList.add("thinking");
      } else {
        pulseEl.classList.remove("thinking");
      }
    }

    // Update Empty State subtitle if visible
    const emptyHint = document.getElementById("empty-state-agent-hint");
    if (emptyHint) emptyHint.innerHTML = `<span class="coco-name-animated">${m.name}</span> está listo para ayudarte`;

    // Ensure green-inbox-container is hidden / unmounted across all agents (prohibits split screen)
    const greenContainer = document.getElementById("green-inbox-container");
    if (greenContainer) {
      greenContainer.style.display = "none";
      this.greenManager.unmount();
    }

    const chatInput = document.getElementById("chat-input") as HTMLInputElement | null;
    if (chatInput) {
      chatInput.placeholder = `Preguntale a ${m.name}...`;
    }

    // Always render unified vertical chat for all Mochis
    this.renderChatMessages();

    // Render Attached File Chip for this specific Coco
    this.renderAttachedFileChip();

    // Update Mascot in mini canvas with guaranteed clean baseline face (both eyes & cute smile)
    this.resetMochiToBase();
    this.engine.setCocoSquadRole(m.squadRole);
    if (this.thinkingByAgent[m.id]) {
      this.engine.setState("thinking");
    } else {
      this.engine.setState("idle");
    }
    Sound.play("blip");
    this.initDevourCanvas();

    if (navigator.vibrate) navigator.vibrate(12);
  }

  public switchAgent(id: string) {
    const target = SQUAD.find((m) => m.id === id);
    if (target) {
      this.selectSquadMember(target);
    }
  }

  private toggleToolsMenu() {
    if (this.isToolsMenuOpen) {
      this.closeToolsMenu();
    } else {
      this.openToolsMenu();
    }
  }

  private openToolsMenu() {
    this.isToolsMenuOpen = true;
    this.renderToolsMenu();
    const overlay = document.getElementById("tools-popup-overlay");
    const card = document.getElementById("tools-popup-card");
    const plusBtn = document.getElementById("btn-tools-plus");
    if (overlay) overlay.classList.remove("hidden");
    if (card) card.classList.remove("hidden");
    if (plusBtn) plusBtn.classList.add("active");
    Sound.play("open");
  }

  private closeToolsMenu() {
    if (!this.isToolsMenuOpen) return;
    this.isToolsMenuOpen = false;
    const overlay = document.getElementById("tools-popup-overlay");
    const card = document.getElementById("tools-popup-card");
    const plusBtn = document.getElementById("btn-tools-plus");
    if (overlay) overlay.classList.add("hidden");
    if (card) card.classList.add("hidden");
    if (plusBtn) plusBtn.classList.remove("active");
  }

  private renderToolsMenu() {
    const titleEl = document.getElementById("tools-popup-title");
    const dotEl = document.getElementById("tools-popup-dot");
    const listEl = document.getElementById("tools-popup-list");
    if (!listEl) return;

    if (titleEl) titleEl.textContent = `Herramientas · ${this.activeMember.name}`;
    if (dotEl) {
      dotEl.style.backgroundColor = this.activeMember.color;
      dotEl.style.boxShadow = `0 0 8px ${this.activeMember.glow}`;
    }

    listEl.innerHTML = "";
    const tools = SQUAD_TOOLS[this.activeMember.id] || SQUAD_TOOLS.coco_blanco;

    tools.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "tool-item-btn";
      btn.innerHTML = `
        <span class="tool-item-icon">${t.icon}</span>
        <div class="tool-item-text">
          <span class="tool-item-title">${t.title}</span>
          <span class="tool-item-desc">${t.desc}</span>
        </div>
      `;

      btn.addEventListener("click", () => {
        this.closeToolsMenu();
        if (t.prompt) {
          this.sendChatMessage(t.prompt);
        } else if (t.actionType === "todo") {
          const text = prompt("Nueva tarea para Coco Squad:");
          if (text && text.trim()) {
            this.todos.push({
              id: Date.now().toString(),
              text: text.trim(),
              done: false,
              createdAt: Date.now(),
            });
            this.saveStorage();
            this.renderTasks();
            Sound.play("tick");
          }
        } else if (t.actionType === "note") {
          const text = prompt("Nueva nota rápida:");
          if (text && text.trim()) {
            this.notes.push({
              id: Date.now().toString(),
              text: text.trim(),
              createdAt: Date.now(),
            });
            this.saveStorage();
            this.renderTasks();
            Sound.play("tick");
          }
        }
      });

      listEl.appendChild(btn);
    });
  }

  private renderChatMessages() {
    const emptyState = document.getElementById("chat-empty-state");
    const container = document.getElementById("chat-history");
    if (!container) return;

    if (this.messages.length === 0) {
      if (emptyState) emptyState.style.display = "flex";
      container.style.display = "none";
      container.innerHTML = "";
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    container.style.display = "flex";
    container.innerHTML = "";
    this.messages.forEach((msg) => {
      const row = document.createElement("div");
      row.className = `chat-bubble-row ${msg.role}`;

      const bubble = document.createElement("div");
      bubble.className = "chat-bubble";

      if (msg.role === "assistant") {
        const badge = document.createElement("div");
        if (msg.intervention) {
          badge.className = "chat-agent-badge squad-assist-badge";
          badge.style.setProperty("--agent-badge-color", msg.intervention.badge_color);
          badge.innerHTML = `
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${msg.intervention.badge_color};box-shadow:0 0 8px ${msg.intervention.badge_color};"></span>
            <span class="coco-name-animated" style="color:${msg.intervention.badge_color};">${msg.intervention.from_name}</span>
            <span class="squad-assist-tag" style="color:${msg.intervention.badge_color};border-color:${msg.intervention.badge_color}55;">Squad Assist</span>
          `;
          row.appendChild(badge);
          bubble.className = "chat-bubble squad-assist-bubble";
          bubble.style.setProperty("--agent-badge-color", msg.intervention.badge_color);
          bubble.innerHTML = `
            <div class="message-content">${marked.parse(msg.content, { async: false }) as string}</div>
            <div class="squad-assist-footer" style="display:flex;">
              <span class="squad-returned-indicator">↩ <strong>${msg.intervention.from_name}</strong> volvió a su puesto</span>
            </div>
          `;
        } else {
          badge.className = "chat-agent-badge";
          badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${this.activeMember.color};"></span> <span class="coco-name-animated">${this.activeMember.name}</span>`;
          row.appendChild(badge);
          bubble.innerHTML = `<div class="message-content">${marked.parse(msg.content, { async: false }) as string}</div>`;
        }
      } else {
        bubble.innerHTML = `<div class="message-content user">${marked.parse(msg.content, { async: false }) as string}</div>`;
      }

      row.appendChild(bubble);
      container.appendChild(row);
    });

    if (this.thinkingByAgent[this.activeMember.id]) {
      const row = document.createElement("div");
      row.className = "chat-bubble-row assistant";
      row.innerHTML = `
        <div class="typing-pill">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
      container.appendChild(row);
    }

    container.scrollTop = container.scrollHeight;
  }

  public async flyBackToHeader(
    avatarEl: HTMLElement,
    headerTargetEl: HTMLElement,
    fromName: string,
    badgeColor: string,
    footerEl?: HTMLElement
  ): Promise<void> {
    const startRect = avatarEl.getBoundingClientRect();
    const targetRect = headerTargetEl.getBoundingClientRect();

    // 1. Create floating clone
    const clone = document.createElement("div");
    clone.className = "squad-flying-clone";
    clone.style.left = `${startRect.left}px`;
    clone.style.top = `${startRect.top}px`;
    clone.style.width = `${startRect.width}px`;
    clone.style.height = `${startRect.height}px`;
    clone.style.boxShadow = `0 0 16px ${badgeColor}, 0 0 8px #ffffff`;

    // Copy inner HTML (including canvas if present)
    clone.innerHTML = avatarEl.innerHTML;
    const origCanvas = avatarEl.querySelector("canvas");
    const cloneCanvas = clone.querySelector("canvas");
    if (origCanvas && cloneCanvas) {
      const cloneCtx = cloneCanvas.getContext("2d");
      if (cloneCtx) cloneCtx.drawImage(origCanvas, 0, 0);
    }

    document.body.appendChild(clone);
    Sound.play("blip");

    // Force reflow
    void clone.offsetWidth;

    // 2. Vector distance from start center to target center
    const startCenterX = startRect.left + startRect.width / 2;
    const startCenterY = startRect.top + startRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const deltaX = targetCenterX - startCenterX;
    const deltaY = targetCenterY - startCenterY;
    const scale = targetRect.width > 0 ? targetRect.width / startRect.width : 1.35;

    clone.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;

    // Fly in 650ms with cubic-bezier(0.25, 1, 0.5, 1)
    await new Promise((resolve) => setTimeout(resolve, 650));

    // 3. Docking: remove clone
    clone.remove();

    // Restore opacity and remove calling state
    headerTargetEl.classList.remove("mochi-calling");
    headerTargetEl.style.opacity = "";

    // Light pulse burst on seat
    headerTargetEl.classList.remove("mochi-returned-pulse");
    void headerTargetEl.offsetWidth; // force reflow
    headerTargetEl.classList.add("mochi-returned-pulse");
    setTimeout(() => headerTargetEl.classList.remove("mochi-returned-pulse"), 900);

    Sound.play("pop");
    if (navigator.vibrate) navigator.vibrate([15, 30, 20]);

    // Place discrete footer below bubble
    if (footerEl) {
      footerEl.innerHTML = `<span class="squad-returned-indicator">↩ <strong>${fromName}</strong> volvió a su puesto</span>`;
      footerEl.style.display = "flex";
    }
  }

  public setAgentThinking(agentId: string, isThinking: boolean) {
    this.thinkingByAgent[agentId] = isThinking;
    const pulseEl = document.getElementById("header-pulse");
    if (this.activeMember.id === agentId) {
      if (pulseEl) {
        if (isThinking) pulseEl.classList.add("thinking");
        else pulseEl.classList.remove("thinking");
      }
      this.engine.setState(isThinking ? "thinking" : "idle");
      // Formally purge any typing indicator pill from the DOM when thinking finishes
      if (!isThinking) {
        document.querySelectorAll(".typing-pill, .thinking-indicator-row").forEach((el) => {
          el.closest(".chat-bubble-row")?.remove();
        });
      }
      this.renderChatMessages();
    }
    this.renderTopSquadChips();
  }

  public async executeEphemeralSquadAssist(
    summonedAgentId: 'coco_blanco' | 'coco_verde' | 'coco_rojo' | 'coco_azul',
    speechText: string = "¡Yo me encargo!"
  ): Promise<void> {
    const summonedMember = SQUAD.find((s) => s.id === summonedAgentId);
    if (!summonedMember) return;

    // 1. Localizar icono del agente convocado en la cabecera
    const headerTargetEl =
      document.querySelector<HTMLElement>(`#top-squad-chips [data-agent-id="${summonedAgentId}"]`) ||
      document.getElementById(`squad-chip-${summonedAgentId}`) ||
      document.getElementById("avatar-btn");

    if (headerTargetEl) {
      headerTargetEl.classList.add("mochi-calling");
      headerTargetEl.style.opacity = "0.35";
      Sound.play("tap");
    }

    // 2. Ubicar la última burbuja del agente que delega en el chat
    const chatHistory = document.getElementById("chat-history");
    const lastRow =
      chatHistory?.querySelector<HTMLElement>(".chat-bubble-row.assistant:last-child") ||
      chatHistory?.querySelector<HTMLElement>(".chat-bubble-row:last-child");

    const appEl = document.getElementById("app") || document.body;
    const appRect = appEl.getBoundingClientRect();

    const startRect = headerTargetEl
      ? headerTargetEl.getBoundingClientRect()
      : { left: appRect.left + appRect.width / 2, top: appRect.top + 50, width: 36, height: 36 };

    const startCenterX = startRect.left + startRect.width / 2;
    const startCenterY = startRect.top + startRect.height / 2;

    let targetLeft: number;
    let targetTop: number;

    if (lastRow) {
      const rowRect = lastRow.getBoundingClientRect();
      targetLeft = Math.max(appRect.left + 30, rowRect.left + 24);
      targetTop = Math.min(rowRect.bottom + 16, appRect.bottom - 130);
    } else {
      targetLeft = appRect.left + 40;
      targetTop = appRect.top + appRect.height * 0.45;
    }

    // 3. Crear actor flotante efímero (avatar 3D de Red / convocado)
    const actor = document.createElement("div");
    actor.className = "squad-ephemeral-actor";
    actor.style.left = `${startCenterX}px`;
    actor.style.top = `${startCenterY}px`;
    actor.style.setProperty("--agent-color", summonedMember.color);

    const miniCanvas = document.createElement("canvas");
    miniCanvas.width = 68;
    miniCanvas.height = 68;
    miniCanvas.style.width = "34px";
    miniCanvas.style.height = "34px";
    miniCanvas.className = "squad-ephemeral-canvas";
    const miniCtx = miniCanvas.getContext("2d");
    if (miniCtx) {
      const eng = new BotEngine();
      eng.setCocoSquadRole(summonedMember.squadRole);
      eng.eyeOverride = "happy";
      eng.draw(miniCtx, 34, 34);
    }
    actor.appendChild(miniCanvas);

    // 4. Crear globo de diálogo flotante efímero ("¡Yo me encargo!")
    const balloon = document.createElement("div");
    balloon.className = "squad-ephemeral-speech-balloon";
    balloon.style.setProperty("--agent-color", summonedMember.color);
    balloon.innerHTML = `
      <span class="speech-agent-tag">${summonedMember.name}</span>
      <span class="speech-text">${speechText}</span>
    `;

    document.body.appendChild(actor);
    document.body.appendChild(balloon);

    // Forzar reflujo inicial
    void actor.offsetWidth;

    // 5. Salto de descenso: el avatar salta desde la cabecera hacia el mensaje
    Sound.play("open");
    const deltaX = targetLeft - startCenterX;
    const deltaY = targetTop - startCenterY;
    actor.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.15)`;

    balloon.style.left = `${targetLeft + 36}px`;
    balloon.style.top = `${targetTop - 18}px`;

    setTimeout(() => {
      balloon.classList.add("visible");
      Sound.play("pop");
      if (navigator.vibrate) navigator.vibrate([15, 30, 20]);
    }, 280);

    // 6. Tiempo de lectura: 1.2 segundos (1200 ms)
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // 7. El globo flotante desaparece
    balloon.classList.remove("visible");
    balloon.classList.add("fade-out");

    // 8. Salto de retorno: el avatar regresa a su posición en la barra superior
    actor.style.transition = "transform 480ms cubic-bezier(0.25, 1, 0.5, 1), opacity 450ms ease";
    actor.style.transform = `translate(0px, 0px) scale(1)`;

    await new Promise((resolve) => setTimeout(resolve, 480));

    // 9. Limpieza completa de los nodos efímeros
    actor.remove();
    balloon.remove();

    if (headerTargetEl) {
      headerTargetEl.classList.remove("mochi-calling");
      headerTargetEl.style.opacity = "";
      headerTargetEl.classList.remove("mochi-returned-pulse");
      void headerTargetEl.offsetWidth; // force reflow
      headerTargetEl.classList.add("mochi-returned-pulse");
      setTimeout(() => headerTargetEl.classList.remove("mochi-returned-pulse"), 900);
      Sound.play("finish");
    }

    // 10. Conmutación automática: llevar al usuario a la vista del especialista
    this.selectSquadMember(summonedMember);
  }

  public async executeSquadIntervention(intervention: SquadIntervention): Promise<void> {
    // Interacción estrictamente efímera: ¡NUNCA agregar mensajes permanentes en el chat del agente que delega!
    await this.executeEphemeralSquadAssist(intervention.from_coco_id, "¡Yo me encargo!");

    // Si viene la respuesta para el especialista, cargarla ÚNICAMENTE en su estación
    const targetMember = SQUAD.find((s) => s.id === intervention.from_coco_id);
    if (targetMember && intervention.reply) {
      if (!this.chatHistories[targetMember.id]) {
        this.chatHistories[targetMember.id] = [];
      }

      if (intervention.user_prompt) {
        this.chatHistories[targetMember.id].push({
          id: Date.now(),
          role: "user",
          content: intervention.user_prompt,
        });
      }

      this.chatHistories[targetMember.id].push({
        id: Date.now() + 1,
        role: "assistant",
        content: intervention.reply,
      });

      this.saveStorage();
      this.setAgentThinking(targetMember.id, false);
      this.engine.setState("finished");
      this.engine.triggerEmote("happy");
      Sound.play("finish");
      notifyAgentCompletion(targetMember.id, targetMember.name, intervention.reply);
    }
  }

  private renderTasks() {
    const todoCont = document.getElementById("todo-container");
    if (todoCont) {
      todoCont.innerHTML = "";
      if (this.todos.length === 0) {
        todoCont.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:6px 0;">No hay tareas pendientes.</div>`;
      } else {
        this.todos.forEach((t) => {
          const item = document.createElement("div");
          item.className = "todo-item-row";
          item.innerHTML = `
            <input type="checkbox" class="todo-check" ${t.done ? "checked" : ""} />
            <span class="todo-text-label ${t.done ? "done" : ""}">${t.text}</span>
          `;
          item.querySelector(".todo-check")?.addEventListener("change", (e) => {
            t.done = (e.target as HTMLInputElement).checked;
            this.saveStorage();
            this.renderTasks();
            Sound.play("tick");
          });
          todoCont.appendChild(item);
        });
      }
    }

    const notesCont = document.getElementById("notes-container");
    if (notesCont) {
      notesCont.innerHTML = "";
      if (this.notes.length === 0) {
        notesCont.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:6px 0;">No hay notas creadas aún.</div>`;
      } else {
        this.notes.forEach((n) => {
          const item = document.createElement("div");
          item.className = "note-card-row";
          item.textContent = n.text;
          notesCont.appendChild(item);
        });
      }
    }
  }

  private bindEvents() {
    // Sound unlock on first touch
    document.addEventListener("touchstart", () => Sound.resume(), { once: true });
    document.addEventListener("click", () => Sound.resume(), { once: true });

    // Mascot petting
    const avatarWrapper = document.getElementById("avatar-btn");
    const petMascot = () => {
      this.engine.triggerEmote("love");
      Sound.play("love");
      if (navigator.vibrate) navigator.vibrate(25);
    };
    avatarWrapper?.addEventListener("click", petMascot);

    if (this.mascotCanvas) {
      this.mascotCanvas.addEventListener("click", petMascot);

      // Eye tracking on touch / mouse move with auto-idle fallback
      let userTrackingTimer: number | null = null;
      const onUserPointer = (clientX: number, clientY: number) => {
        this.engine.isUserTracking = true;
        const rect = this.mascotCanvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (clientX - cx) / (window.innerWidth / 2);
        const dy = (clientY - cy) / (window.innerHeight / 2);
        this.engine.lookX = Math.max(-0.35, Math.min(0.35, dx * 0.35));
        this.engine.lookY = Math.max(-0.3, Math.min(0.3, dy * 0.3));

        if (userTrackingTimer) window.clearTimeout(userTrackingTimer);
        userTrackingTimer = window.setTimeout(() => {
          this.engine.isUserTracking = false;
        }, 2200);
      };

      window.addEventListener("touchmove", (e) => {
        if (e.touches.length > 0) onUserPointer(e.touches[0].clientX, e.touches[0].clientY);
      });
      window.addEventListener("mousemove", (e) => {
        onUserPointer(e.clientX, e.clientY);
      });
    }

    // Bottom Navigation Bar tabs
    document.querySelectorAll(".nav-item-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.dataset.tab as "chat" | "devour" | "tasks";

        if (tab === "devour") {
          // Devour action: show Bottom Sheet so user can choose Cámara or Archivos / Galería
          this.openDevourSheet();
          return;
        }

        if (tab === this.activeTab) return;

        document.querySelectorAll(".nav-item-btn").forEach((b) => b.classList.remove("active"));
        target.classList.add("active");

        document.querySelectorAll(".view-page").forEach((p) => p.classList.remove("active"));
        document.getElementById(`page-${tab}`)?.classList.add("active");

        this.activeTab = tab;
        Sound.play("open");
      });
    });

    // Chat sending
    const input = document.getElementById("chat-input") as HTMLInputElement;
    const sendBtn = document.getElementById("btn-send");

    const doSend = () => {
      const text = input.value.trim();
      const attached = this.attachedFilesByAgent[this.activeMember.id];
      if ((!text && !attached) || this.thinkingByAgent[this.activeMember.id]) return;
      input.value = "";
      this.sendChatMessage(text);
    };

    sendBtn?.addEventListener("click", doSend);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSend();
    });

    // Tools popup (+) button trigger and overlay dismissal
    const plusBtn = document.getElementById("btn-tools-plus");
    const overlay = document.getElementById("tools-popup-overlay");
    const closeToolsBtn = document.getElementById("btn-close-tools");

    plusBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleToolsMenu();
    });
    overlay?.addEventListener("click", () => this.closeToolsMenu());
    closeToolsBtn?.addEventListener("click", () => this.closeToolsMenu());

    // Dismiss tools menu or devour bottom sheet if clicking outside
    document.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (this.isToolsMenuOpen) {
        if (!target.closest("#tools-popup-card") && !target.closest("#btn-tools-plus")) {
          this.closeToolsMenu();
        }
      }
      if (this.isDevourSheetOpen) {
        if (!target.closest("#devour-sheet-card") && !target.closest('[data-tab="devour"]')) {
          this.closeDevourSheet();
        }
      }
    });

    // Dismiss modals on Escape key
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.isDevourSheetOpen) this.closeDevourSheet();
        if (this.isToolsMenuOpen) this.closeToolsMenu();
      }
    });

    // Global drag & drop on screen for feeding/devouring files into current Coco
    const dropArea = document.getElementById("app") || document.body;
    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        void this.processFileToDevour(e.dataTransfer.files[0]);
      }
    });

    // Devour Bottom Sheet event handlers
    const sheetOverlay = document.getElementById("devour-sheet-overlay");
    const closeSheetBtn = document.getElementById("btn-close-devour-sheet");
    const sheetCamBtn = document.getElementById("sheet-btn-camera");
    const sheetGalBtn = document.getElementById("sheet-btn-gallery");
    const sheetCamInput = document.getElementById("devour-sheet-input-camera") as HTMLInputElement;
    const sheetGalInput = document.getElementById("devour-sheet-input-gallery") as HTMLInputElement;

    sheetCamBtn?.addEventListener("click", () => {
      sheetCamInput?.click();
    });

    sheetGalBtn?.addEventListener("click", () => {
      sheetGalInput?.click();
    });

    sheetOverlay?.addEventListener("click", () => {
      this.closeDevourSheet();
    });

    closeSheetBtn?.addEventListener("click", () => {
      this.closeDevourSheet();
    });

    sheetCamInput?.addEventListener("change", () => {
      if (sheetCamInput.files && sheetCamInput.files[0]) {
        const file = sheetCamInput.files[0];
        this.closeDevourSheet();
        void this.processFileToDevour(file);
        sheetCamInput.value = "";
      }
    });

    sheetGalInput?.addEventListener("change", () => {
      if (sheetGalInput.files && sheetGalInput.files[0]) {
        const file = sheetGalInput.files[0];
        this.closeDevourSheet();
        void this.processFileToDevour(file);
        sheetGalInput.value = "";
      }
    });

    // Native devour file selector (legacy fallback)
    const mobileDevourInput = document.getElementById("mobile-devour-input") as HTMLInputElement;
    mobileDevourInput?.addEventListener("change", () => {
      if (mobileDevourInput.files && mobileDevourInput.files[0]) {
        this.processFileToDevour(mobileDevourInput.files[0]);
      }
    });

    // Devour actions (if accessed from devour page)
    const camBtn = document.getElementById("btn-camera");
    const galBtn = document.getElementById("btn-gallery");
    const camInput = document.getElementById("input-camera") as HTMLInputElement;
    const galInput = document.getElementById("input-gallery") as HTMLInputElement;

    camBtn?.addEventListener("click", () => camInput?.click());
    galBtn?.addEventListener("click", () => galInput?.click());

    camInput?.addEventListener("change", () => {
      if (camInput.files && camInput.files[0]) this.processFileToDevour(camInput.files[0]);
    });
    galInput?.addEventListener("change", () => {
      if (galInput.files && galInput.files[0]) this.processFileToDevour(galInput.files[0]);
    });

    // Add todo and note
    document.getElementById("btn-add-todo")?.addEventListener("click", () => {
      const text = prompt("Nueva tarea para Coco Squad:");
      if (text && text.trim()) {
        this.todos.push({
          id: Date.now().toString(),
          text: text.trim(),
          done: false,
          createdAt: Date.now(),
        });
        this.saveStorage();
        this.renderTasks();
      }
    });

    document.getElementById("btn-add-note")?.addEventListener("click", () => {
      const text = prompt("Nueva nota rápida:");
      if (text && text.trim()) {
        this.notes.push({
          id: Date.now().toString(),
          text: text.trim(),
          createdAt: Date.now(),
        });
        this.saveStorage();
        this.renderTasks();
      }
    });

    // Horizontal Swipe Navigation between Cocos (Coco -> Green -> Red -> Blu -> Coco)
    if (this.swipeController) {
      this.swipeController.destroy();
    }
    const swipeTarget = document.getElementById("page-chat") || document.querySelector(".main-view-container") || document.body;
    this.swipeController = initSwipeController({
      container: swipeTarget,
      squadIds: SQUAD.map((m) => m.id),
      getCurrentAgentId: () => this.activeMember.id,
      onSwitchAgent: (agentId) => {
        this.switchAgent(agentId);
      },
      canSwipe: () => this.activeTab === "chat" && !this.isToolsMenuOpen && !this.isDevourSheetOpen,
      minDistance: 60,
      directionRatio: 1.5,
      enableMouseFallback: true,
    });
  }

  private async sendChatMessage(text: string) {
    void requestNotificationPermission();

    const targetMember = this.activeMember;
    const targetMemberId = targetMember.id;

    if (!this.chatHistories[targetMemberId]) {
      this.chatHistories[targetMemberId] = [];
    }

    const attached = this.attachedFilesByAgent[targetMemberId];
    // Inyectar prompt por defecto si el usuario sube imagen/archivo sin escribir texto
    let messageText = text.trim();
    if (!messageText && attached) {
      if (attached.isImage) {
        messageText = targetMemberId === "coco_verde"
          ? "Analiza detalladamente esta imagen de cliente (receta médica, orden de sesiones, derivación clínica o comprobante de pago). Si es una receta u orden médica, extrae diagnóstico, cantidad y tipo de sesiones prescritas, datos del paciente y profesional. Si es un comprobante de pago o transferencia, extrae monto, fecha, emisor y código de operación. Si la foto está borrosa o falta nitidez para leer algún dato crítico, indícalo amablemente explicando con precisión qué parte no se distingue."
          : "Analiza detalladamente esta imagen, describe qué ves y extrae cualquier texto o dato relevante.";
      } else if (attached.isVideo) {
        messageText = "Analiza detalladamente este video y describe su contenido y puntos clave.";
      } else {
        messageText = `Analiza detalladamente este documento (${attached.name}) y extrae sus puntos clave y resumen.`;
      }
    }

    // Burbuja del usuario con miniatura o icono de archivo
    let userBubbleContent = messageText;
    if (attached) {
      if (attached.isImage) {
        userBubbleContent = `🖼️ **${attached.name}** (${attached.fileSizeStr})\n\n${messageText}`;
      } else if (attached.isVideo) {
        userBubbleContent = `🎬 **${attached.name}** (${attached.fileSizeStr})\n\n${messageText}`;
      } else {
        userBubbleContent = `📁 **${attached.name}** (${attached.fileSizeStr})\n\n${messageText}`;
      }
    }

    // ─── UNIFIED SQUAD FLOW (BLANCO, VERDE, ROJO, AZUL) ───
    this.chatHistories[targetMemberId].push({
      id: Date.now(),
      role: "user",
      content: userBubbleContent,
    });
    this.saveStorage();

    // Limpiar adjunto del input tras enviar
    this.attachedFilesByAgent[targetMemberId] = null;
    if (this.activeMember.id === targetMemberId) {
      this.renderAttachedFileChip();
    }

    this.setAgentThinking(targetMemberId, true);
    if (this.activeMember.id === targetMemberId) {
      Sound.play("send");
      triggerHapticFeedback(12);
    }

    try {
      const pureB64 = attached
        ? (attached.base64.includes(",") ? attached.base64.split(",")[1] : attached.base64)
        : "";
      const lowerName = (attached ? attached.name : "").toLowerCase();
      const mimeType = attached
        ? (attached.isImage
            ? (lowerName.endsWith(".png") ? "image/png"
               : lowerName.endsWith(".webp") ? "image/webp"
               : lowerName.endsWith(".heic") ? "image/heic"
               : lowerName.endsWith(".heif") ? "image/heif"
               : "image/jpeg")
            : attached.isVideo
            ? "video/mp4"
            : lowerName.endsWith(".pdf")
            ? "application/pdf"
            : "text/plain")
        : "";

      const payload: Record<string, unknown> = {
        message: messageText,
        chat_id: 1,
        tenant_id: 1,
        coco_id: targetMemberId,
        file: attached
          ? {
              name: attached.name,
              data: pureB64,
              base64: pureB64,
              mime: mimeType,
            }
          : null,
        attachment: attached ? pureB64 : undefined,
        image: attached && attached.isImage ? pureB64 : undefined,
        mime_type: attached ? mimeType : undefined,
        contexto: attached
          ? {
              kind: "file",
              name: attached.name,
              archivo_base64: pureB64,
            }
          : null,
        todos: this.todos,
        notes: this.notes,
      };

      notifyRequestStart();
      const res = await fetch("http://150.136.59.173:8080/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Código de estado HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || data.respuesta || "Sin respuesta del escuadrón.";

      this.chatHistories[targetMemberId].push({
        id: Date.now() + 1,
        role: "assistant",
        content: reply,
      });
      this.saveStorage();
      this.setAgentThinking(targetMemberId, false);

      if (this.activeMember.id === targetMemberId) {
        this.renderChatMessages();
      }

      if (data.intervention) {
        await this.executeSquadIntervention({
          ...data.intervention,
          user_prompt: messageText,
        });
      } else {
        const agent = SQUAD.find((s) => s.id === targetMemberId);
        const agentName = agent ? agent.name : "Coco";

        if (this.activeMember.id === targetMemberId) {
          this.resetMochiToBase();
          this.engine.setState("finished");
          this.engine.triggerEmote("happy");
          Sound.play("finish");
          setTimeout(() => {
            if (this.activeMember.id === targetMemberId && this.engine.state === "finished") {
              this.resetMochiToBase();
            }
          }, 2200);
        } else {
          // Notificación persistente viva para el Coco que terminó en background
          this.taskCompletedUnread[targetMemberId] = true;
          this.renderTopSquadChips();
          Sound.play("finish");
        }
        notifyAgentCompletion(targetMemberId, `${agentName} respondió`, reply);
      }
    } catch (err: any) {
      const agent = SQUAD.find((s) => s.id === targetMemberId);
      const agentName = agent ? agent.name : "Coco";
      this.chatHistories[targetMemberId].push({
        id: Date.now() + 1,
        role: "assistant",
        content: `⚠️ No pude conectar con el servidor Oracle de Staging (150.136.59.173:8080):\n\n\`${err?.message || String(err)}\`\n\n*Asegurate de que el servidor esté activo o verificá la conexión.*`,
      });
      this.saveStorage();
      this.setAgentThinking(targetMemberId, false);
      if (this.activeMember.id === targetMemberId) {
        this.engine.setState("error");
        Sound.play("error");
      } else {
        this.taskCompletedUnread[targetMemberId] = true;
        this.renderTopSquadChips();
        Sound.play("blip");
      }
      notifyAgentCompletion(targetMemberId, `${agentName} · Error`, "No se pudo conectar con el servidor de Staging");
    } finally {
      notifyRequestEnd();
      this.setAgentThinking(targetMemberId, false);
    }
  }

  private switchToChatView() {
    this.activeTab = "chat";
    document.querySelectorAll(".nav-item-btn").forEach((b) => {
      const isChat = (b as HTMLElement).dataset.tab === "chat";
      b.classList.toggle("active", isChat);
    });
    document.querySelectorAll(".view-page").forEach((p) => p.classList.remove("active"));
    document.getElementById("page-chat")?.classList.add("active");
  }

  public openDevourSheet() {
    this.isDevourSheetOpen = true;
    this.switchToChatView();
    if (this.isToolsMenuOpen) this.closeToolsMenu();
    const overlay = document.getElementById("devour-sheet-overlay");
    const card = document.getElementById("devour-sheet-card");
    overlay?.classList.remove("hidden");
    card?.classList.remove("hidden");
    Sound.play("open");
  }

  public closeDevourSheet() {
    this.isDevourSheetOpen = false;
    const overlay = document.getElementById("devour-sheet-overlay");
    const card = document.getElementById("devour-sheet-card");
    overlay?.classList.add("hidden");
    card?.classList.add("hidden");
  }

  private readFileAsBase64(file: File): Promise<{ base64: string; dataUri: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        const base64 = dataUri.includes(",") ? dataUri.split(",")[1] : dataUri;
        resolve({ base64, dataUri });
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  private resetMochiToBase() {
    // 1. Full engine reset: clearing all tweens, locks, morph, slotH, scales, gaze, and reverting to idle
    this.engine.resetToBase();

    // 2. Reset canvas transformation matrix
    if (this.ctx) {
      try {
        this.ctx.resetTransform();
      } catch {}
    }
  }

  public async handleFileUpload(file: File) {
    await this.processFileToDevour(file);
  }

  private async processFileToDevour(file: File) {
    const targetMember = this.activeMember;
    try {
      const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif|gif|svg|bmp)$/i.test(file.name);
      const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|3gp|avi)$/i.test(file.name);
      const fileSizeStr = formatFileSize(file.size);
      const fileExt = (file.name.split(".").pop() || "FILE").toUpperCase().slice(0, 4);

      // Read file to Base64 and Data URL before launching animation
      const { base64, dataUri } = await this.readFileAsBase64(file);
      const thumbUrl = isImage ? dataUri : null;

      // UNIVERSAL DEVOUR: Always trigger authentic devour sequence on the active Mochi first!
      this.runAuthenticDevourSequence(targetMember, file, fileSizeStr, fileExt, isImage, isVideo, thumbUrl, base64, dataUri);
    } catch (err) {
      console.error("Error leyendo archivo:", err);
    }
  }

  private runAuthenticDevourSequence(
    targetMember: SquadMember,
    file: File,
    fileSizeStr: string,
    fileExt: string,
    isImage: boolean,
    isVideo: boolean,
    thumbUrl: string | null,
    base64: string,
    dataUri: string
  ) {
    const isTargetActive = this.activeMember.id === targetMember.id;
    if (isTargetActive) {
      this.switchToChatView();
    }

    const appEl = document.getElementById("app");
    const avatarBtn = document.getElementById("avatar-btn");
    if (!appEl || !avatarBtn || !isTargetActive) {
      // If agent is not currently active in UI, proceed directly to chewing & background analysis
      this.executeDevourChewingAndFeedback(targetMember, file, fileSizeStr, isImage, isVideo, base64, dataUri);
      return;
    }

    const avatarRect = avatarBtn.getBoundingClientRect();
    const appRect = appEl.getBoundingClientRect();

    // Center of protagonist Mochi's mouth relative to #app
    const targetX = avatarRect.left - appRect.left + avatarRect.width / 2;
    const targetY = avatarRect.top - appRect.top + avatarRect.height / 2 + 3;

    // Center of app horizontally, above bottom bar vertically
    const startX = appRect.width / 2;
    const startY = Math.max(140, appRect.height - 210);

    // Create the floating card element
    const card = document.createElement("div");
    card.className = "floating-devour-card";
    card.innerHTML = `
      <div class="devour-card-preview">
        ${
          isImage && thumbUrl
            ? `<img src="${thumbUrl}" class="devour-thumb" alt="${file.name}" />`
            : isVideo
            ? `<div class="devour-doc-icon" style="background:rgba(239,68,68,0.2);color:#ef4444;font-size:20px;">🎥</div>`
            : `<div class="devour-doc-icon">${fileExt}</div>`
        }
      </div>
      <div class="devour-card-info">
        <div class="devour-card-name">${file.name}</div>
        <div class="devour-card-meta">${isVideo ? "VIDEO" : fileExt} · ${fileSizeStr}</div>
      </div>
    `;

    card.style.left = `${startX}px`;
    card.style.top = `${startY}px`;
    card.style.transform = "translate(-50%, -50%) scale(0.6)";
    card.style.opacity = "0";
    appEl.appendChild(card);

    // Phase 1: Card pops up & Mochi reacts (0ms -> 320ms)
    requestAnimationFrame(() => {
      card.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease";
      card.style.transform = "translate(-50%, -50%) scale(1)";
      card.style.opacity = "1";
    });

    Sound.play("attach");

    // Mochi spots the card, gets excited, morphs body and opens mouth wide
    if (this.activeMember.id === targetMember.id) {
      this.engine.isUserTracking = false;
      this.engine.lookY = 0.5;
      this.engine.lookX = 0;
      this.engine.animateMorph(1, 320);
      this.engine.slotHTarget = 0.65;
      this.engine.eyeOverride = "cup";
    }
    Sound.play("open");

    // Phase 2: Suction flight towards Mochi's mouth (after 320ms)
    setTimeout(() => {
      card.style.transition = "none";
      const flightDuration = 780; // ms
      const flightStart = performance.now();
      let gulped = false;

      const flightStep = (now: number) => {
        const elapsed = now - flightStart;
        const rawP = Math.min(elapsed / flightDuration, 1);

        // Accelerated suction trajectory curving into Mochi's mouth slot
        const pTraj = Math.pow(rawP, 1.4);
        const curX = startX + (targetX - startX) * pTraj;
        const curY = startY + (targetY - startY) * pTraj;

        let scale = 1;
        let opacity = 1;
        let blur = 0;
        let rot = 0;

        // In the final 48% of trajectory, card is pulled into the mouth
        if (rawP > 0.52) {
          const suckP = (rawP - 0.52) / 0.48; // 0 -> 1
          scale = Math.max(0, 1 - suckP);
          opacity = Math.max(0, 1 - Math.pow(suckP, 1.8));
          blur = suckP * 5;
          rot = suckP * -18;
        }

        card.style.left = `${curX}px`;
        card.style.top = `${curY}px`;
        card.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`;
        card.style.opacity = `${opacity}`;
        card.style.filter = blur > 0 ? `blur(${blur}px)` : "none";

        // Mochi's head & eyes track the card smoothly without eye distortion or culling
        if (this.activeMember.id === targetMember.id) {
          const dx = (curX - targetX) / appRect.width;
          const dy = (curY - targetY) / appRect.height;
          this.engine.lookX = Math.max(-0.35, Math.min(0.35, dx));
          this.engine.lookY = Math.max(-0.4, Math.min(0.6, dy));
        }

        if (rawP >= 0.72 && !gulped) {
          gulped = true;
          Sound.play("gulp");
          if (navigator.vibrate) navigator.vibrate([25, 45, 25]);
        }

        if (rawP < 1) {
          requestAnimationFrame(flightStep);
        } else {
          // Card has completely entered the mouth
          card.remove();
          this.executeDevourChewingAndFeedback(targetMember, file, fileSizeStr, isImage, isVideo, base64, dataUri);
        }
      };

      requestAnimationFrame(flightStep);
    }, 320);
  }

  private executeDevourChewingAndFeedback(
    targetMember: SquadMember,
    file: File,
    fileSizeStr: string,
    isImage: boolean,
    isVideo: boolean,
    base64: string,
    dataUri: string
  ) {
    void requestNotificationPermission();

    if (this.activeMember.id === targetMember.id) {
      // 1. Snap mouth shut tight with squash & stretch bounce
      this.engine.slotHTarget = 0;
      this.engine.squash();

      // 2. Satisfied chewing cycle with happy eyes and sound
      this.engine.isChewing = true;
      this.engine.eyeOverride = "happy";

      // Rhythmic chewing squash & stretch
      this.engine.anim("sy", [
        [0.85, 110, Ease.out],
        [1.15, 110, Ease.inOut],
        [0.90, 110, Ease.out],
        [1.10, 110, Ease.inOut],
        [1.0, 150, Ease.back],
      ]);
      this.engine.anim("sx", [
        [1.15, 110, Ease.out],
        [0.85, 110, Ease.inOut],
        [1.10, 110, Ease.out],
        [0.90, 110, Ease.inOut],
        [1.0, 150, Ease.back],
      ]);
    }
    Sound.play("approve");

    // 3. Chewing finishes after 900ms -> FORCED EXPLICIT RESET to baseline idle!
    setTimeout(() => {
      if (this.activeMember.id === targetMember.id) {
        this.resetMochiToBase();
        this.engine.triggerEmote("happy");
      }

      // Check if this devoured file needs to be delegated to Red
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isTechnicalDoc = isPdf || /\.(doc|docx|txt|md|csv|xlsx?|pptx?|epub|tex)$/i.test(file.name);
      const requiresRedDelegation = isTechnicalDoc && targetMember.id !== "coco_rojo";

      if (requiresRedDelegation) {
        void this.handleDevouredFileDelegationToRed(targetMember, file, fileSizeStr, isPdf, base64, dataUri);
      } else {
        void this.completeDevourInChat(targetMember, file, fileSizeStr, isImage, isVideo, base64, dataUri);
      }
    }, 900);
  }

  private async handleDevouredFileDelegationToRed(
    activeMember: SquadMember,
    file: File,
    fileSizeStr: string,
    isPdf: boolean,
    base64: string,
    dataUri: string
  ) {
    const activeMemberId = activeMember.id;
    if (!this.chatHistories[activeMemberId]) {
      this.chatHistories[activeMemberId] = [];
    }

    // Guardar registro inicial en el vault local
    void saveDevouredFileRecord({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      sizeStr: fileSizeStr,
      mimeType: file.type || (isPdf ? "application/pdf" : "text/plain"),
      agentId: activeMemberId,
      base64,
      dataUri,
      timestamp: Date.now(),
      analysis: "Delegado a Red para análisis exhaustivo",
    });

    // 1. Mensaje en el chat del agente activo (ej. Green)
    this.chatHistories[activeMemberId].push({
      id: Date.now(),
      role: "user",
      content: `📄 **${file.name}** (${fileSizeStr})`,
    });
    this.chatHistories[activeMemberId].push({
      id: Date.now() + 1,
      role: "assistant",
      content: `Ese documento requiere análisis profundo. Se lo derivo a Red.`,
    });
    this.saveStorage();
    if (this.activeMember.id === activeMemberId) {
      this.renderChatMessages();
      Sound.play("send");
    }

    // 2. Coreografía visual de Squad Assist (efímera, sin mensajes cruzados en el chat de origen)
    // Red salta desde la cabecera hacia el mensaje de Green con "¡Yo me encargo!", regresa y conmuta
    await this.executeEphemeralSquadAssist("coco_rojo", "¡Yo me encargo!");

    // 3. Ya estamos en el chat de Red (selectSquadMember fue llamado en executeEphemeralSquadAssist)
    if (!this.chatHistories["coco_rojo"]) {
      this.chatHistories["coco_rojo"] = [];
    }

    const waitingMsgId = Date.now();
    this.chatHistories["coco_rojo"].push({
      id: waitingMsgId - 1,
      role: "user",
      content: `📄 **${file.name}** (${fileSizeStr})\n\nAnaliza detalladamente este documento y presenta un informe exhaustivo con puntos clave, metodología y conclusiones.`,
    });
    this.chatHistories["coco_rojo"].push({
      id: waitingMsgId,
      role: "assistant",
      content: `📁 **${file.name}** (${fileSizeStr}) devorado y transferido a mi estación.\n\n*Iniciando investigación profunda con IA y lectura de secciones...*`,
    });
    this.saveStorage();

    this.setAgentThinking("coco_rojo", true);

    // 4. Llamada al endpoint de Red (/agente/rojo)
    try {
      notifyRequestStart();
      const pureB64 = base64.includes(",") ? base64.split(",")[1] : base64;
      const res = await fetch("http://150.136.59.173:8080/agente/rojo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Analiza detalladamente este documento (${file.name}) y presenta un informe exhaustivo con puntos clave, metodología y conclusiones.`,
          chat_id: 1,
          coco_id: "coco_rojo",
          file: {
            name: file.name,
            data: pureB64,
            base64: pureB64,
            mime: file.type || (isPdf ? "application/pdf" : "text/plain"),
          },
        }),
      });

      const data = await res.json();
      const redReply =
        data.reply ||
        data.respuesta ||
        data.response ||
        `He completado la lectura y análisis preliminar del documento **${file.name}**. Todo está archivado y disponible para consultas específicas.`;

      const redHist = this.chatHistories["coco_rojo"] || [];
      const waiting = redHist.find((m) => m.id === waitingMsgId);
      if (waiting) {
        waiting.content = `📁 **${file.name}** (${fileSizeStr}) analizado en profundidad:\n\n${redReply}`;
      } else {
        redHist.push({
          id: Date.now(),
          role: "assistant",
          content: redReply,
        });
      }
      this.saveStorage();

      void saveDevouredFileRecord({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        size: file.size,
        sizeStr: fileSizeStr,
        mimeType: file.type || (isPdf ? "application/pdf" : "text/plain"),
        agentId: "coco_rojo",
        base64,
        dataUri,
        timestamp: Date.now(),
        analysis: redReply,
      });

      this.setAgentThinking("coco_rojo", false);

      if (this.activeMember.id === "coco_rojo") {
        this.renderChatMessages();
        this.resetMochiToBase();
        this.engine.setState("finished");
        this.engine.triggerEmote("happy");
        Sound.play("finish");
        setTimeout(() => {
          if (this.activeMember.id === "coco_rojo" && this.engine.state === "finished") {
            this.resetMochiToBase();
          }
        }, 2200);
      } else {
        this.taskCompletedUnread["coco_rojo"] = true;
        this.renderTopSquadChips();
        Sound.play("finish");
      }
      notifyAgentCompletion("coco_rojo", "Red analizó " + file.name, redReply);
    } catch (err: any) {
      const redHist = this.chatHistories["coco_rojo"] || [];
      const waiting = redHist.find((m) => m.id === waitingMsgId);
      if (waiting) {
        waiting.content = `⚠️ No pude conectar con el servicio de análisis de Red (150.136.59.173:8080):\n\n\`${err?.message || String(err)}\`\n\n*El documento fue devorado y está disponible en memoria.*`;
      }
      this.saveStorage();
      this.setAgentThinking("coco_rojo", false);
    } finally {
      notifyRequestEnd();
      this.setAgentThinking("coco_rojo", false);
    }
  }

  private async completeDevourInChat(
    targetMember: SquadMember,
    file: File,
    fileSizeStr: string,
    isImage: boolean,
    isVideo: boolean,
    base64: string,
    dataUri?: string
  ) {
    const targetMemberId = targetMember.id;

    // Clear any pending attached file for this agent (file is now devoured)
    this.attachedFilesByAgent[targetMemberId] = null;
    if (this.activeMember.id === targetMemberId) {
      this.renderAttachedFileChip();
    }

    if (!this.chatHistories[targetMemberId]) {
      this.chatHistories[targetMemberId] = [];
    }

    // 1. Show waiting/loading message in the target Coco thread
    const waitingMsgId = Date.now();
    const waitingMsg: ChatMessage = {
      id: waitingMsgId,
      role: "assistant",
      content: isImage
        ? `🖼️ **${file.name}** (${fileSizeStr}) devorado por **${targetMember.name}**.\n\n*Analizando imagen con IA...*`
        : isVideo
        ? `🎬 **${file.name}** (${fileSizeStr}) devorado por **${targetMember.name}**.\n\n*Analizando video con IA...*`
        : `📁 **${file.name}** (${fileSizeStr}) devorado por **${targetMember.name}**.\n\n*Analizando documento con IA...*`,
    };
    this.chatHistories[targetMemberId].push(waitingMsg);
    this.saveStorage();

    // 2. Set thinking state for target agent and re-render top chips & chat if active
    this.setAgentThinking(targetMemberId, true);

    // 3. Initiate analysis with Oracle staging backend
    try {
      const pureB64 = base64.includes(",") ? base64.split(",")[1] : base64;
      const lowerName = file.name.toLowerCase();
      const mimeType = file.type || (
        isImage
          ? (lowerName.endsWith(".png") ? "image/png"
             : lowerName.endsWith(".webp") ? "image/webp"
             : lowerName.endsWith(".heic") ? "image/heic"
             : lowerName.endsWith(".heif") ? "image/heif"
             : "image/jpeg")
          : isVideo ? "video/mp4" : "application/pdf"
      );

      const promptText = isImage
        ? (targetMemberId === "coco_verde"
            ? "Analiza detalladamente esta imagen de cliente (receta médica, orden de sesiones, derivación clínica o comprobante de pago). Si es una receta u orden médica, extrae diagnóstico, cantidad y tipo de sesiones prescritas, datos del paciente y profesional. Si es un comprobante de pago o transferencia, extrae monto, fecha, emisor y código de operación. Si la foto está borrosa o falta nitidez para leer algún dato crítico, indícalo amablemente explicando con precisión qué parte no se distingue."
            : "Analiza detalladamente esta imagen, describe qué ves y extrae cualquier texto o dato relevante.")
        : isVideo
        ? `[Video adjunto: ${file.name}] Analizá detalladamente este video/grabación adjunta y explicame las escenas, elementos clave y conclusiones.`
        : `[Documento adjunto: ${file.name}] Analizá el documento adjunto y resumí sus puntos clave, estructura y conclusiones principales.`;

      const payload: Record<string, unknown> = {
        message: promptText,
        chat_id: 1,
        tenant_id: 1,
        coco_id: targetMemberId,
        attachment: pureB64,
        image: isImage ? pureB64 : undefined,
        images: isImage ? [pureB64] : undefined,
        video: isVideo ? pureB64 : undefined,
        mime_type: mimeType,
        file: {
          name: file.name,
          data: pureB64,
          base64: pureB64,
          mime: mimeType,
        },
        contexto: {
          kind: "file",
          name: file.name,
          archivo_base64: pureB64,
          base64: pureB64,
          path: file.name,
        },
        todos: this.todos,
        notes: this.notes,
      };

      notifyRequestStart();
      const res = await fetch("http://150.136.59.173:8080/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Código de estado HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || data.respuesta || data.response || "Análisis completado con éxito.";

      // REEMPLAZAR el mensaje de espera en el historial exclusivo del agente
      const hist = this.chatHistories[targetMemberId] || [];
      const target = hist.find((m) => m.id === waitingMsgId);
      if (target) {
        target.content = isImage
          ? `🖼️ **${file.name}** (${fileSizeStr}) analizado:\n\n${reply}`
          : isVideo
          ? `🎬 **${file.name}** (${fileSizeStr}) analizado:\n\n${reply}`
          : `📁 **${file.name}** (${fileSizeStr}) analizado:\n\n${reply}`;
      } else {
        hist.push({
          id: Date.now() + 1,
          role: "assistant",
          content: reply,
        });
      }
      this.saveStorage();

      // Guardar el archivo devorado de forma 100% local en IndexedDB del cliente
      void saveDevouredFileRecord({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        size: file.size,
        sizeStr: fileSizeStr,
        mimeType: mimeType,
        agentId: targetMemberId,
        base64,
        dataUri,
        timestamp: Date.now(),
        analysis: reply,
      });

      const agent = SQUAD.find((s) => s.id === targetMemberId);
      const agentName = agent ? agent.name : "Coco";

      this.setAgentThinking(targetMemberId, false);

      if (this.activeMember.id === targetMemberId) {
        this.resetMochiToBase();
        this.engine.setState("finished");
        this.engine.triggerEmote("happy");
        Sound.play("finish");
        setTimeout(() => {
          if (this.activeMember.id === targetMemberId && this.engine.state === "finished") {
            this.resetMochiToBase();
          }
        }, 2200);
      } else {
        // Notificación persistente viva para el Coco en segundo plano
        this.taskCompletedUnread[targetMemberId] = true;
        this.renderTopSquadChips();
        Sound.play("finish");
      }
      notifyAgentCompletion(targetMemberId, `${agentName} analizó ${file.name}`, reply);
    } catch (err: any) {
      const agent = SQUAD.find((s) => s.id === targetMemberId);
      const agentName = agent ? agent.name : "Coco";
      const hist = this.chatHistories[targetMemberId] || [];
      const target = hist.find((m) => m.id === waitingMsgId);
      if (target) {
        target.content = `⚠️ No pude completar el análisis de **${file.name}** en el servidor de Staging (150.136.59.173:8080):\n\n\`${err?.message || String(err)}\`\n\n*El archivo fue devorado y está almacenado en memoria activa.*`;
      }
      this.saveStorage();
      this.setAgentThinking(targetMemberId, false);
      if (this.activeMember.id === targetMemberId) {
        this.resetMochiToBase();
        this.engine.setState("error");
        Sound.play("error");
      } else {
        this.taskCompletedUnread[targetMemberId] = true;
        this.renderTopSquadChips();
        Sound.play("blip");
      }
      notifyAgentCompletion(targetMemberId, `${agentName} · Error al analizar`, `No se pudo procesar ${file.name}`);
    } finally {
      notifyRequestEnd();
      this.setAgentThinking(targetMemberId, false);
    }
  }

  private renderAttachedFileChip() {
    const chipContainer = document.getElementById("attached-chip-container");
    if (!chipContainer) return;

    const attached = this.attachedFilesByAgent[this.activeMember.id];
    if (!attached) {
      chipContainer.innerHTML = "";
      return;
    }

    const icon = attached.isImage ? "🖼️" : attached.isVideo ? "🎬" : "📄";
    chipContainer.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;background:var(--surface-elevated);border:1px solid var(--coco-accent);border-radius:20px;padding:4px 12px;font-size:11.5px;color:var(--text-main);width:fit-content;margin-bottom:6px;box-shadow:0 0 10px var(--coco-glow);">
        <span>${icon} ${attached.name} (${attached.fileSizeStr})</span>
        <span style="color:var(--text-muted);cursor:pointer;padding-left:4px;font-weight:bold;" id="btn-remove-chip">✕</span>
      </div>
    `;
    document.getElementById("btn-remove-chip")?.addEventListener("click", () => {
      this.attachedFilesByAgent[this.activeMember.id] = null;
      this.renderAttachedFileChip();
      Sound.play("close");
    });
  }

  public testDevour(fileName: string = "informe_clinico.pdf", options: { pages?: number; sizeMB?: number } = {}) {
    const isImage = fileName.endsWith(".png") || fileName.endsWith(".jpg");
    if (isImage) {
      const testCanvas = document.createElement("canvas");
      testCanvas.width = 64;
      testCanvas.height = 64;
      const tctx = testCanvas.getContext("2d")!;
      tctx.fillStyle = "#10b981";
      tctx.fillRect(0, 0, 64, 64);
      tctx.fillStyle = "#ffffff";
      tctx.font = "bold 28px sans-serif";
      tctx.textAlign = "center";
      tctx.textBaseline = "middle";
      tctx.fillText("🥥", 32, 34);

      testCanvas.toBlob((b) => {
        if (b) {
          const file = new File([b], fileName, { type: "image/png" });
          void this.processFileToDevour(file);
        }
      }, "image/png");
      return;
    }

    const pages = options.pages || (fileName.includes("large") || fileName.includes("extenso") ? 18 : 2);
    let blobParts: BlobPart[];
    if (options.sizeMB && options.sizeMB > 0) {
      const dummyBuffer = new Uint8Array(Math.round(options.sizeMB * 1024 * 1024));
      blobParts = [
        `%PDF-1.4\n1 0 obj\n<< /Type /Pages /Count ${pages} >>\nendobj\n`,
        dummyBuffer,
      ];
    } else {
      blobParts = [
        `%PDF-1.4\n1 0 obj\n<< /Type /Pages /Count ${pages} >>\nendobj\n` +
        `Resumen del plan clínico y seguimiento del paciente por Coco Squad.\n` +
        `Sección de investigación profunda, datos diagnósticos y referencias bibliográficas.`
      ];
    }

    const blob = new Blob(blobParts, { type: "application/pdf" });
    const file = new File([blob], fileName, { type: "application/pdf" });
    void this.processFileToDevour(file);
  }

  public getSwipeController(): SwipeController | null {
    return this.swipeController;
  }
}

function initApp() {
  const app = new AndroidApp();
  (window as any).__cocoApp = app;
  app.render();
  (window as any).__swipeController = app.getSwipeController();

  // Smooth dismiss of the native splash screen after 1.2s
  const splashEl = document.getElementById("splash-screen");
  if (splashEl) {
    setTimeout(() => {
      splashEl.classList.add("fade-out");
      setTimeout(() => {
        splashEl.remove();
      }, 420);
    }, 1200);
  }

  if (window.location.search.includes("test_pdf_delegation=1")) {
    setTimeout(() => {
      app.testDevour("analisis_investigacion_clinica.pdf", { pages: 4 });
    }, 450);
  } else if (window.location.search.includes("tab=devour")) {
    setTimeout(() => {
      document.querySelectorAll(".nav-item-btn").forEach((b) => b.classList.remove("active"));
      document.querySelector('.nav-item-btn[data-tab="devour"]')?.classList.add("active");
      document.querySelectorAll(".view-page").forEach((p) => p.classList.remove("active"));
      document.getElementById("page-devour")?.classList.add("active");
      app.initDevourCanvas();
    }, 400);
  } else if (window.location.search.includes("test_pdf_large=1")) {
    setTimeout(() => {
      app.testDevour("investigacion_clinica_extensa.pdf", { pages: 18 });
    }, 450);
  } else if (window.location.search.includes("sheet=1") || window.location.search.includes("devour_sheet=1")) {
    window.history.replaceState(null, "", window.location.pathname);
    setTimeout(() => {
      app.openDevourSheet();
    }, 400);
  } else if (window.location.search.includes("devour=1")) {
    window.history.replaceState(null, "", window.location.pathname);
    setTimeout(() => {
      app.testDevour("informe_clinico.pdf");
    }, 500);
  } else if (window.location.search.includes("devour_img=1")) {
    window.history.replaceState(null, "", window.location.pathname);
    setTimeout(() => {
      app.testDevour("captura_ecografia.png");
    }, 500);
  } else if (window.location.search.includes("test_parallel=1")) {
    window.history.replaceState(null, "", window.location.pathname);
    setTimeout(() => {
      // 1. Coco Blanco devours file
      app.testDevour("captura_ecografia.png");
      // 2. Once devoured and in background Oracle processing, switch immediately to Green
      setTimeout(() => {
        app.switchAgent("coco_verde");
      }, 2100);
    }, 500);
  } else if (window.location.search.includes("switch_coco=1")) {
    window.history.replaceState(null, "", window.location.pathname);
    setTimeout(() => {
      app.switchAgent("coco_blanco");
    }, 300);
  } else if (window.location.search.includes("test_swipe=1")) {
    window.history.replaceState(null, "", window.location.pathname);
    setTimeout(() => {
      const target = document.getElementById("page-chat") || document.body;
      const startTouch = new Touch({
        identifier: 1,
        target: target,
        clientX: 300,
        clientY: 300,
      });
      const endTouch = new Touch({
        identifier: 1,
        target: target,
        clientX: 180, // dx = -120px (swipe left -> next agent)
        clientY: 305,
      });

      target.dispatchEvent(new TouchEvent("touchstart", {
        touches: [startTouch],
        targetTouches: [startTouch],
        changedTouches: [startTouch],
        bubbles: true,
      }));

      setTimeout(() => {
        target.dispatchEvent(new TouchEvent("touchend", {
          touches: [],
          targetTouches: [],
          changedTouches: [endTouch],
          bubbles: true,
        }));
      }, 80);
    }, 600);
  } else if (window.location.search.includes("test_swipe_prev=1")) {
    window.history.replaceState(null, "", window.location.pathname);
    setTimeout(() => {
      const target = document.getElementById("page-chat") || document.body;
      const startTouch = new Touch({
        identifier: 1,
        target: target,
        clientX: 150,
        clientY: 300,
      });
      const endTouch = new Touch({
        identifier: 1,
        target: target,
        clientX: 280, // dx = +130px (swipe right -> prev agent)
        clientY: 302,
      });

      target.dispatchEvent(new TouchEvent("touchstart", {
        touches: [startTouch],
        targetTouches: [startTouch],
        changedTouches: [startTouch],
        bubbles: true,
      }));

      setTimeout(() => {
        target.dispatchEvent(new TouchEvent("touchend", {
          touches: [],
          targetTouches: [],
          changedTouches: [endTouch],
          bubbles: true,
        }));
      }, 80);
    }, 600);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

