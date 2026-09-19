import { createContext } from "react";

export type NotificationType =
  | "success"
  | "error"
  | "warning"
  | "info";

export type NotificationOptions = {
  type: NotificationType;
  title: string;
  description?: string;
};

export type NotificationContextValue = {
  notify: (options: NotificationOptions) => void;
};

export const NotificationContext =
  createContext<NotificationContextValue | null>(null);