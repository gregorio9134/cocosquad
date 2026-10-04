// Chat view — DOM port of PromptView / ChatBubble / TypingDotsView from
// IslandViewContent.swift.

import { h, svg, clear } from "./dom";
import { ICONS } from "./icons";
import { Bridge, type ChatContext } from "../core/bridge";
import { Sound } from "../core/sound";
import { State, type ChatMessage } from "../core/state";
import type { ViewHost } from "./views";

import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

let nextId = 1;

function bubble(message: ChatMessage): HTMLElement {
  if (message.role === "user") {
    return h(
      "div",
      { class: "chat-row user" },
      h("div", { class: "bubble", text: message.content }),
    );
  }
  const replyEl = h("div", { class: "reply" });
  try {
    replyEl.innerHTML = marked.parse(message.content, { async: false }) as string;
  } catch {
    replyEl.textContent = message.content;
  }
  replyEl.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest("a");
    if (target && target.href) {
      e.preventDefault();
      void Bridge.openUrl(target.href);
    }
  });
  return h("div", { class: "chat-row assistant" }, replyEl);
}

function typingDots(docName?: string | null): HTMLElement {
  if (docName) {
    return h(
      "div",
      { class: "chat-row assistant" },
      h(
        "div",
        { class: "thinking-doc-badge" },
        svg(ICONS.doc, 11),
        h("span", { text: `Coco Blanco está analizando "${docName}"…` }),
        h("div", { class: "typing" }, h("i"), h("i"), h("i")),
      ),
    );
  }
  return h(
    "div",
    { class: "chat-row assistant" },
    h("div", { class: "typing" }, h("i"), h("i"), h("i")),
  );
}

/** File chip showing the attached document with active memory badge and remove button. */
function fileChip(name: string, onRemove: () => void): HTMLElement {
  const chip = h(
    "div",
    { class: "file-chip", title: `Documento en memoria activa: ${name}` },
    svg(ICONS.doc, 10),
    h("span", { text: name }),
    h("span", { class: "memory-tag", text: "Memoria activa" }),
    h(
      "button",
      {
        class: "chip-remove",
        title: "Cerrar documento de la memoria",
        onclick: (e: Event) => {
          e.stopPropagation();
          onRemove();
        },
      },
      svg(ICONS.xmark, 8),
    ),
  );
  return chip;
}

