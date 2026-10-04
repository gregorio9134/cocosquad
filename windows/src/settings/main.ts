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

function statusDot(ok: boolean): HTMLElement {
  return h("i", { class: "dot", style: `background:${ok ? "#22c55e" : "#f4505e"}` });
}

// ── Miembros del Squad section ────────────────────────────────────────────────

interface IntegrationDef {
  id: string;
  name: string;
  color: string;
  /** Credential Manager keys, in the order they are shown. */
  fields: { key: string; label: string; placeholder: string; secret: boolean }[];
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "integration_stripe",
    name: "Stripe",
    color: "#0570DE",
    fields: [{ key: "stripe-api-key", label: "Clave secreta", placeholder: "sk_live_…", secret: true }],
  },
  {
    id: "integration_github",
    name: "GitHub",
    color: "#F4505E",
    fields: [{ key: "github-token", label: "Token de acceso", placeholder: "ghp_…", secret: true }],
  },
  {
    id: "integration_vercel",
    name: "Vercel",
    color: "#7C5CFF",
    fields: [{ key: "vercel-token", label: "Token", placeholder: "…", secret: true }],
  },
  {
    id: "integration_n8n",
    name: "n8n",
    color: "#F29B38",
    fields: [
      { key: "n8n-url", label: "URL de instancia", placeholder: "https://n8n.ejemplo.com", secret: false },
      { key: "n8n-api-key", label: "Clave API", placeholder: "…", secret: true },
    ],
  },
  {
    id: "integration_resend",
    name: "Resend",
    color: "#22C55E",
    fields: [{ key: "resend-api-key", label: "Clave API", placeholder: "re_…", secret: true }],
  },
  {
    id: "integration_notion",
    name: "Notion",
    color: "#8C8C8C",
    fields: [{ key: "notion-api-key", label: "Token de integración", placeholder: "ntn_…", secret: true }],
  },
  {
    id: "integration_calcom",
    name: "Cal.com",
    color: "#C9956A",
    fields: [{ key: "calcom-api-key", label: "Clave API", placeholder: "cal_…", secret: true }],
  },
];

const MAX_ACTIVE = 4;

function squadMembersSection(present: Record<string, boolean>): HTMLElement {
  const note = h("div", { class: "hint" });
  const grid = h("div", { class: "squad-grid" });

  function updateNote() {
    const used = settings.activeIntegrations.length;
    note.textContent = `Selecciona hasta ${MAX_ACTIVE} accesos para mostrar junto a Coco — ${used}/${MAX_ACTIVE} en uso. Las claves se guardan de forma segura en Windows Credential Manager.`;
  }

  for (const def of INTEGRATIONS) {
    const active = settings.activeIntegrations.includes(def.id);
    const sw = h("button", { class: active ? "switch on" : "switch" });
    sw.addEventListener("click", () => {
      const on = settings.activeIntegrations.includes(def.id);
      if (on) {
        settings.activeIntegrations = settings.activeIntegrations.filter((x) => x !== def.id);
      } else {
        if (settings.activeIntegrations.length >= MAX_ACTIVE) return;
        settings.activeIntegrations = [...settings.activeIntegrations, def.id];
      }
      sw.classList.toggle("on", !on);
      updateNote();
      void save();
    });

    const fieldsContainer = h("div", { class: "squad-member-fields" });
    for (const field of def.fields) {
      const isStored = present[field.key] ?? false;
      const input = h("input", {
        type: field.secret ? "password" : "text",
        placeholder: isStored ? "••••••••  (guardada)" : field.placeholder,
        autocomplete: "off",
        spellcheck: "false",
      }) as HTMLInputElement;

      const dotEl = statusDot(isStored);
      const saveBtn = h("button", { class: "squad-save-btn", text: "Guardar" });

      saveBtn.addEventListener("click", async () => {
        const value = input.value.trim();
        try {
          await Bridge.secretSet(field.key, value);
          present[field.key] = value.length > 0;
          input.value = "";
          input.placeholder = value ? "••••••••  (guardada)" : field.placeholder;
          dotEl.style.background = value ? "#22c55e" : "#f4505e";
          saveBtn.textContent = "✓";
          setTimeout(() => {
            saveBtn.textContent = "Guardar";
          }, 1500);
        } catch {
          dotEl.style.background = "#f5a524";
          saveBtn.textContent = "Error";
          setTimeout(() => {
            saveBtn.textContent = "Guardar";
          }, 1500);
        }
      });

      const fieldGroup = h(
        "div",
        { class: "squad-field-group" },
        h("label", { class: "squad-field-label", text: field.label }),
        h("div", { class: "squad-field-row" }, input, saveBtn, dotEl),
      );
      fieldsContainer.append(fieldGroup);
    }

    const card = h(
      "div",
      { class: "squad-member-card" },
      h(
        "div",
        { class: "squad-member-header" },
        sw,
        h("i", { class: "dot", style: `background:${def.color}` }),
        h("span", { class: "squad-member-name", text: def.name }),
      ),
      fieldsContainer,
    );

    grid.append(card);
  }

  updateNote();
  return h(
    "section",
    {},
    h("h2", {}, h("span", { text: "Miembros del Squad" })),
    note,
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

  const keys = [
    "stripe-api-key",
    "github-token",
    "vercel-token",
    "n8n-url",
    "n8n-api-key",
    "resend-api-key",
    "notion-api-key",
    "calcom-api-key",
  ];
  const present: Record<string, boolean> = {};
  for (const k of keys) present[k] = (await Bridge.secretPresent(k)) ?? false;

  clear(root);
  root.append(
    h("h1", {}, h("span", { text: "Coco Squad" }), h("span", { class: "version", text: "0.1.0" })),
    squadMembersSection(present),
    generalSection(),
    h("div", {
      class: "hint",
      text: "Sin telemetría. Las solicitudes de red solo van a los servicios que configures tú mismo.",
    }),
    actionsSection(),
  );

  void onEvent<Settings>("settings-changed", (s) => {
    settings = { ...settings, ...s };
  });
}

void main();
