import { writable } from 'svelte/store';

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  autoHide?: boolean;
}

export const notifications = writable<Notification[]>([]);

export function addNotification(
  type: NotificationType,
  title: string,
  message: string,
  autoHide = true
) {
  const notification: Notification = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    timestamp: Date.now(),
    read: false,
    autoHide
  };

  notifications.update(n => [notification, ...n]);

  if (autoHide) {
    setTimeout(() => {
      notifications.update(n => n.filter(notif => notif.id !== notification.id));
    }, 5000);
  }

  return notification.id;
}

export function markAsRead(id: string) {
  notifications.update(n => 
    n.map(notif => notif.id === id ? { ...notif, read: true } : notif)
  );
}

export function removeNotification(id: string) {
  notifications.update(n => n.filter(notif => notif.id !== id));
}