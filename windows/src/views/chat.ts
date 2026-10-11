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

  const prodContainer = h("div", { class: "prod-container" });
  const cardEl = h("div", { class: "card wash chat-card" }, h("div", { class: "chat-body" }, chipRow, prodContainer, log, bar));
  const el = h("div", { class: "view" }, cardEl);

  let prodOpen = false;
  let prodTab: "tasks" | "notes" = "tasks";

  function syncProductivity() {
    clear(prodContainer);
    if (!prodOpen) return;

    const panel = h("div", { class: "prod-panel" });
    const pending = State.todos.filter((t) => !t.done).length;
    const notesCount = State.quickNotes.length;

    const tabT = h(
      "button",
      {
        class: `prod-tab${prodTab === "tasks" ? " active" : ""}`,
        onclick: (e: Event) => {
          e.stopPropagation();
          prodTab = "tasks";
          syncProductivity();
        },
      },
      svg(ICONS.checklist, 10),
      h("span", { text: `Tareas (${pending})` }),
    );

    const tabN = h(
      "button",
      {
        class: `prod-tab${prodTab === "notes" ? " active" : ""}`,
        onclick: (e: Event) => {
          e.stopPropagation();
          prodTab = "notes";
          syncProductivity();
        },
      },
      svg(ICONS.doc, 10),
      h("span", { text: `Notas (${notesCount})` }),
    );

    const closeBtn = h(
      "button",
      {
        class: "prod-close-btn",
        title: "Cerrar panel de productividad",
        onclick: (e: Event) => {
          e.stopPropagation();
          prodOpen = false;
          Sound.play("blip");
          syncProductivity();
          onHeightChange();
        },
      },
      svg(ICONS.xmark, 8),
    );

    const header = h("div", { class: "prod-header" }, h("div", { class: "prod-tabs" }, tabT, tabN), closeBtn);
    panel.append(header);

    if (prodTab === "tasks") {
      const inTask = h("input", {
        class: "prod-input",
        placeholder: "+ Nueva tarea para hoy…",
        type: "text",
        spellcheck: "false",
      }) as HTMLInputElement;

      const addBtn = h(
        "button",
        {
          class: "prod-add-btn",
          title: "Agregar tarea",
          onclick: (e: Event) => {
            e.stopPropagation();
            const val = inTask.value.trim();
            if (val) {
              State.addTodo(val);
              Sound.play("finish");
              inTask.value = "";
              syncProductivity();
              onHeightChange();
            }
          },
        },
        svg(ICONS.plus, 10),
      );

      inTask.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") {
          e.preventDefault();
          addBtn.click();
        }
        e.stopPropagation();
      });

      const addRow = h("div", { class: "prod-add-row" }, inTask, addBtn);
      panel.append(addRow);

      const list = h("div", { class: "prod-list" });
      if (State.todos.length === 0) {
        list.append(h("div", { class: "prod-empty", text: "No tienes tareas pendientes hoy. ¡Coco Blanco te acompaña!" }));
      } else {
        for (const item of State.todos) {
          const check = h(
            "button",
            {
              class: `prod-check${item.done ? " checked" : ""}`,
              title: item.done ? "Marcar como pendiente" : "Marcar como completada",
              onclick: (e: Event) => {
                e.stopPropagation();
                State.toggleTodo(item.id);
                Sound.play(item.done ? "finish" : "blip");
                syncProductivity();
              },
            },
            item.done ? svg(ICONS.check, 9) : null,
          );

          const label = h("span", {
            class: `prod-item-text${item.done ? " done" : ""}`,
            text: item.text,
            onclick: (e: Event) => {
              e.stopPropagation();
              check.click();
            },
          });

          const del = h(
            "button",
            {
              class: "prod-item-del",
              title: "Eliminar tarea",
              onclick: (e: Event) => {
                e.stopPropagation();
                State.removeTodo(item.id);
                Sound.play("blip");
                syncProductivity();
                onHeightChange();
              },
            },
            svg(ICONS.xmark, 7),
          );

          list.append(h("div", { class: "prod-item" }, check, label, del));
        }
      }
      panel.append(list);
    } else {
      const inNote = h("input", {
        class: "prod-input",
        placeholder: "+ Escribir nota rápida…",
        type: "text",
        spellcheck: "false",
      }) as HTMLInputElement;

      const addBtn = h(
        "button",
        {
          class: "prod-add-btn",
          title: "Guardar nota",
          onclick: (e: Event) => {
            e.stopPropagation();
            const val = inNote.value.trim();
            if (val) {
              State.addNote(val);
              Sound.play("finish");
              inNote.value = "";
              syncProductivity();
              onHeightChange();
            }
          },
        },
        svg(ICONS.plus, 10),
      );

      inNote.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") {
          e.preventDefault();
          addBtn.click();
        }
        e.stopPropagation();
      });

      const addRow = h("div", { class: "prod-add-row" }, inNote, addBtn);
      panel.append(addRow);

      const list = h("div", { class: "prod-list" });
      if (State.quickNotes.length === 0) {
        list.append(h("div", { class: "prod-empty", text: "Sin notas rápidas en el escritorio." }));
      } else {
        for (const item of State.quickNotes) {
          const label = h("span", { class: "prod-note-text", text: item.text });
          const time = h("span", {
            class: "prod-note-time",
            text: new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
          const del = h(
            "button",
            {
              class: "prod-item-del",
              title: "Eliminar nota",
              onclick: (e: Event) => {
                e.stopPropagation();
                State.removeNote(item.id);
                Sound.play("blip");
                syncProductivity();
                onHeightChange();
              },
            },
            svg(ICONS.xmark, 7),
          );

          list.append(h("div", { class: "prod-item" }, label, time, del));
        }
      }
      panel.append(list);
    }

    prodContainer.append(panel);
  }

  function renderProductivityButton(): HTMLElement {
    const pending = State.todos.filter((t) => !t.done).length;
    return h(
      "button",
      {
        class: `prod-toggle-pill${prodOpen ? " active" : ""}`,
        title: "Tareas y Notas de hoy (Productividad Coco Blanco)",
        onclick: (e: Event) => {
          e.stopPropagation();
          prodOpen = !prodOpen;
          Sound.play("blip");
          syncProductivity();
          onHeightChange();
        },
      },
      svg(ICONS.checklist, 10),
      h("span", { text: "Tareas" }),
      pending > 0 ? h("span", { class: "prod-badge", text: String(pending) }) : null,
    );
  }

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

    // Interceptar comandos de productividad en lenguaje natural para respuesta instantánea
    const matchTodo = userText.match(/^(?:\/tarea|\/todo|tarea:|anotar tarea:|anotame:|recordame:|nueva tarea:)\s*(.+)/i);
    if (matchTodo && matchTodo[1]) {
      const taskTxt = matchTodo[1].trim();
      State.addTodo(taskTxt);
      State.chatHistory.push({ id: nextId++, role: "user", content: userText });
      State.chatHistory.push({
        id: nextId++,
        role: "assistant",
        content: `✅ **Tarea guardada en tu lista de hoy:**\n• ${taskTxt}\n\n*Puedes verla, marcarla o agregar más en el botón "📋 Tareas" de Coco Blanco.*`,
      });
      Sound.play("finish");
      State.triggerMochi("finished");
      syncProductivity();
      State.notify();
      onHeightChange();
      input.focus();
      return;
    }

    const matchNote = userText.match(/^(?:\/nota|nota:|guardar nota:|anotar nota:)\s*(.+)/i);
    if (matchNote && matchNote[1]) {
      const noteTxt = matchNote[1].trim();
      State.addNote(noteTxt);
      State.chatHistory.push({ id: nextId++, role: "user", content: userText });
      State.chatHistory.push({
        id: nextId++,
        role: "assistant",
        content: `📝 **Nota rápida guardada en el escritorio:**\n• ${noteTxt}`,
      });
      Sound.play("finish");
      State.triggerMochi("finished");
      syncProductivity();
      State.notify();
      onHeightChange();
      input.focus();
      return;
    }

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
      State.stateOverride = null;
      State.chatHistory.push({ id: nextId++, role: "assistant", content: reply.text });
      if (reply.cocoId && State.focusId !== reply.cocoId) {
        State.setFocus(reply.cocoId);
      }
      Sound.play("finish");
      State.triggerMochi("finished");
    } catch (err) {
      State.stateOverride = null;
      State.noteMessage = String(err).replace(/^Error:\s*/, "");
      State.view = "note";
      Sound.play("error");
    } finally {
      State.stateOverride = null;
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
      { id: "coco_azul", label: "Azul", dot: "#3b82f6", cls: "azul", title: "Coco Azul: Análisis de Datos & Reportes de Negocio" },
    ];

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
            State.triggerMochi("greet");
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
        coco_azul: "rgba(59, 130, 246, 0.38)",
      };
      cardEl.style.setProperty("--wash", washColors[activeId] || "rgba(99, 102, 241, 0.45)");

      // Rebuild chipRow with squad selector + optional attached file chip + productivity button
      clear(chipRow);
      chipRow.append(renderSquadPills());

      if (activeId === "coco_blanco") {
        chipRow.append(renderProductivityButton());
      }

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

      syncProductivity();

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
          coco_azul: "Consulta métricas, ventas, stock o reportes de negocio…",
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
