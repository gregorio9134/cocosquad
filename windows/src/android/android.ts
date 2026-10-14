// Coco Squad Mobile — Android Application Entry Point
// Authentic Material 3 / iOS mobile companion with Mochi, Squad Bar, Oracle Chat & Devour

import "./android.css";
import { BotEngine, type RGB } from "../mochi/engine";
import { Sound } from "../core/sound";
import { State, type ChatMessage, type TodoItem, type QuickNote } from "../core/state";
import { marked } from "marked";

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
}

const SQUAD: SquadMember[] = [
  {
    id: "coco_blanco",
    name: "Coco Blanco",
    role: "General",
    color: "#FFFFFF",
    glow: "rgba(255, 255, 255, 0.25)",
    bgTint: "rgba(255, 255, 255, 0.04)",
    squadRole: "white",
    greeting: "¡Hola Gregorio! 🥥 Soy Coco Blanco, tu asistente general de productividad y chat.",
  },
  {
    id: "coco_verde",
    name: "Coco Verde",
    role: "WhatsApp",
    color: "#10B981",
    glow: "rgba(16, 185, 129, 0.35)",
    bgTint: "rgba(16, 185, 129, 0.06)",
    squadRole: "green",
    greeting: "¡Qué tal! Coco Verde a cargo de comunicaciones y WhatsApp.",
  },
  {
    id: "coco_rojo",
    name: "Coco Rojo",
    role: "Investigador",
    color: "#EF4444",
    glow: "rgba(239, 68, 68, 0.35)",
    bgTint: "rgba(239, 68, 68, 0.06)",
    squadRole: "red",
    greeting: "Coco Rojo listo. Investigaciones profundas, síntesis y análisis técnico.",
  },
  {
    id: "coco_azul",
    name: "Coco Azul",
    role: "Analista",
    color: "#3B82F6",
    glow: "rgba(59, 130, 246, 0.35)",
    bgTint: "rgba(59, 130, 246, 0.06)",
    squadRole: "blue",
    greeting: "Coco Azul aquí. Análisis de métricas, reportes mensuales y hábitos.",
  },
];

class AndroidApp {
  private activeMember: SquadMember = SQUAD[0];
  private activeTab: "chat" | "devour" | "tasks" = "chat";
  private engine: BotEngine = new BotEngine();
  private mascotCanvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animId: number = 0;

  private messages: ChatMessage[] = [
    {
      id: 1,
      role: "assistant",
      content:
        "¡Hola Gregorio! 🥥 Soy **Coco Blanco**. Tu escuadrón de IA ya está activo en tu Android:\n\n- **Coco Blanco**: Asistencia general y organización\n- **Coco Verde**: WhatsApp y turnos\n- **Coco Rojo**: Investigación profunda\n- **Coco Azul**: Métricas y hábitos\n\n¿En qué trabajamos hoy?",
    },
  ];
  private isThinking = false;
  private attachedFile: { name: string; base64: string } | null = null;

  private todos: TodoItem[] = [];
  private notes: QuickNote[] = [];

  constructor() {
    this.loadStorage();
  }

  private loadStorage() {
    try {
      const t = localStorage.getItem("coco_mobile_todos");
      if (t) this.todos = JSON.parse(t);
      const n = localStorage.getItem("coco_mobile_notes");
      if (n) this.notes = JSON.parse(n);
    } catch {
      this.todos = [];
      this.notes = [];
    }
  }

