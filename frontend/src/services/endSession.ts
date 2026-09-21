import { clearAuthToken } from "./authStorage";
import { clearSession } from "./sessionStorage";

export type SessionEndReason =
  | "manual"
  | "inactive"
  | "expired"
  | "reauth";

const SESSION_END_KEY = "taxlume_session_end";

export function getRecentSessionEndReason(): SessionEndReason | null {
  try {
    const saved = localStorage.getItem(SESSION_END_KEY);
    if (!saved) return null;

    const value: unknown = JSON.parse(saved);

    if (
      typeof value !== "object" ||
      value === null ||
      !("reason" in value) ||
      !("at" in value) ||
      typeof value.at !== "number" ||
      Date.now() - value.at < 0 ||
      Date.now() - value.at > 15_000 ||
      !["manual", "inactive", "expired", "reauth"].includes(
        String(value.reason),
      )
    ) {
      return null;
    }

    return value.reason as SessionEndReason;
  } catch {
    return null;
  }
}

export function endSession(reason: SessionEndReason): void {
  // Write the reason first: other tabs receive the token-removal
  // event after this value is available.
  localStorage.setItem(
    SESSION_END_KEY,
    JSON.stringify({ reason, at: Date.now() }),
  );

  clearAuthToken();
  clearSession();

  const destination =
    reason === "manual" ? "/welcome" : `/login?reason=${reason}`;

  window.location.replace(destination);
}