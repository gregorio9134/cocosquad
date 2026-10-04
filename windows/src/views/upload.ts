// Drop zone, upload progress and the "what do you want to do with it" card —
// ports of UploadView / UploadingView / ChooseView from IslandViewContent.swift.
//
// Sending a file by email is not in the Windows v1, so `choose` offers the one
// action the spec asks for: ask a question about it.

import { h, clear } from "./dom";
import { State } from "../core/state";
import type { ViewActions, ViewHost } from "./views";

/** Dashed rounded rect drawn as SVG so the dashes can march like on macOS. */
function dashedFrame(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const el = document.createElementNS(ns, "svg");
  el.setAttribute("class", "drop-frame");
  el.setAttribute("preserveAspectRatio", "none");
  const rect = document.createElementNS(ns, "rect");
  rect.setAttribute("x", "0.75");
  rect.setAttribute("y", "0.75");
  rect.setAttribute("width", "calc(100% - 1.5px)");
  rect.setAttribute("height", "calc(100% - 1.5px)");
  rect.setAttribute("rx", "20");
  rect.setAttribute("fill", "none");
  rect.setAttribute("stroke-width", "1.5");
  rect.setAttribute("stroke-dasharray", "6 5");
  el.append(rect);
  return el;
}

export function buildUpload(): ViewHost {
  const frame = dashedFrame();
  const title = h("div", { class: "drop-title", text: "Arrastra tus archivos aquí" });
  const tags = h(
    "div",
    { class: "drop-tags" },
    ...["PDF", "Word", "PPTX", "Excel", "Docs", "+"].map((t) => h("span", { text: t })),
  );
  const card = h(
    "div",
    { class: "card drop-card" },
    frame,
    h("div", { class: "drop-body" }, title, tags),
  );
  const el = h("div", { class: "view" }, card);

  return {
    el,
    sync() {
      card.classList.toggle("over", State.fileDragOver);
    },
  };
}

export function buildUploading(): ViewHost {
  const cloud = h("span", {
    class: "up-cloud",
    html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;margin-right:6px;opacity:0.8"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>`,
  });
  const label = h("span", { class: "up-name" });
  const leftCol = h("div", { style: "display:flex;align-items:center;min-width:0;overflow:hidden" }, cloud, label);
  const percent = h("span", { class: "up-pct" });
  const info = h("span", { style: "font-size:12px;opacity:0.6;margin-left:4px", text: "ⓘ" });
  const rightCol = h("div", { style: "display:flex;align-items:center" }, percent, info);
  const fill = h("div", { class: "up-fill" });
  const glow = h("div", { class: "up-glow" });
  const card = h(
    "div",
    { class: "card up-card" },
    h("div", { class: "up-row" }, leftCol, rightCol),
    h("div", { class: "up-track" }, fill, glow),
  );
  const el = h("div", { class: "view" }, card);

  return {
    el,
    sync() {
      const done = State.uploadProgress >= 0.999;
      const pct = Math.min(100, Math.round(State.uploadProgress * 100));
      label.textContent = done
        ? `✓  ${State.droppedFile?.name ?? "Archivo listo"}`
        : `Subiendo ${State.droppedFile?.name ?? "archivos..."}`;
      label.classList.toggle("done", done);
      percent.textContent = `${pct}%`;
      fill.style.width = `${pct}%`;
      glow.style.left = `${pct}%`;
      glow.style.opacity = State.uploadProgress > 0.01 && !done ? "1" : "0";
      card.classList.toggle("done", done);
    },
  };
}

export function buildChoose(actions: ViewActions): ViewHost {
  const title = h("div", { class: "title" });
  const sub = h("div", { class: "sub", text: "¿Qué deseas hacer con el documento?" });
  const row = h(
    "div",
    { class: "actions" },
    h("button", {
      class: "btn primary",
      text: "Consultar con Coco Blanco",
      onclick: () => {
        State.setFocus("coco_blanco");
        actions.setView("prompt");
      },
    }),
    h("button", {
      class: "btn secondary",
      text: "Cancelar",
      onclick: () => actions.setView(State.defaultView()),
    }),
  );
  const el = h(
    "div",
    { class: "view" },
    h(
      "div",
      { class: "card" },
      h("div", { class: "stack", style: "padding:0 24px 0 118px" }, title, sub, row),
    ),
  );

  return {
    el,
    sync() {
      clear(title);
      title.append(
        h("b", { text: State.droppedFile?.name ?? "El documento" }),
        document.createTextNode(" está listo."),
      );
    },
  };
}
