import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  NotificationContext,
  type NotificationOptions,
  type NotificationType,
} from "./notificationContext";

type Notification = NotificationOptions & {
  id: number;
  duration: number;
};

type NotificationProviderProps = {
  children: ReactNode;
};

const notificationStyles = {
  success: {
    icon: CheckCircle2,
    border: "border-emerald-200",
    background: "bg-emerald-50",
    iconColor: "text-emerald-600",
    progress: "bg-emerald-500",
  },
  error: {
    icon: AlertCircle,
    border: "border-red-200",
    background: "bg-red-50",
    iconColor: "text-red-600",
    progress: "bg-red-500",
  },
  warning: {
    icon: TriangleAlert,
    border: "border-amber-200",
    background: "bg-amber-50",
    iconColor: "text-amber-600",
    progress: "bg-amber-500",
  },
  info: {
    icon: Info,
    border: "border-blue-200",
    background: "bg-blue-50",
    iconColor: "text-blue-600",
    progress: "bg-blue-500",
  },
};

function getDuration(type: NotificationType): number {
  return type === "error" || type === "warning" ? 5000 : 4000;
}

export default function NotificationProvider({
  children,
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const nextId = useRef(0);

  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    );
  }, []);

  const notify = useCallback(
    (options: NotificationOptions) => {
      const id = ++nextId.current;
      const duration = getDuration(options.type);

      const notification: Notification = {
        ...options,
        id,
        duration,
      };

      setNotifications((current) => [...current.slice(-2), notification]);

      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);

      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const activeTimers = timers.current;

    return () => {
      activeTimers.forEach((timer) => {
        clearTimeout(timer);
      });

      activeTimers.clear();
    };
  }, []);

  const contextValue = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:w-full sm:max-w-sm"
        aria-label="Application notifications"
      >
        {notifications.map((notification) => {
          const styles = notificationStyles[notification.type];
          const Icon = styles.icon;

          return (
            <div
              key={notification.id}
              role={notification.type === "error" ? "alert" : "status"}
              aria-atomic="true"
              className={`pointer-events-auto w-full overflow-hidden rounded-xl border bg-white shadow-lg ${styles.border}`}
            >
              <div className="flex items-start gap-3 p-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.background}`}
                >
                  <Icon
                    size={21}
                    className={styles.iconColor}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {notification.title}
                  </p>

                  {notification.description && (
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      {notification.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(notification.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="h-1 bg-slate-100">
                <div
                  className={`h-full origin-left motion-safe:animate-[notification-progress_linear_forwards] ${styles.progress}`}
                  style={{
                    animationDuration: `${notification.duration}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}
