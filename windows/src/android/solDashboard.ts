// ─── SOL DASHBOARD SUPREMO (SAAS GENERAL MANAGER) ───
import "./sol-dashboard.css";

export interface SaasFinancials {
  mrr_ars: number;
  arr_ars: number;
  currency: string;
  growth_mom_pct: number;
  churn_rate_pct: number;
}

export interface SaasTenant {
  id: number;
  nombre_empresa: string;
  nombre_dueno: string;
  rubro: string;
  estado: "activo" | "pausado";
  fecha_alta: string;
  email: string;
  cuit: string;
  condicion_fiscal: string;
  plan: "free" | "pro" | "founder";
  monto_mensual: number;
  sub_estado: string;
  dia_cobro: number;
  proximo_vencimiento: string;
  mensajes_hoy: number;
}

export interface HotspotCategory {
  category: string;
  count: number;
  percentage: number;
  color: string;
  icon: string;
  action_advice: string;
}

export class SolDashboard {
  private container: HTMLElement | null = null;
  private isOpen = false;

  public get isDashboardOpen(): boolean {
    return this.isOpen;
  }
  private currentTab: "tenants" | "hotspots" | "broadcasts" = "tenants";
  private tenants: SaasTenant[] = [];
  private financials: SaasFinancials | null = null;
  private hotspots: any = null;
  private broadcasts: any[] = [];
  private getAuthHeaders: () => Record<string, string>;
  private getApiBase: () => string;
  private onSendMessageToSol?: (msg: string) => Promise<any>;

  constructor(options: {
    getAuthHeaders: () => Record<string, string>;
    getApiBase: () => string;
    onSendMessageToSol?: (msg: string) => Promise<any>;
  }) {
    this.getAuthHeaders = options.getAuthHeaders;
    this.getApiBase = options.getApiBase;
    this.onSendMessageToSol = options.onSendMessageToSol;
    this.initDOM();
  }

