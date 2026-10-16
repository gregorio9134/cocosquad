// Coco Squad Mobile — Green WhatsApp & Customer Inbox Manager
// Modular, isolated controller for managing WhatsApp customer conversations and Live Human Takeover

import { marked } from "marked";
import { Sound } from "../core/sound";
import { triggerHapticFeedback } from "./swipeController";

export interface GreenContactMessage {
  id: number;
  role: "user" | "assistant" | "human_agent";
  content: string;
  timestamp: string;
  attachment?: {
    name: string;
    type: "image" | "pdf" | "video";
    url?: string;
  };
}

export interface GreenClientContact {
  id: string;
  name: string;
  phone: string;
  avatarColor: string;
  tag: string;
  isBotActive: boolean; // true = [🤖 Modo Bot Activo], false = [✋ Pausar e Intervenir]
  unreadCount: number;
  lastTime: string;
  messages: GreenContactMessage[];
}

const STORAGE_KEY = "coco_squad_green_inbox_v1";

const INITIAL_CONTACTS: GreenClientContact[] = [
  {
    id: "client_martin",
    name: "Martín Domínguez",
    phone: "+54 9 11 4821-9920",
    avatarColor: "#0084FF",
    tag: "Receta Médica",
    isBotActive: true,
    unreadCount: 0,
    lastTime: "14:11",
    messages: [
      {
        id: 1729000001,
        role: "user",
        content: "Hola, tengo esta orden médica de la Dra. Marcela Gómez por 10 sesiones de kinesiología motora para lumbalgia aguda con contractura paravertebral. ¿Cómo podemos coordinar para arrancar?",
        timestamp: "14:10",
      },
      {
        id: 1729000002,
        role: "assistant",
        content: "¡Hola Martín! 🟢\n\nLamento mucho escuchar lo de la lumbalgia aguda; sé lo incómodo que es moverse con esa contractura.\n\nHe validado la orden de la **Dra. Marcela Gómez** y confirmo que tenés indicadas **10 sesiones de kinesiología motora**. ¡Excelente que ya contás con la derivación!\n\nPara empezar a aliviar esa tensión cuanto antes:\n\n📅 **¿Te queda más cómodo arrancar este jueves a las 11:00 hs o el viernes a las 16:30 hs?** ✨",
        timestamp: "14:11",
      },
    ],
  },
  {
    id: "client_laura",
    name: "Laura Benítez",
    phone: "+54 9 11 6532-1104",
    avatarColor: "#00E676",
    tag: "Comprobante $22.000",
    isBotActive: true,
    unreadCount: 0,
    lastTime: "14:16",
    messages: [
      {
        id: 1729000011,
        role: "user",
        content: "¡Hola Green! Ya te transferí los $22.000 para el turno de kine. Acá te paso el comprobante: código #TRX-8849201 desde mi cuenta de Santander.",
        timestamp: "14:15",
      },
      {
        id: 1729000012,
        role: "assistant",
        content: "¡Hola Laura! 🟢✨\n\n¡Qué buena noticia! Confirmamos la recepción de tu transferencia de **$22.000 ARS** (Código **#TRX-8849201**).\n\nTu pago ha sido verificado y **tu turno queda formalmente reservado** con éxito. 🙌\n\n📅 **¿Preferís el primer turno este jueves a las 10:00 o viernes a las 15:00 hs?**",
        timestamp: "14:16",
      },
    ],
  },
  {
    id: "client_carlos",
    name: "Carlos Rossi",
    phone: "+54 9 11 3290-4411",
    avatarColor: "#F59E0B",
    tag: "Intervención Solicitada",
    isBotActive: false, // Intervenido manualmente
    unreadCount: 0,
    lastTime: "10:22",
    messages: [
      {
        id: 1729000021,
        role: "user",
        content: "Hola, necesito consultar por kinesiología a domicilio urgente para mi papá que está recién operado de cadera y no puede viajar hasta el centro. ¿Puedo hablar con un humano por favor?",
        timestamp: "10:20",
      },
      {
        id: 1729000022,
        role: "assistant",
        content: "¡Hola Carlos! 🟢 Entiendo totalmente la urgencia y la situación de tu papá. En este momento aviso de inmediato a un asesor de nuestro equipo para que tome el chat y te contacte enseguida.",
        timestamp: "10:20",
      },
      {
        id: 1729000023,
        role: "human_agent",
        content: "Hola Carlos, acá Gregorio del equipo de coordinación. Ya le pasé los datos al kinesiólogo del área domiciliaria para que se comunique con vos al +54 9 11 3290-4411. ¿En qué zona de la ciudad se encuentra tu papá?",
        timestamp: "10:22",
      },
    ],
  },
];

