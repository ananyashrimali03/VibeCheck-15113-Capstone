/** Desktop browser Notification API — best effort (Chrome / Edge / Firefox). */

export function notificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getOsNotificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestOsNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function postVibeOsNotification(payload: {
  title?: string;
  body: string;
  icon?: string | undefined;
  tag?: string;
}): boolean {
  if (!notificationSupported() || Notification.permission !== "granted") return false;
  try {
    new Notification(payload.title ?? "VibeCheck", {
      body: payload.body.slice(0, 240),
      icon: payload.icon,
      tag: payload.tag ?? "vibecheck-vibe",
      silent: false,
    });
    return true;
  } catch {
    return false;
  }
}