export function buildPrompt(onHeightChange: () => void): ViewHost {
  const chipRow = h("div", { class: "chip-row" });
  const log = h("div", { class: "chat-log" });

  const fileInput = h("input", {
    type: "file",
    style: "display:none",
    accept: ".pdf,.doc,.docx,.ppt,.pptx,.txt,.xlsx,.csv,.json,.md",
  }) as HTMLInputElement;

  function handleIncomingFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      State.droppedFile = {
        name: file.name,
        path: (file as any).path || file.name,
        base64: b64,
        size: file.size,
      };
      if (State.focusId !== "coco_blanco") {
        State.setFocus("coco_blanco");
      }
      Sound.play("blip");
      State.notify();
      onHeightChange();
      input.focus();
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      handleIncomingFile(file);
    }
    fileInput.value = "";
  });

  const attachBtn = h(
    "button",
    {
      class: "send-btn attach-btn",
      title: "Adjuntar documento (PDF, Word, PPTX...)",
      onclick: () => fileInput.click(),
    },
    svg(ICONS.paperclip, 12),
  );

  const input = h("input", {
    type: "text",
    class: "chat-input",
    placeholder: "Pregúntale a Coco Blanco o adjunta un documento…",
    spellcheck: "false",
  }) as HTMLInputElement;

  const send = h("button", { class: "send-btn", title: "Enviar" }, svg(ICONS.arrowUp, 11));
  const bar = h("div", { class: "chat-bar" }, fileInput, attachBtn, input, send);

  const cardEl = h("div", { class: "card wash chat-card" }, h("div", { class: "chat-body" }, chipRow, log, bar));
  const el = h("div", { class: "view" }, cardEl);

  // Clipboard paste support (e.g. pasted screenshots or copied files)
  input.addEventListener("paste", (e) => {
    const items = (e as ClipboardEvent).clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const f = items[i].getAsFile();
          if (f) {
            handleIncomingFile(f);
            break;
          }
        }
      }
    }
  });

  let sending = false;
  let renderedCount = -1;

  async function submit() {
    const query = input.value.trim();
    const file = State.droppedFile;
    if ((!query && !file) || sending) return;

    const userText = query || (file ? `Analiza el documento: ${file.name}` : "");
    input.value = "";
    sending = true;
    Sound.play("send");

    State.chatHistory.push({ id: nextId++, role: "user", content: userText });
    State.stateOverride = "thinking";
    State.notify();
    onHeightChange();

    const context: ChatContext | null = file
      ? {
          kind: "file",
          name: file.name,
          path: file.path || file.name,
          base64: file.base64,
        }
      : null;

    try {
      const activeCoco = State.focusId?.startsWith("coco_") ? State.focusId : "coco_blanco";
      const reply = await Bridge.chatSend(userText, context, activeCoco);
      // Once uploaded in turn 1, clear raw base64 from client memory so subsequent turns
      // don't re-upload bytes; server retains the document in active memory
      if (file && file.base64) {
        file.base64 = undefined;
      }
      State.chatHistory.push({ id: nextId++, role: "assistant", content: reply.text });
      State.stateOverride = null;
      if (reply.cocoId && State.focusId !== reply.cocoId) {
        State.setFocus(reply.cocoId);
      }
      Sound.play("finish");
    } catch (err) {
      State.stateOverride = null;
      State.noteMessage = String(err).replace(/^Error:\s*/, "");
      State.view = "note";
      Sound.play("error");
    } finally {
      sending = false;
      State.notify();
      onHeightChange();
      input.focus();
    }
  }

  send.addEventListener("click", () => void submit());
  input.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      void submit();
    }
    e.stopPropagation();
  });

  function renderSquadPills(): HTMLElement {
    const active = State.focusId || "coco_blanco";
    const selector = h("div", { class: "squad-selector" });

    const cocos = [
      { id: "coco_blanco", label: "Blanco", dot: "#ffffff", cls: "blanco", title: "Coco Blanco: General & Documentos" },
      { id: "coco_verde", label: "Verde", dot: "#10b981", cls: "verde", title: "Coco Verde: Operaciones, WhatsApp & Agenda" },
      { id: "coco_rojo", label: "Rojo", dot: "#ef4444", cls: "rojo", title: "Coco Rojo: Deep Research & Tareas Pesadas" },
    ].filter((c) => c.id === "coco_blanco" || State.settings.activeIntegrations.includes(c.id));

    for (const c of cocos) {
      const pill = h(
        "button",
        {
          class: `squad-pill ${c.cls}${active === c.id ? " active" : ""}`,
          title: c.title,
          onclick: (e: Event) => {
            e.stopPropagation();
            State.setFocus(c.id);
            Sound.play("blip");
          },
        },
        h("i", { style: `background:${c.dot}` }),
        h("span", { text: c.label }),
      );
      selector.append(pill);
    }

    return selector;
  }

  return {
    el,
    sync() {
      const activeId = State.focusId || "coco_blanco";
      const file = State.droppedFile;

      // Update wash color based on active Coco
      const washColors: Record<string, string> = {
        coco_blanco: "rgba(255, 255, 255, 0.16)",
        coco_verde: "rgba(16, 185, 129, 0.38)",
        coco_rojo: "rgba(239, 68, 68, 0.38)",
      };
      cardEl.style.setProperty("--wash", washColors[activeId] || "rgba(99, 102, 241, 0.45)");

      // Rebuild chipRow with squad selector + optional attached file chip
      clear(chipRow);
      chipRow.append(renderSquadPills());

      if (file) {
        chipRow.append(
          fileChip(file.name, () => {
            State.droppedFile = null;
            void Bridge.chatSend("cerrar documento", null, "coco_blanco");
            Sound.play("blip");
            State.notify();
            onHeightChange();
          }),
        );
      }

      const thinking = State.stateOverride === "thinking";
      const count = State.chatHistory.length + (thinking ? 0.5 : 0);
      if (count !== renderedCount) {
        renderedCount = count;
        clear(log);
        for (const m of State.chatHistory) log.append(bubble(m));
        if (thinking) log.append(typingDots(file?.name));
        log.scrollTop = log.scrollHeight;
      }

      if (file) {
        input.placeholder = `Pregúntale a Coco Blanco sobre "${file.name}"…`;
      } else {
        const placeholders: Record<string, string> = {
          coco_blanco: "Pregúntale a Coco Blanco o adjunta un archivo…",
          coco_verde: "Consulta agenda, turnos, clientes o WhatsApp…",
          coco_rojo: "Pide un informe, investigación o analiza una URL…",
        };
        input.placeholder = placeholders[activeId] || "Pregúntale a Coco Blanco…";
      }
      input.disabled = sending;
    },
    focus() {
      input.focus();
      input.select();
    },
  };
}
