import type { LoginResponse } from "./authApi";

const SESSION_KEY = "billdesk_session";

export type BillDeskSession = {
    user: LoginResponse["user"];
    company: LoginResponse["company"];
};

export function getSession(): BillDeskSession | null {
    const value = localStorage.getItem(SESSION_KEY);

    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as BillDeskSession;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

export function setSession(
    session: BillDeskSession,
): void {
    localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(session),
    );
}

export function clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
}