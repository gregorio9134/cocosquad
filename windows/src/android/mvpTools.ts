// Coco Squad Mobile — funciones del MVP que viven en el dispositivo.
// Nada de esto se guarda en el servidor.

export const FREE_DAILY_LIMIT = 20;

const USAGE_KEY = "coco_mobile_daily_usage";
const MEMORY_KEY = "coco_mobile_memories";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDailyUsage(): { day: string; count: number } {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { day: string; count: number };
      if (parsed.day === todayKey()) return parsed;
    }
  } catch {}
  return { day: todayKey(), count: 0 };
}

export function registerDailyUsage(): { day: string; count: number } {
  const usage = getDailyUsage();
  usage.count += 1;
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {}
  return usage;
}

export interface MemoryItem {
  id: string;
  text: string;
  createdAt: number;
}

export function loadMemories(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? (JSON.parse(raw) as MemoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveMemories(items: MemoryItem[]) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(items));
  } catch {}
}

export function addMemory(text: string): MemoryItem[] {
  const clean = text.trim().slice(0, 300);
  const items = loadMemories();
  if (clean) {
    items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: clean, createdAt: Date.now() });
    saveMemories(items);
  }
  return items;
}

export function removeMemory(id: string): MemoryItem[] {
  const items = loadMemories().filter((m) => m.id !== id);
  saveMemories(items);
  return items;
}

export function clearMemories(): MemoryItem[] {
  saveMemories([]);
  return [];
}

export interface ServiceStatus {
  ok: boolean;
  latencyMs: number | null;
  checkedAt: string;
}

export async function checkServiceStatus(url: string): Promise<ServiceStatus> {
  const started = performance.now();
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    const latency = Math.round(performance.now() - started);
    return { ok: res.ok, latencyMs: res.ok ? latency : null, checkedAt: new Date().toLocaleTimeString() };
  } catch {
    return { ok: false, latencyMs: null, checkedAt: new Date().toLocaleTimeString() };
  }
}

export function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface SearchHit {
  agentId: string;
  role: string;
  content: string;
}

export function searchHistories(
  histories: Record<string, { role: string; content: string }[]>,
  query: string
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const [agentId, messages] of Object.entries(histories)) {
    for (const m of messages) {
      if (m.content && m.content.toLowerCase().includes(q)) {
        hits.push({ agentId, role: m.role, content: m.content });
      }
    }
  }
  return hits.slice(0, 50);
}
