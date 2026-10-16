// Coco Squad Mobile — Native Notifications, System Presence & Dynamic Favicon
// Isolated modular handler for notifications, App Badging API, and Oracle activity indicators

export type AgentNavigator = (agentId: string) => void;

let agentNavigatorCallback: AgentNavigator | null = null;
let activeNetworkRequests = 0;
let pendingBackgroundTasksCount = 0;

const NORMAL_FAVICON = "/icons/32x32.png";
const ACTIVE_FAVICON_SVG = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%23090a0f"/><circle cx="16" cy="16" r="8" fill="%2300E676"><animate attributeName="r" values="6;9;6" dur="1s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite"/></circle><circle cx="16" cy="16" r="4" fill="%23FFFFFF"/></svg>`;

/**
 * Register callback to switch agents when a notification is clicked
 */
export function registerAgentNavigator(fn: AgentNavigator): void {
  agentNavigatorCallback = fn;
}

/**
 * Safely requests notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }
    if (Notification.permission === "granted") {
      return true;
    }
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    return false;
  } catch (err) {
    console.warn("[Notifications] Error requesting notification permission:", err);
    return false;
  }
}

/**
 * Helper to clean markdown syntax from notification body text
 */
function cleanNotificationBody(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/[#*`_~>[\]]/g, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 140);
}

/**
 * Dispatches a native system notification when an agent completes a task while the app is hidden
 */
export function notifyAgentCompletion(agentId: string, title: string, body: string): void {
  try {
    // Only fire system notifications if the user is outside the app
    if (typeof document === "undefined" || document.visibilityState !== "hidden") {
      return;
    }

    // Increment and apply App Badging
    pendingBackgroundTasksCount++;
    void setAppBadge(pendingBackgroundTasksCount);

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    const cleanBody = cleanNotificationBody(body);
    const notification = new Notification(title, {
      body: cleanBody,
      icon: "/icons/128x128.png",
      badge: "/icons/32x32.png",
      tag: `coco-agent-${agentId}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      try {
        if (typeof window !== "undefined") {
          window.focus();
        }
        if (agentNavigatorCallback) {
          agentNavigatorCallback(agentId);
        }
        notification.close();
      } catch (err) {
        console.warn("[Notifications] Error in notification.onclick:", err);
      }
    };
  } catch (err) {
    console.warn("[Notifications] Failed to dispatch agent notification:", err);
  }
}

/**
 * Updates the App Badging API count on supported operating systems
 */
export async function setAppBadge(count: number = 1): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
      await (navigator as any).setAppBadge(count);
    }
  } catch {
    // Silently ignore environments that restrict badging
  }
}

/**
 * Clears the App Badging API count
 */
export async function clearAppBadge(): Promise<void> {
  try {
    pendingBackgroundTasksCount = 0;
    if (typeof navigator !== "undefined" && "clearAppBadge" in navigator) {
      await (navigator as any).clearAppBadge();
    }
  } catch {
    // Silently ignore
  }
}

/**
 * Notifies the start of an asynchronous request to Oracle backend
 */
export function notifyRequestStart(): void {
  activeNetworkRequests++;
  updateDynamicFavicon();
}

/**
 * Notifies the end of an asynchronous request to Oracle backend
 */
export function notifyRequestEnd(): void {
  activeNetworkRequests = Math.max(0, activeNetworkRequests - 1);
  updateDynamicFavicon();
}

/**
 * Updates the <link rel="icon"> between default and active pulsing states
 */
function updateDynamicFavicon(): void {
  try {
    if (typeof document === "undefined") return;
    const favicon = document.getElementById("app-favicon") as HTMLLinkElement | null;
    if (!favicon) return;

    if (activeNetworkRequests > 0) {
      if (favicon.href !== ACTIVE_FAVICON_SVG) {
        favicon.href = ACTIVE_FAVICON_SVG;
      }
    } else {
      if (!favicon.href.includes(NORMAL_FAVICON)) {
        favicon.href = NORMAL_FAVICON;
      }
    }
  } catch {
    // Ignore favicon swap errors
  }
}

/**
 * Binds visibility and window focus listeners to automatically clear badges
 */
export function initSystemPresence(onVisibleCallback?: () => void): void {
  try {
    if (typeof document === "undefined") return;

    const handleActive = () => {
      if (document.visibilityState === "visible") {
        void clearAppBadge();
        if (onVisibleCallback) {
          onVisibleCallback();
        }
      }
    };

    document.addEventListener("visibilitychange", handleActive);
    window.addEventListener("focus", handleActive);
  } catch (err) {
    console.warn("[Notifications] Error initializing system presence:", err);
  }
}