export class GreenManager {
  private contacts: GreenClientContact[] = [];
  private activeContactId: string = "client_martin";
  private containerEl: HTMLElement | null = null;

  constructor() {
    this.loadStorage();
  }

  private loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.contacts = parsed;
          this.activeContactId = this.contacts[0].id;
          return;
        }
      }
    } catch {
      // fallback
    }
    this.contacts = JSON.parse(JSON.stringify(INITIAL_CONTACTS));
    this.activeContactId = this.contacts[0].id;
    this.saveStorage();
  }

  public saveStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.contacts));
    } catch {
      // ignore
    }
  }

  public getActiveContact(): GreenClientContact {
    const found = this.contacts.find((c) => c.id === this.activeContactId);
    return found || this.contacts[0];
  }

  public getContacts(): GreenClientContact[] {
    return this.contacts;
  }

  private onInterventionToggleListener?: (isIntervened: boolean, contact: GreenClientContact) => void;
  private onContactChangeListener?: (contact: GreenClientContact) => void;

  public setOnInterventionToggle(listener: (isIntervened: boolean, contact: GreenClientContact) => void) {
    this.onInterventionToggleListener = listener;
  }

  public setOnContactChange(listener: (contact: GreenClientContact) => void) {
    this.onContactChangeListener = listener;
  }

  public isInterventionActive(): boolean {
    return !this.getActiveContact().isBotActive;
  }

  public toggleIntervention(): boolean {
    const contact = this.getActiveContact();
    contact.isBotActive = !contact.isBotActive;
    this.saveStorage();
    triggerHapticFeedback(14);
    Sound.play("toggle");
    this.render();
    if (this.onInterventionToggleListener) {
      this.onInterventionToggleListener(!contact.isBotActive, contact);
    }
    return contact.isBotActive;
  }

  public setBotActive(active: boolean): void {
    const contact = this.getActiveContact();
    contact.isBotActive = active;
    this.saveStorage();
    this.render();
    if (this.onInterventionToggleListener) {
      this.onInterventionToggleListener(!contact.isBotActive, contact);
    }
  }

  private isSheetOpen: boolean = false;

  public openSheet() {
    this.isSheetOpen = true;
    const overlay = document.getElementById("green-sheet-overlay");
    const card = document.getElementById("green-sheet-card");
    if (overlay && card) {
      this.renderSheet();
      overlay.classList.remove("hidden");
      card.classList.remove("hidden");
      triggerHapticFeedback(12);
      Sound.play("toggle");
    }
  }

  public isContactsSheetOpen(): boolean {
    return this.isSheetOpen;
  }

  public closeSheet() {
    this.isSheetOpen = false;
    const overlay = document.getElementById("green-sheet-overlay");
    const card = document.getElementById("green-sheet-card");
    if (overlay && card) {
      overlay.classList.add("hidden");
      card.classList.add("hidden");
    }
  }

  public renderSheet() {
    const card = document.getElementById("green-sheet-card");
    const overlay = document.getElementById("green-sheet-overlay");
    if (!card) return;

    const currentContact = this.getActiveContact();

    card.innerHTML = `
      <div class="green-sheet-handle"></div>
      <div class="green-sheet-header">
        <div class="green-sheet-title-col">
          <div class="green-sheet-title-row">
            <span class="green-sheet-title">Chats de Clientes</span>
            <span class="green-sheet-live-badge">🟢 WhatsApp Live</span>
          </div>
          <span class="green-sheet-subtitle">Selecciona una conversación para gestionar turnos o intervenir:</span>
        </div>
        <button class="green-sheet-close" id="btn-close-contacts-sheet" title="Cerrar">✕</button>
      </div>

      <div class="green-sheet-list" id="green-sheet-list">
        ${this.contacts
          .map((c) => {
            const isActive = c.id === currentContact.id;
            const lastMsg = c.messages.length > 0 ? c.messages[c.messages.length - 1].content : "";
            const cleanSnippet = lastMsg.replace(/[#*`_]/g, "").trim().slice(0, 48) + (lastMsg.length > 48 ? "..." : "");
            const statusDot = c.isBotActive ? "🟢 Bot Activo" : "✋ Intervenido";
            return `
              <button class="green-sheet-item ${isActive ? "active" : ""}" data-contact-id="${c.id}">
                <div class="green-sheet-item-avatar" style="background:${c.avatarColor};">
                  ${c.name.charAt(0)}
                </div>
                <div class="green-sheet-item-main">
                  <div class="green-sheet-item-top">
                    <span class="green-sheet-item-name">${c.name}</span>
                    <span class="green-sheet-item-time">${c.lastTime}</span>
                  </div>
                  <div class="green-sheet-item-mid">
                    <span class="green-sheet-item-snippet">${cleanSnippet}</span>
                    <span class="green-sheet-item-badge ${c.isBotActive ? "bot" : "human"}">${statusDot}</span>
                  </div>
                  <div class="green-sheet-item-bottom">
                    <span class="green-sheet-item-phone">${c.phone}</span>
                    <span class="green-sheet-item-tag">${c.tag}</span>
                  </div>
                </div>
              </button>
            `;
          })
          .join("")}
      </div>
    `;

    // Bind close button
    const closeBtn = card.querySelector("#btn-close-contacts-sheet");
    closeBtn?.addEventListener("click", () => this.closeSheet());

    // Bind overlay click
    if (overlay) {
      overlay.onclick = () => this.closeSheet();
    }

    // Bind contact item clicks
    const items = card.querySelectorAll<HTMLButtonElement>(".green-sheet-item");
    items.forEach((item) => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-contact-id");
        if (id) {
          this.selectContact(id);
          this.closeSheet();
        }
      });
    });
  }

  public selectContact(contactId: string) {
    if (this.activeContactId === contactId) {
      this.closeSheet();
      return;
    }
    this.activeContactId = contactId;
    const contact = this.getActiveContact();
    contact.unreadCount = 0;
    this.saveStorage();
    triggerHapticFeedback(12);
    Sound.play("blip");
    this.render();
    this.closeSheet();
    this.scrollToBottom();
    if (this.onContactChangeListener) {
      this.onContactChangeListener(contact);
    }
  }

  public addMessage(
    role: "user" | "assistant" | "human_agent",
    content: string,
    attachment?: GreenContactMessage["attachment"]
  ): GreenContactMessage {
    const contact = this.getActiveContact();
    const d = new Date();
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    const newMsg: GreenContactMessage = {
      id: Date.now(),
      role,
      content,
      timestamp: timeStr,
      attachment,
    };

    contact.messages.push(newMsg);
    contact.lastTime = timeStr;
    this.saveStorage();
    this.renderMessagesOnly();
    this.scrollToBottom();
    return newMsg;
  }

  public scrollToBottom() {
    if (!this.containerEl) return;
    const msgBox = this.containerEl.querySelector<HTMLElement>("#green-messages-container");
    if (!msgBox) return;
    msgBox.scrollTop = msgBox.scrollHeight;
    requestAnimationFrame(() => {
      if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
    });
    setTimeout(() => {
      if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
    }, 40);
  }

  /**
   * Mounts or attaches the Green Inbox UI to a target container
   */
  public mount(container: HTMLElement) {
    this.containerEl = container;
    this.containerEl.style.display = "flex";
    this.containerEl.style.flexDirection = "column";
    this.containerEl.style.height = "100%";
    this.containerEl.style.overflow = "hidden";
    this.containerEl.style.flex = "1";
    this.containerEl.style.minHeight = "0";
    this.render();
    this.scrollToBottom();
  }

  public unmount() {
    this.closeSheet();
    if (this.containerEl) {
      this.containerEl.innerHTML = "";
      this.containerEl.style.display = "none";
    }
  }

  public render() {
    if (!this.containerEl) return;
    this.containerEl.style.display = "flex";
    this.containerEl.style.flexDirection = "column";
    this.containerEl.style.height = "100%";
    this.containerEl.style.overflow = "hidden";
    this.containerEl.style.flex = "1";
    this.containerEl.style.minHeight = "0";

    const currentContact = this.getActiveContact();
    const isBotActive = currentContact.isBotActive;

    this.containerEl.innerHTML = `
      <div class="green-inbox-wrapper">
        <!-- 1. Compact Header Strip: Selector Pill + Intervention Button -->
        <div class="green-top-strip">
          <button class="green-contact-selector-btn" id="btn-open-contacts-sheet" title="Tocar para cambiar de contacto">
            <span class="contact-pill-status-dot">${currentContact.isBotActive ? "🟢" : "✋"}</span>
            <span class="contact-pill-name">${currentContact.name}</span>
            <span class="contact-pill-chevron">▾</span>
          </button>

          <div class="green-strip-actions">
            <button class="green-takeover-toggle-btn ${isBotActive ? "bot-mode" : "human-mode"}" id="btn-green-takeover" title="${isBotActive ? 'Pausar bot e intervenir manualmente' : 'Reactivar respuestas automáticas'}">
              ${
                isBotActive
                  ? `<span class="btn-icon">🤖</span> <span class="btn-text">Bot Activo</span>`
                  : `<span class="btn-icon">✋</span> <span class="btn-text">Pausar e Intervenir</span>`
              }
            </button>
          </div>
        </div>

        <!-- 2. Takeover Alert Banner if Paused -->
        ${
          !isBotActive
            ? `
          <div class="green-takeover-alert-banner">
            <span class="alert-icon">✋</span>
            <div class="alert-text">
              <strong>Intervención Humana:</strong> Respuestas automáticas pausadas para ${currentContact.name}. El campo de texto inferior envía mensajes manuales directos.
            </div>
            <button class="green-resume-bot-quick-btn" id="btn-quick-resume-bot">Reactivar Bot</button>
          </div>
        `
            : ""
        }

        <!-- 3. Client Conversation Message Thread -->
        <div class="green-messages-container" id="green-messages-container"></div>
      </div>
    `;

    // Bind opening contacts sheet
    const selectorBtn = this.containerEl.querySelector<HTMLButtonElement>("#btn-open-contacts-sheet");
    if (selectorBtn) {
      selectorBtn.addEventListener("click", () => {
        this.openSheet();
      });
    }

    // Bind Takeover Switch toggle
    const toggleBtn = this.containerEl.querySelector<HTMLButtonElement>("#btn-green-takeover");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.toggleIntervention();
      });
    }

    const quickResumeBtn = this.containerEl.querySelector<HTMLButtonElement>("#btn-quick-resume-bot");
    if (quickResumeBtn) {
      quickResumeBtn.addEventListener("click", () => {
        this.setBotActive(true);
      });
    }

    this.renderMessagesOnly();
  }

  public renderMessagesOnly() {
    if (!this.containerEl) return;
    const msgBox = this.containerEl.querySelector<HTMLElement>("#green-messages-container");
    if (!msgBox) return;

    const currentContact = this.getActiveContact();
    msgBox.innerHTML = "";

    if (currentContact.messages.length === 0) {
      msgBox.innerHTML = `
        <div class="green-empty-thread">
          <p>No hay mensajes en esta conversación todavía.</p>
        </div>
      `;
      return;
    }

    currentContact.messages.forEach((msg) => {
      const row = document.createElement("div");
      row.className = `green-msg-row ${msg.role}`;

      const bubble = document.createElement("div");
      bubble.className = "green-msg-bubble";

      let headerBadge = "";
      if (msg.role === "assistant") {
        headerBadge = `
          <div class="green-msg-badge bot">
            <span class="dot"></span> Green · Bot IA
          </div>
        `;
      } else if (msg.role === "human_agent") {
        headerBadge = `
          <div class="green-msg-badge human">
            <span class="dot"></span> Asesor Humano (Intervención)
          </div>
        `;
      }

      const parsedHtml = marked.parse(msg.content, { async: false }) as string;
      bubble.innerHTML = `
        ${headerBadge}
        <div class="green-msg-text">${parsedHtml}</div>
        <span class="green-msg-time">${msg.timestamp}</span>
      `;

      row.appendChild(bubble);
      msgBox.appendChild(row);
    });

    // Auto-scroll to bottom
    this.scrollToBottom();
  }
}