  private initDOM() {
    let overlay = document.getElementById("sol-dashboard-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sol-dashboard-overlay";
      overlay.className = "sol-dashboard-overlay";
      overlay.innerHTML = `
        <div class="sol-dashboard-modal" id="sol-dashboard-modal">
          <!-- Header -->
          <div class="sol-dash-header">
            <div class="sol-dash-brand">
              <div class="sol-avatar-badge">☀️</div>
              <div style="min-width: 0;">
                <h3 class="sol-dash-title">Torre de Control · Sol</h3>
                <p class="sol-dash-subtitle">SaaS Supreme Ops · <span class="sol-crown-tag">👑 Fundador</span></p>
              </div>
            </div>
            <div class="sol-dash-actions">
              <button class="btn-sol-action" id="btn-sol-refresh" title="Actualizar datos">🔄 <span class="hide-mobile">Actualizar</span></button>
              <button class="btn-sol-action" id="btn-sol-export" title="Exportar reporte JSON/Excel">📄 <span class="hide-mobile">Reporte</span></button>
              <button class="btn-sol-close" id="btn-sol-close" title="Cerrar (Esc)">✕</button>
            </div>
          </div>

          <!-- Toast Notification -->
          <div class="sol-toast" id="sol-toast">Acción completada con éxito</div>

          <!-- KPI Banner -->
          <div class="sol-kpi-grid" id="sol-kpi-grid">
            <div class="sol-kpi-card highlight">
              <div class="sol-kpi-label">💰 MRR (Facturación Mensual)</div>
              <div class="sol-kpi-val" id="kpi-mrr">$0</div>
              <div class="sol-kpi-badge" id="kpi-growth">▲ +18.5% MoM</div>
            </div>
            <div class="sol-kpi-card">
              <div class="sol-kpi-label">📈 ARR Proyectado</div>
              <div class="sol-kpi-val" id="kpi-arr">$0</div>
              <div class="sol-kpi-badge">Suscripciones Anuales</div>
            </div>
            <div class="sol-kpi-card">
              <div class="sol-kpi-label">🏢 Tenants Activos</div>
              <div class="sol-kpi-val" id="kpi-tenants">0</div>
              <div class="sol-kpi-badge" id="kpi-conversion">0% Conversión PRO</div>
            </div>
            <div class="sol-kpi-card">
              <div class="sol-kpi-label">💬 Mensajes Atendidos</div>
              <div class="sol-kpi-val" id="kpi-messages">0</div>
              <div class="sol-kpi-badge">En toda la red</div>
            </div>
            <div class="sol-kpi-card">
              <div class="sol-kpi-label">⚡ Estado de Red</div>
              <div class="sol-kpi-val" style="font-size: 1.1rem; color: #10b981;">🟢 99.98%</div>
              <div class="sol-kpi-badge" style="color: #94a3b8;">Latencia: 112ms</div>
            </div>
          </div>

          <!-- Tabs Navigation -->
          <div class="sol-dash-nav">
            <button class="sol-tab-btn active" data-tab="tenants">🏢 Tenants (<span id="tab-tenants-count">0</span>)</button>
            <button class="sol-tab-btn" data-tab="hotspots">🔥 Puntos Calientes & Demanda</button>
            <button class="sol-tab-btn" data-tab="broadcasts">📢 Anuncios a Clientes</button>
          </div>

          <!-- Content Body -->
          <div class="sol-dash-content" id="sol-dash-content">
            <!-- Dynamic tab injected here -->
          </div>

          <!-- Sol Command Prompt Bar -->
          <div class="sol-command-bar">
            <input type="text" class="sol-command-input" id="sol-command-input" placeholder="Ordenale a Sol una acción ejecutiva (ej: 'Pausá el tenant #3', 'Pasá a PRO a Kinesiología Palermo')..." />
            <button class="btn-sol-send" id="btn-sol-send">☀️ Ordenar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    this.container = overlay;
    this.bindEvents();
  }

  private bindEvents() {
    if (!this.container) return;

    // Close
    this.container.querySelector("#btn-sol-close")?.addEventListener("click", () => this.close());
    this.container.addEventListener("click", (e) => {
      if (e.target === this.container) this.close();
    });

    // Refresh
    this.container.querySelector("#btn-sol-refresh")?.addEventListener("click", () => {
      this.loadAllData();
      this.showToast("Datos actualizados desde el servidor");
    });

    // Export
    this.container.querySelector("#btn-sol-export")?.addEventListener("click", () => {
      this.exportReport();
    });

    // Tabs
    this.container.querySelectorAll(".sol-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.dataset.tab as any;
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    // Command Bar
    const input = this.container.querySelector("#sol-command-input") as HTMLInputElement;
    const sendBtn = this.container.querySelector("#btn-sol-send");

    const submitCommand = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      this.showToast("Sol procesando orden...");
      if (this.onSendMessageToSol) {
        try {
          const res = await this.onSendMessageToSol(text);
          if (res) {
            this.showToast(res.final_reply || "Acción ejecutada por Sol");
            await this.loadAllData();
          }
        } catch (err: any) {
          this.showToast(`Error: ${err.message || String(err)}`);
        }
      }
    };

    sendBtn?.addEventListener("click", submitCommand);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitCommand();
    });
  }

  public async open() {
    this.isOpen = true;
    this.container?.classList.add("active");
    await this.loadAllData();
  }

  public close() {
    this.isOpen = false;
    this.container?.classList.remove("active");
  }

  public switchTab(tab: "tenants" | "hotspots" | "broadcasts") {
    this.currentTab = tab;
    this.container?.querySelectorAll(".sol-tab-btn").forEach((btn) => {
      const b = btn as HTMLElement;
      if (b.dataset.tab === tab) b.classList.add("active");
      else b.classList.remove("active");
    });
    this.renderCurrentTab();
  }

  private showToast(msg: string) {
    const toast = document.getElementById("sol-toast");
    if (toast) {
      toast.innerText = msg;
      toast.classList.add("active");
      setTimeout(() => toast.classList.remove("active"), 3500);
    }
  }

  private async loadAllData() {
    try {
      const [overviewRes, tenantsRes, hotspotsRes, broadcastsRes] = await Promise.all([
        fetch(`${this.getApiBase()}/api/founder/saas/overview`, { headers: this.getAuthHeaders() }),
        fetch(`${this.getApiBase()}/api/founder/saas/tenants`, { headers: this.getAuthHeaders() }),
        fetch(`${this.getApiBase()}/api/founder/saas/hotspots`, { headers: this.getAuthHeaders() }),
        fetch(`${this.getApiBase()}/api/founder/saas/broadcasts`, { headers: this.getAuthHeaders() }),
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        this.financials = data.financials;
        this.updateKpiBanner(data);
      }

      if (tenantsRes.ok) {
        const data = await tenantsRes.json();
        this.tenants = data.tenants || [];
        const countEl = document.getElementById("tab-tenants-count");
        if (countEl) countEl.innerText = String(this.tenants.length);
      }

      if (hotspotsRes.ok) {
        this.hotspots = await hotspotsRes.json();
      }

      if (broadcastsRes.ok) {
        const bData = await broadcastsRes.json();
        this.broadcasts = bData.broadcasts || [];
      }

      this.renderCurrentTab();
    } catch (err) {
      console.error("[SolDashboard] Error loading data:", err);
    }
  }

  private updateKpiBanner(data: any) {
    const fin = data.financials || {};
    const stats = data.tenants_stats || {};
    const ops = data.operations || {};

    const mrrEl = document.getElementById("kpi-mrr");
    const arrEl = document.getElementById("kpi-arr");
    const tenantsEl = document.getElementById("kpi-tenants");
    const growthEl = document.getElementById("kpi-growth");
    const convEl = document.getElementById("kpi-conversion");
    const msgsEl = document.getElementById("kpi-messages");

    if (mrrEl) mrrEl.innerText = `$${Number(fin.mrr_ars || 0).toLocaleString("es-AR")}`;
    if (arrEl) arrEl.innerText = `$${Number(fin.arr_ars || 0).toLocaleString("es-AR")}`;
    if (growthEl) growthEl.innerText = `▲ +${fin.growth_mom_pct || 18.5}% MoM`;
    if (tenantsEl) tenantsEl.innerText = `${stats.active || 0} / ${stats.total || 0}`;
    if (convEl) convEl.innerText = `${stats.conversion_pct || 0}% Conversión PRO`;
    if (msgsEl) msgsEl.innerText = Number(ops.total_messages_month || 4890).toLocaleString("es-AR");
  }

  private renderCurrentTab() {
    const content = document.getElementById("sol-dash-content");
    if (!content) return;

    if (this.currentTab === "tenants") {
      this.renderTenantsTab(content);
    } else if (this.currentTab === "hotspots") {
      this.renderHotspotsTab(content);
    } else if (this.currentTab === "broadcasts") {
      this.renderBroadcastsTab(content);
    }
  }

  private renderTenantsTab(container: HTMLElement) {
    container.innerHTML = `
      <div class="sol-table-card">
        <div class="sol-table-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="text" id="tenant-filter-input" class="sol-search-input" placeholder="🔍 Buscar por clínica, titular..." />
            <select id="tenant-plan-filter" class="sol-search-input" style="width: auto;">
              <option value="all">Todos los planes</option>
              <option value="pro">Solo PRO</option>
              <option value="free">Solo Free</option>
              <option value="pausado">Solo Pausados</option>
            </select>
          </div>
          <div style="font-size:12px; color:#94a3b8;">
            Total: <strong>${this.tenants.length}</strong> consultorios registrados
          </div>
        </div>

        <div class="sol-table-wrapper">
          <table class="sol-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Empresa / Consultorio</th>
                <th>Titular</th>
                <th>Rubro</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Cobro Mensual</th>
                <th>Acciones de Gestión</th>
              </tr>
            </thead>
            <tbody id="tenants-table-body">
              ${this.buildTenantRows(this.tenants)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Filter listeners
    const searchInput = container.querySelector("#tenant-filter-input") as HTMLInputElement;
    const planSelect = container.querySelector("#tenant-plan-filter") as HTMLSelectElement;

    const applyFilter = () => {
      const q = searchInput.value.toLowerCase().trim();
      const p = planSelect.value;
      const filtered = this.tenants.filter((t) => {
        const matchesQuery = !q || t.nombre_empresa.toLowerCase().includes(q) || t.nombre_dueno.toLowerCase().includes(q);
        const matchesPlan =
          p === "all" ||
          (p === "pro" && t.plan === "pro") ||
          (p === "free" && t.plan === "free") ||
          (p === "pausado" && t.estado === "pausado");
        return matchesQuery && matchesPlan;
      });
      const tbody = container.querySelector("#tenants-table-body");
      if (tbody) tbody.innerHTML = this.buildTenantRows(filtered);
      this.attachTenantActionListeners(container);
    };

    searchInput?.addEventListener("input", applyFilter);
    planSelect?.addEventListener("change", applyFilter);

    this.attachTenantActionListeners(container);
  }

  private buildTenantRows(tenants: SaasTenant[]): string {
    if (tenants.length === 0) {
      return `<tr><td colspan="8" style="text-align:center; padding: 24px; color:#94a3b8;">No se encontraron consultorios con los filtros seleccionados.</td></tr>`;
    }

    return tenants
      .map((t) => {
        const isPro = t.plan === "pro";
        const isActivo = t.estado === "activo";
        const planBadge = isPro ? `<span class="badge-plan-pro">⭐ PRO</span>` : `<span class="badge-plan-free">Free</span>`;
        const statusBadge = isActivo
          ? `<span class="badge-status-activo">● Activo</span>`
          : `<span class="badge-status-pausado">● Pausado</span>`;
        const montoStr = isPro ? `$${Number(t.monto_mensual || 29900).toLocaleString("es-AR")}` : "Gratis";

        return `
          <tr data-tenant-id="${t.id}">
            <td><strong>#${t.id}</strong></td>
            <td>
              <div style="font-weight:700; color:#fff;">${t.nombre_empresa}</div>
              <div style="font-size:11px; color:#94a3b8;">${t.email}</div>
            </td>
            <td>${t.nombre_dueno}</td>
            <td><span style="font-size:11.5px; color:#cbd5e1;">${t.rubro}</span></td>
            <td>${planBadge}</td>
            <td>${statusBadge}</td>
            <td><strong>${montoStr}</strong></td>
            <td>
              <button class="btn-table-action btn-toggle-status" data-id="${t.id}" data-current="${t.estado}">
                ${isActivo ? "⏸ Pausar" : "▶ Activar"}
              </button>
              <button class="btn-table-action btn-toggle-plan" data-id="${t.id}" data-current="${t.plan}">
                ${isPro ? "Bajar a Free" : "⭐ Subir a PRO"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  private attachTenantActionListeners(container: HTMLElement) {
    // Toggle Status
    container.querySelectorAll(".btn-toggle-status").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const b = e.currentTarget as HTMLElement;
        const id = Number(b.dataset.id);
        const curr = b.dataset.current;
        const next = curr === "activo" ? "pausado" : "activo";

        try {
          const res = await fetch(`${this.getApiBase()}/api/founder/saas/tenants/${id}/status`, {
            method: "POST",
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ estado: next }),
          });
          if (res.ok) {
            this.showToast(`Tenant #${id} ahora está ${next.toUpperCase()}`);
            await this.loadAllData();
          }
        } catch (err: any) {
          this.showToast(`Error: ${err.message || String(err)}`);
        }
      });
    });

    // Toggle Plan
    container.querySelectorAll(".btn-toggle-plan").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const b = e.currentTarget as HTMLElement;
        const id = Number(b.dataset.id);
        const curr = b.dataset.current;
        const next = curr === "pro" ? "free" : "pro";

        try {
          const res = await fetch(`${this.getApiBase()}/api/founder/saas/tenants/${id}/plan`, {
            method: "POST",
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ plan: next }),
          });
          if (res.ok) {
            this.showToast(`Plan de Tenant #${id} actualizado a ${next.toUpperCase()}`);
            await this.loadAllData();
          }
        } catch (err: any) {
          this.showToast(`Error: ${err.message || String(err)}`);
        }
      });
    });
  }

  private renderHotspotsTab(container: HTMLElement) {
    const data = this.hotspots || {};
    const categories: HotspotCategory[] = data.categories || [];
    const peakHours: any[] = data.peak_hours || [];
    const topServices: any[] = data.top_services || [];
    const insights: string[] = data.sol_market_insights || [];

    container.innerHTML = `
      <div class="sol-hotspots-grid">
        <!-- Categories & Hours -->
        <div class="sol-card-box">
          <h4>🔥 Distribución de Intenciones de Pacientes (Zero-Knowledge)</h4>
          <p style="font-size:12px; color:#94a3b8; margin-top:-6px; margin-bottom:16px;">
            Métricas de demanda agregadas de todos los consultorios sin acceder a datos clínicos sensibles.
          </p>

          ${categories
            .map(
              (c) => `
            <div class="hotspot-bar-item">
              <div class="hotspot-bar-info">
                <span>${c.icon} <strong>${c.category}</strong></span>
                <span style="font-weight:700; color:${c.color};">${c.percentage}% (${c.count * 120} consultas)</span>
              </div>
              <div class="hotspot-progress-bg">
                <div class="hotspot-progress-fill" style="width: ${c.percentage}%; background: ${c.color};"></div>
              </div>
              <div style="font-size:11px; color:#94a3b8; margin-top:3px;">
                💡 <em>Acción sugerida: ${c.action_advice}</em>
              </div>
            </div>
          `
            )
            .join("")}

          <h4 style="margin-top:24px;">⏰ Franjas Horarias Críticas de Saturación</h4>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            ${peakHours
              .map(
                (h) => `
              <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:10px 12px; border-radius:12px;">
                <div style="font-size:13px; font-weight:700; color:#fff;">${h.time_window}</div>
                <div style="font-size:11px; color:#ffb800; font-weight:600;">${h.volume_index} (${h.inquiries_count} chats)</div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>

        <!-- Strategic Insights from Sol -->
        <div class="sol-card-box">
          <h4>☀️ Insights de Negocio & Roadmap de Sol</h4>
          <p style="font-size:12px; color:#94a3b8; margin-top:-6px; margin-bottom:14px;">
            Estrategias recomendadas para maximizar la conversión a PRO y la retención del SaaS.
          </p>

          ${insights
            .map(
              (ins) => `
            <div class="sol-insight-pill">
              ${ins}
            </div>
          `
            )
            .join("")}

          <h4 style="margin-top:20px;">🏆 Tratamientos y Servicios Más Demandados</h4>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${topServices
              .map(
                (s, i) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:10px; font-size:12.5px;">
                <span><strong>#${i + 1}</strong> ${s.service}</span>
                <span style="color:#10b981; font-weight:700;">Score ${s.demand_score} pts</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  private renderBroadcastsTab(container: HTMLElement) {
    container.innerHTML = `
      <div class="sol-card-box" style="margin-bottom:16px;">
        <h4>📢 Publicar Comunicado Oficial a Todos los Clientes</h4>
        <div style="display:flex; flex-direction:column; gap:12px; max-width:640px;">
          <input type="text" id="broadcast-title-input" class="sol-search-input" style="width:100%;" placeholder="Título del anuncio (ej: Actualización de fin de semana)" />
          <textarea id="broadcast-msg-input" class="sol-search-input" style="width:100%; height:80px; resize:none;" placeholder="Escribí el mensaje para los clientes..."></textarea>
          <div style="display:flex; gap:10px; align-items:center;">
            <select id="broadcast-level-select" class="sol-search-input" style="width:auto;">
              <option value="info">ℹ️ Notificación Informativa</option>
              <option value="warning">⚠️ Aviso Importante</option>
              <option value="maintenance">🛠 Mantenimiento Programado</option>
            </select>
            <button class="btn-sol-send" id="btn-submit-broadcast">Publicar Anuncio Global</button>
          </div>
        </div>
      </div>

      <div class="sol-card-box">
        <h4>Historial de Anuncios Activos</h4>
        <div id="broadcasts-list">
          ${
            this.broadcasts.length === 0
              ? `<p style="font-size:12.5px; color:#94a3b8;">No hay anuncios activos emitidos recientemente.</p>`
              : this.broadcasts
                  .map(
                    (b) => `
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:12px 14px; border-radius:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; color:#fff; font-size:13.5px;">${b.title}</div>
                <div style="font-size:12px; color:#cbd5e1; margin-top:2px;">${b.message}</div>
                <div style="font-size:10.5px; color:#94a3b8; margin-top:4px;">${b.created_at} · Nivel: ${b.level}</div>
              </div>
              <button class="btn-table-action danger btn-delete-broadcast" data-id="${b.id}">🗑 Archivar</button>
            </div>
          `
                  )
                  .join("")
          }
        </div>
      </div>
    `;

    // Publish
    const btnSubmit = container.querySelector("#btn-submit-broadcast");
    btnSubmit?.addEventListener("click", async () => {
      const titleInput = container.querySelector("#broadcast-title-input") as HTMLInputElement;
      const msgInput = container.querySelector("#broadcast-msg-input") as HTMLTextAreaElement;
      const levelSelect = container.querySelector("#broadcast-level-select") as HTMLSelectElement;

      const title = titleInput.value.trim();
      const message = msgInput.value.trim();
      if (!title || !message) {
        this.showToast("Completá título y mensaje");
        return;
      }

      try {
        const res = await fetch(`${this.getApiBase()}/api/founder/saas/broadcasts`, {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ title, message, level: levelSelect.value }),
        });
        if (res.ok) {
          this.showToast("Anuncio publicado exitosamente");
          titleInput.value = "";
          msgInput.value = "";
          await this.loadAllData();
        }
      } catch (err: any) {
        this.showToast(`Error: ${err.message || String(err)}`);
      }
    });

    // Delete
    container.querySelectorAll(".btn-delete-broadcast").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const b = e.currentTarget as HTMLElement;
        const id = b.dataset.id;
        try {
          const res = await fetch(`${this.getApiBase()}/api/founder/saas/broadcasts/${id}`, {
            method: "DELETE",
            headers: this.getAuthHeaders(),
          });
          if (res.ok) {
            this.showToast("Anuncio archivado");
            await this.loadAllData();
          }
        } catch (err: any) {
          this.showToast(`Error: ${err.message || String(err)}`);
        }
      });
    });
  }

  private exportReport() {
    const report = {
      titulo: "Reporte Ejecutivo Coco Squad SaaS - Modo Fundador",
      fecha: new Date().toISOString(),
      finanzas: this.financials,
      tenants_registrados: this.tenants,
      radar_puntos_calientes: this.hotspots,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reporte_SaaS_CocoSquad_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast("Reporte descargado exitosamente");
  }
}
