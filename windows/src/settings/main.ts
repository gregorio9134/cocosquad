// Settings window — Coco Squad configuration.
import "./settings.css";
import { Bridge, onEvent } from "../core/bridge";
import { DEFAULT_SETTINGS, type Settings } from "../core/state";
import { h, clear } from "../views/dom";

let settings: Settings = { ...DEFAULT_SETTINGS };
let initialSettings: Settings = { ...DEFAULT_SETTINGS };

const root = document.getElementById("settings-root")!;

async function save() {
  await Bridge.saveSettings(settings);
}

// ── Reusable bits ─────────────────────────────────────────────────────────────

function toggle(on: boolean, onChange: (v: boolean) => void): HTMLElement {
  const el = h("button", { class: on ? "switch on" : "switch", "aria-pressed": on });
  el.addEventListener("click", () => {
    const next = !el.classList.contains("on");
    el.classList.toggle("on", next);
    onChange(next);
  });
  return el;
}

// ── Miembros del Squad ────────────────────────────────────────────────────────

function squadMembersSection(): HTMLElement {
  const members = [
    ["Coco Blanco", "#FFFFFF", "Asistente general y productividad"],
    ["Coco Verde", "#10B981", "Operaciones y comunicaciones"],
    ["Coco Rojo", "#EF4444", "Investigación y tareas profundas"],
    ["Coco Azul", "#3B82F6", "Analista de datos y reportes de negocio"],
  ];
  const grid = h("div", { class: "squad-grid" });
  for (const [name, color, role] of members) {
    grid.append(h(
      "div",
      { class: "squad-member-card" },
      h(
        "div",
        { class: "squad-member-header" },
        h("i", { class: "dot", style: `background:${color}` }),
        h(
          "div",
          { style: "display:flex;flex-direction:column;gap:1px;" },
          h("span", { class: "squad-member-name", text: name }),
          h("span", { style: "font-size:10.5px;color:#9aa1b2;line-height:1.2;", text: role }),
        ),
      ),
    ));
  }
  return h(
    "section",
    {},
    h("h2", {}, h("span", { text: "Miembros del Squad" })),
    h("div", { class: "hint", text: "Los cuatro Cocos se comunican con el servidor Coco Squad." }),
    grid,
  );
}

// ── General section ───────────────────────────────────────────────────────────

function generalSection(): HTMLElement {
  const volume = h("input", {
    type: "range",
    min: "0",
    max: "0.2",
    step: "0.005",
    value: String(settings.soundVolume),
  }) as HTMLInputElement;
  volume.addEventListener("input", () => {
    settings.soundVolume = Number(volume.value);
    void save();
  });

  const autoClose = h("input", {
    type: "number",
    min: "5",
    max: "120",
    step: "1",
    value: String(Math.round(settings.autoCloseInterval)),
    style: "width:72px",
  }) as HTMLInputElement;
  autoClose.addEventListener("change", () => {
    settings.autoCloseInterval = Math.max(5, Math.min(120, Number(autoClose.value) || 15));
    autoClose.value = String(settings.autoCloseInterval);
    void save();
  });

  const screen = h("select", {}) as HTMLSelectElement;
  screen.append(
    h("option", { value: "primary", text: "Pantalla principal" }),
    h("option", { value: "cursor", text: "Bajo el cursor" }),
  );
  screen.value = settings.screen;
  screen.addEventListener("change", () => {
    settings.screen = screen.value as Settings["screen"];
    void save();
  });

  return h(
    "section",
    {},
    h("h2", {}, h("span", { text: "General" })),
    h(
      "div",
      { class: "row" },
      h("label", { text: "Sonido" }),
      toggle(settings.soundEnabled, (v) => {
        settings.soundEnabled = v;
        void save();
      }),
      volume,
    ),
    h(
      "div",
      { class: "row" },
      h("label", { text: "Cierre automático" }),
      autoClose,
      h("span", { class: "hint", text: "segundos tras salir de la isla" }),
    ),
    h(
      "div",
      { class: "row" },
      h("label", { text: "Mostrar isla en" }),
      screen,
    ),
    h(
      "div",
      { class: "row" },
      h("label", { text: "Iniciar con el sistema" }),
      toggle(settings.autostart, (v) => {
        settings.autostart = v;
        void save();
      }),
    ),
  );
}

// ── Action Buttons ────────────────────────────────────────────────────────────

function actionsSection(): HTMLElement {
  const container = h("div", { class: "settings-actions-footer" });

  const quitBtn = h("button", {
    class: "btn-quit",
    text: "Salir de Coco Squad",
  });
  quitBtn.addEventListener("click", async () => {
    quitBtn.disabled = true;
    quitBtn.textContent = "Cerrando…";
    await Bridge.quit();
  });

  const rightGroup = h("div", { class: "settings-actions-right" });

  const cancelBtn = h("button", {
    class: "btn-cancel",
    text: "Cancelar",
  });
  cancelBtn.addEventListener("click", async () => {
    settings = { ...initialSettings };
    await Bridge.saveSettings(settings);
    await Bridge.closeSettingsWindow();
  });

  const applyBtn = h("button", {
    class: "btn-apply",
    text: "Aplicar",
  });
  applyBtn.addEventListener("click", async () => {
    applyBtn.disabled = true;
    const oldText = applyBtn.textContent;
    applyBtn.textContent = "Aplicando…";
    try {
      await save();
      initialSettings = { ...settings };
      applyBtn.textContent = "✓ ¡Aplicado!";
      setTimeout(async () => {
        await Bridge.closeSettingsWindow();
        applyBtn.textContent = oldText;
        applyBtn.disabled = false;
      }, 500);
    } catch {
      applyBtn.textContent = "Error";
      setTimeout(() => {
        applyBtn.textContent = oldText;
        applyBtn.disabled = false;
      }, 1500);
    }
  });

  rightGroup.append(cancelBtn, applyBtn);
  container.append(quitBtn, rightGroup);
  return container;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main() {
  const boot = await Bridge.boot();
  if (boot) {
    settings = { ...settings, ...boot.settings };
    initialSettings = { ...settings };
  }

  clear(root);
  root.append(
    h("h1", {}, h("span", { text: "Coco Squad" }), h("span", { class: "version", text: "0.1.0" })),
    squadMembersSection(),
    generalSection(),
    h("div", {
      class: "hint",
      text: "Sin telemetría. El chat se conecta al servidor Coco Squad.",
    }),
    actionsSection(),
  );

  void onEvent<Settings>("settings-changed", (s) => {
    settings = { ...settings, ...s };
  });
}

void main();
