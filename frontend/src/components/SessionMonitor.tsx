import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, Clock3, LogOut } from "lucide-react";

import api from "../services/api";
import { getAuthToken } from "../services/authStorage";
import {
  getSessionTiming,
  recordSessionActivity,
} from "../services/sessionTiming";
import {
  endSession,
  getRecentSessionEndReason,
  type SessionEndReason,
} from "../services/endSession";

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const WARNING_DURATION_MS = 30 * 1000;
const ABSOLUTE_LIMIT_MS = 12 * 60 * 60 * 1000;

function expireSession(reason: Exclude<SessionEndReason, "manual">): void {
  endSession(reason);
}

export default function SessionMonitor() {
  const { pathname } = useLocation();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  const warningOpenRef = useRef(false);
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (!getAuthToken()) {
      warningOpenRef.current = false;
      setShowWarning(false);
      return;
    }

    function checkSession(): void {
      if (!getAuthToken()) {
        warningOpenRef.current = false;
        setShowWarning(false);
        return;
      }

      const timing = getSessionTiming();

      // Existing sessions without timing data must sign in again.
      if (!timing) {
        expireSession("reauth");
        return;
      }

      const now = Date.now();

      if (now >= timing.startedAt + ABSOLUTE_LIMIT_MS) {
        expireSession("expired");
        return;
      }

      const inactivityDeadline = timing.lastActivityAt + INACTIVITY_LIMIT_MS;

      if (now >= inactivityDeadline) {
        expireSession("inactive");
        return;
      }

      const warningStartsAt = inactivityDeadline - WARNING_DURATION_MS;

      if (now >= warningStartsAt) {
        const remaining = Math.max(
          0,
          Math.ceil((inactivityDeadline - now) / 1000),
        );

        warningOpenRef.current = true;
        setSecondsLeft(remaining);
        setShowWarning(true);
      } else {
        warningOpenRef.current = false;
        setShowWarning(false);
        setVerificationError("");
      }
    }

    function handleActivity(): void {
      if (!getAuthToken()) return;

      // First check the deadline. Activity must not revive an
      // already-expired session.
      checkSession();

      if (!getAuthToken() || warningOpenRef.current || verifyingRef.current) {
        return;
      }

      recordSessionActivity();
    }

    function handleStorage(event: StorageEvent): void {
      if (event.key === "billdesk_auth_token" && !event.newValue) {
        // Ignore an old removal event if a different tab has
        // already created a new session.
        if (getAuthToken()) return;

        const reason = getRecentSessionEndReason();

        window.location.replace(
          reason === "manual"
            ? "/welcome"
            : `/login?reason=${reason ?? "reauth"}`,
        );
        return;
      }

      if (
        event.key === "taxlume_session_timing" ||
        event.key === "billdesk_auth_token"
      ) {
        checkSession();
      }
    }

    const activityEvents = [
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
    ] as const;

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, {
        passive: true,
      });
    });

    window.addEventListener("focus", checkSession);
    window.addEventListener("pageshow", checkSession);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", checkSession);

    // Check timestamps rather than assuming background timers
    // will continue running while a laptop is asleep.
    const intervalId = window.setInterval(checkSession, 1000);

    checkSession();

    return () => {
      window.clearInterval(intervalId);

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });

      window.removeEventListener("focus", checkSession);
      window.removeEventListener("pageshow", checkSession);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", checkSession);
    };
  }, [pathname]);

  async function handleStaySignedIn(): Promise<void> {
    if (verifyingRef.current) return;

    const tokenBeingVerified = getAuthToken();
    const timing = getSessionTiming();

    if (!tokenBeingVerified || !timing) {
      expireSession("reauth");
      return;
    }

    const now = Date.now();

    if (now >= timing.startedAt + ABSOLUTE_LIMIT_MS) {
      expireSession("expired");
      return;
    }

    if (now >= timing.lastActivityAt + INACTIVITY_LIMIT_MS) {
      expireSession("inactive");
      return;
    }

    verifyingRef.current = true;
    setIsVerifying(true);
    setVerificationError("");

    try {
      await api.get("/api/auth/me", { timeout: 10000 });

      // The session may have ended or changed in another tab
      // while the verification request was in progress.
      if (getAuthToken() !== tokenBeingVerified) {
        return;
      }

      const latestTiming = getSessionTiming();

      if (!latestTiming || latestTiming.startedAt !== timing.startedAt) {
        return;
      }

      const verifiedAt = Date.now();

      if (verifiedAt >= latestTiming.startedAt + ABSOLUTE_LIMIT_MS) {
        expireSession("expired");
        return;
      }

      if (verifiedAt >= latestTiming.lastActivityAt + INACTIVITY_LIMIT_MS) {
        expireSession("inactive");
        return;
      }

      // The token is still valid and the inactivity deadline
      // has not passed. Only now may we renew activity.
      recordSessionActivity();
      warningOpenRef.current = false;
      setShowWarning(false);
      setVerificationError("");
    } catch (error: unknown) {
      // The API interceptor or another tab may already have ended
      // or replaced this session. Do not issue a second redirect
      // or display an error for the old session.
      if (getAuthToken() !== tokenBeingVerified) {
        return;
      }

      const status =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

      if (status === 401) {
        expireSession("reauth");
        return;
      }

      setVerificationError(
        "We couldn't verify your session. Check your connection and try again.",
      );
    } finally {
      verifyingRef.current = false;
      setIsVerifying(false);
    }
  }

  if (!showWarning) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
        aria-describedby="session-warning-description"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle size={24} aria-hidden="true" />
        </div>

        <h2
          id="session-warning-title"
          className="mt-5 text-xl font-bold text-slate-900"
        >
          Your session is about to expire
        </h2>

        <p
          id="session-warning-description"
          className="mt-3 text-sm leading-6 text-slate-600"
        >
          You have been inactive for nearly 30 minutes. To protect your account,
          Taxlume will sign you out unless you choose to stay signed in.
        </p>

        <div className="mt-5 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
          <Clock3 size={20} aria-hidden="true" />
          <p className="text-sm font-semibold" aria-live="polite">
            Signing out in {secondsLeft} seconds
          </p>
        </div>

        {verificationError && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {verificationError}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={isVerifying}
            onClick={() => void handleStaySignedIn()}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
          >
            {isVerifying ? "Checking session..." : "Stay Signed In"}
          </button>

          <button
            type="button"
            disabled={isVerifying}
            onClick={() => endSession("manual")}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign Out Now
          </button>
        </div>
      </div>
    </div>
  );
}
