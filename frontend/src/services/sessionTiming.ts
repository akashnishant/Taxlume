const SESSION_TIMING_KEY = "taxlume_session_timing";

export type SessionTiming = {
  startedAt: number;
  lastActivityAt: number;
};

export function getSessionTiming(): SessionTiming | null {
  const saved = localStorage.getItem(SESSION_TIMING_KEY);

  if (!saved) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(saved);

    if (
      typeof value !== "object" ||
      value === null ||
      !("startedAt" in value) ||
      !("lastActivityAt" in value) ||
      typeof value.startedAt !== "number" ||
      typeof value.lastActivityAt !== "number" ||
      !Number.isFinite(value.startedAt) ||
      !Number.isFinite(value.lastActivityAt) ||
      value.startedAt <= 0 ||
      value.lastActivityAt < value.startedAt
    ) {
      localStorage.removeItem(SESSION_TIMING_KEY);
      return null;
    }

    return {
      startedAt: value.startedAt,
      lastActivityAt: value.lastActivityAt,
    };
  } catch {
    localStorage.removeItem(SESSION_TIMING_KEY);
    return null;
  }
}

export function startSessionTiming(): void {
  const now = Date.now();

  const timing: SessionTiming = {
    startedAt: now,
    lastActivityAt: now,
  };

  localStorage.setItem(SESSION_TIMING_KEY, JSON.stringify(timing));
}

export function recordSessionActivity(): void {
  const timing = getSessionTiming();

  if (!timing) {
    return;
  }

  const updated: SessionTiming = {
    ...timing,
    lastActivityAt: Math.max(timing.lastActivityAt, Date.now()),
  };

  localStorage.setItem(SESSION_TIMING_KEY, JSON.stringify(updated));
}

export function clearSessionTiming(): void {
  localStorage.removeItem(SESSION_TIMING_KEY);
}