  private saveStorage() {
    try {
      localStorage.setItem("coco_mobile_todos", JSON.stringify(this.todos));
      localStorage.setItem("coco_mobile_notes", JSON.stringify(this.notes));
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
                <span class="agent-name-text" id="header-agent-name">${this.activeMember.name}</span>
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
              <div class="chat-history" id="chat-history"></div>

              <div class="suggestions-bar">
                <button class="suggestion-chip" data-prompt="¿Quién sos y qué funciones tenés?">💡 ¿Quién sos?</button>
                <button class="suggestion-chip" data-prompt="Resumí mis pendientes del día">📋 Resumir pendientes</button>
                <button class="suggestion-chip" data-prompt="Revisar comunicaciones de redes y WhatsApp">🟢 Ver WhatsApp</button>
                <button class="suggestion-chip" data-prompt="Iniciar investigación profunda de mercado">🔴 Investigar mercado</button>
              </div>

              <div id="attached-chip-container" style="padding: 0 14px;"></div>

              <div class="chat-input-bar">
                <button class="btn-icon-round" id="btn-attach" title="Adjuntar archivo">📎</button>
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

                <input type="file" id="input-camera" accept="image/*" capture="environment" style="display:none;" />
                <input type="file" id="input-gallery" accept="*/*" style="display:none;" />
              </div>
            </div>
          </div>

          <!-- Tasks Page -->
          <div class="view-page" id="page-tasks">
            <div class="tasks-page">
              <div class="card-box">
                <div class="card-box-header">
                  <span>Tareas Pendientes</span>
                  <button class="suggestion-chip" id="btn-add-todo">+ Nueva Tarea</button>
                </div>
                <div id="todo-container" style="display:flex; flex-direction:column; gap:8px;"></div>
              </div>

              <div class="card-box">
                <div class="card-box-header">
                  <span>Notas Rápidas (Taby)</span>
                  <button class="suggestion-chip" id="btn-add-note">+ Nueva Nota</button>
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
      </div>
    `;

    this.initMascotCanvas();
    this.renderTopSquadChips();
    this.renderChatMessages();
    this.renderTasks();
    this.bindEvents();
    void Sound.preload();
  }

  private initMascotCanvas() {
    this.mascotCanvas = document.getElementById("mascot-mini-canvas") as HTMLCanvasElement;
    if (!this.mascotCanvas) return;
    this.ctx = this.mascotCanvas.getContext("2d")!;

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

      this.engine.update(dt);

      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.clearRect(0, 0, w, h);
      this.engine.draw(this.ctx, w, h);

      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  private renderTopSquadChips() {
    const bar = document.getElementById("top-squad-chips");
    if (!bar) return;

    bar.innerHTML = "";
    SQUAD.forEach((m) => {
      const chip = document.createElement("button");
      chip.className = `compact-chip ${m.id === this.activeMember.id ? "active" : ""}`;
      chip.style.setProperty("--chip-color", m.color);
      chip.style.setProperty("--chip-glow", m.glow);

      const colorName = m.name.replace("Coco ", "");
      chip.innerHTML = `
        <span class="compact-chip-dot"></span>
        <span class="compact-chip-label">${colorName}</span>
      `;

      chip.addEventListener("click", () => this.selectSquadMember(m));
      bar.appendChild(chip);
    });
  }

  private selectSquadMember(m: SquadMember) {
    this.activeMember = m;
    this.renderTopSquadChips();

    // Update CSS variables
    document.documentElement.style.setProperty("--coco-accent", m.color);
    document.documentElement.style.setProperty("--coco-glow", m.glow);

    // Update Header info
    const nameEl = document.getElementById("header-agent-name");
    const roleEl = document.getElementById("header-agent-role");
    const pulseEl = document.getElementById("header-pulse");
    if (nameEl) nameEl.textContent = m.name;
    if (roleEl) roleEl.textContent = `${m.role} · En línea`;
    if (pulseEl) pulseEl.style.backgroundColor = m.color;

    // Update Mascot in mini canvas
    this.engine.setCocoSquadRole(m.squadRole);
    this.engine.triggerEmote("wink");
    Sound.play("blip");

    if (navigator.vibrate) navigator.vibrate(12);
  }

  private renderChatMessages() {
    const container = document.getElementById("chat-history");
    if (!container) return;

    container.innerHTML = "";
    this.messages.forEach((msg) => {
      const row = document.createElement("div");
      row.className = `chat-bubble-row ${msg.role}`;

      const bubble = document.createElement("div");
      bubble.className = "chat-bubble";

      if (msg.role === "assistant") {
        const badge = document.createElement("div");
        badge.className = "chat-agent-badge";
        badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${this.activeMember.color};"></span> ${this.activeMember.name}`;
        row.appendChild(badge);
        bubble.innerHTML = `<div class="message-content">${marked.parse(msg.content, { async: false }) as string}</div>`;
      } else {
        bubble.textContent = msg.content;
      }

      row.appendChild(bubble);
      container.appendChild(row);
    });

    if (this.isThinking) {
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
        this.engine.lookX = Math.max(-1, Math.min(1, dx));
        this.engine.lookY = Math.max(-1, Math.min(1, dy));

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
        if (tab === this.activeTab) return;

        document.querySelectorAll(".nav-item-btn").forEach((b) => b.classList.remove("active"));
        target.classList.add("active");

        document.querySelectorAll(".view-page").forEach((p) => p.classList.remove("active"));
        document.getElementById(`page-${tab}`)?.classList.add("active");

        this.activeTab = tab;
        Sound.play("open");

        if (tab === "devour") {
          this.initDevourIdleCanvas();
        }
      });
    });

    // Chat sending
    const input = document.getElementById("chat-input") as HTMLInputElement;
    const sendBtn = document.getElementById("btn-send");

    const doSend = () => {
      const text = input.value.trim();
      if (!text || this.isThinking) return;
      input.value = "";
      this.sendChatMessage(text);
    };

    sendBtn?.addEventListener("click", doSend);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSend();
    });

    // Suggestion chips
    document.querySelectorAll(".suggestion-chip[data-prompt]").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        const prompt = (e.currentTarget as HTMLElement).dataset.prompt;
        if (prompt) this.sendChatMessage(prompt);
      });
    });

    // Attach button in chat input bar
    document.getElementById("btn-attach")?.addEventListener("click", () => {
      const devourTab = document.querySelector('.nav-item-btn[data-tab="devour"]') as HTMLElement;
      devourTab?.click();
    });

    // Devour actions
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
  }

  private async sendChatMessage(text: string) {
    this.messages.push({
      id: Date.now(),
      role: "user",
      content: text,
    });
    this.isThinking = true;
    this.renderChatMessages();

    this.engine.setState("thinking");
    Sound.play("send");

    try {
      const payload: Record<string, unknown> = {
        message: text,
        chat_id: 1,
        tenant_id: 1,
        coco_id: this.activeMember.id,
        contexto: this.attachedFile
          ? {
              kind: "file",
              name: this.attachedFile.name,
              base64: this.attachedFile.base64,
            }
          : null,
        todos: this.todos,
        notes: this.notes,
      };

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

      this.messages.push({
        id: Date.now() + 1,
        role: "assistant",
        content: reply,
      });

      this.engine.setState("finished");
      this.engine.triggerEmote("happy");
      Sound.play("finish");
    } catch (err: any) {
      this.messages.push({
        id: Date.now() + 1,
        role: "assistant",
        content: `⚠️ No pude conectar con el servidor Oracle de Staging (150.136.59.173:8080):\n\n\`${err?.message || String(err)}\`\n\n*Asegurate de que el servidor esté activo o verificá la conexión.*`,
      });
      this.engine.setState("error");
      Sound.play("error");
    } finally {
      this.isThinking = false;
      this.renderChatMessages();
    }
  }

  private initDevourIdleCanvas() {
    const canvas = document.getElementById("devour-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 320;
    const h = 180;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🥥 Esperando archivo o foto...", w / 2, h / 2);
  }

  private processFileToDevour(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] || "";
      this.attachedFile = { name: file.name, base64 };
      this.runDevourAnimation(file.name);
    };
    reader.readAsDataURL(file);
  }

  private runDevourAnimation(fileName: string) {
    const canvas = document.getElementById("devour-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 320;
    const h = 180;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);

    Sound.play("open");
    Sound.play("attach");
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

    let startTime = performance.now();
    const duration = 2600; // ms

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 - 10;

      // Phase 1: File sucked into mouth (0 -> 0.4)
      if (p < 0.4) {
        const suckP = p / 0.4;
        const fileX = cx + (1 - suckP) * 85;
        const fileY = cy - 40 + suckP * 40;
        const fileScale = 1 - suckP * 0.75;

        ctx.save();
        ctx.translate(fileX, fileY);
        ctx.scale(fileScale, fileScale);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-15, -20, 30, 40);
        ctx.fillStyle = "#2563eb";
        ctx.fillRect(-12, -16, 24, 6);
        ctx.restore();

        this.drawDevourMochi(ctx, cx, cy, 1.2, 0.4, "pill");
      }
      // Phase 2: Snap shut & chew happily (0.4 -> 0.8)
      else if (p < 0.8) {
        if (p < 0.44) Sound.play("gulp");
        const chewP = (p - 0.4) / 0.4;
        const chewSquash = 1 + Math.sin(chewP * Math.PI * 4) * 0.12;

        this.drawDevourMochi(ctx, cx, cy, chewSquash, 0, "happy");

        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(cx - 35, cy - 20, 3, 0, Math.PI * 2);
        ctx.arc(cx + 35, cy - 15, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Phase 3: Progress bar (0.8 -> 1.0)
      else {
        const progP = (p - 0.8) / 0.2;
        this.drawDevourMochi(ctx, cx, cy, 1.0, 0, "wink");

        const barW = w * 0.75;
        const barH = 6;
        const barX = (w - barW) / 2;
        const barY = h - 25;

        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.roundRect(barX, barY, barW, barH, 3);
        ctx.fill();

        ctx.fillStyle = this.activeMember.color;
        ctx.roundRect(barX, barY, barW * progP, barH, 3);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(fileName, cx, h - 8);

      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        Sound.play("finish");
        this.onDevourFinished(fileName);
      }
    };

    requestAnimationFrame(animate);
  }

  private drawDevourMochi(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scaleY: number,
    mouthOpen: number,
    eyeShape: "pill" | "happy" | "wink"
  ) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, scaleY);

    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#EDEDEF";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#1A1412";
    if (eyeShape === "happy") {
      ctx.beginPath();
      ctx.arc(-14, -4, 6, Math.PI, 0);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#1A1412";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(14, -4, 6, Math.PI, 0);
      ctx.stroke();
    } else if (eyeShape === "wink") {
      ctx.beginPath();
      ctx.arc(-14, -4, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(14, -4, 6, Math.PI, 0);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#1A1412";
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-14, -4, 5, 0, Math.PI * 2);
      ctx.arc(14, -4, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (mouthOpen > 0) {
      ctx.beginPath();
      ctx.ellipse(0, 8, 8, 8 * mouthOpen * 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#1A1412";
      ctx.fill();
    }

    ctx.restore();
  }

  private onDevourFinished(fileName: string) {
    const speech = document.getElementById("mascot-speech");
    if (speech) {
      speech.textContent = `¡Acabo de devorar "${fileName}"! Ya está en mi memoria activa.`;
      speech.style.borderColor = this.activeMember.color;
    }

    setTimeout(() => {
      // Switch back to chat
      const chatTab = document.querySelector('.nav-item-btn[data-tab="chat"]') as HTMLElement;
      chatTab?.click();

      // Show attached chip
      const chipContainer = document.getElementById("attached-chip-container");
      if (chipContainer && this.attachedFile) {
        chipContainer.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;background:var(--surface-elevated);border:1px solid var(--coco-accent);border-radius:20px;padding:4px 12px;font-size:11.5px;color:var(--text-main);width:fit-content;margin-bottom:6px;">
            <span>📄 ${fileName}</span>
            <span style="color:var(--text-muted);cursor:pointer;padding-left:4px;" id="btn-remove-chip">✕</span>
          </div>
        `;
        document.getElementById("btn-remove-chip")?.addEventListener("click", () => {
          this.attachedFile = null;
          chipContainer.innerHTML = "";
        });
      }

      this.messages.push({
        id: Date.now(),
        role: "assistant",
        content: `📁 **${fileName}** fue absorbido correctamente por **${this.activeMember.name}**.\n\nEscribí cualquier pregunta sobre este documento y lo analizaré de inmediato.`,
      });
      this.renderChatMessages();
    }, 700);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new AndroidApp();
  app.render();
});
