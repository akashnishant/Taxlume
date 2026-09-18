import type { LoginResponse } from "./authApi";

const SESSION_KEY = "billdesk_session";

export type TaxlumeSession = {
    user: LoginResponse["user"];
    company: LoginResponse["company"];
};

export function getSession(): TaxlumeSession | null {
    const value = localStorage.getItem(SESSION_KEY);

    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as TaxlumeSession;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

export function setSession(
    session: TaxlumeSession,
): void {
    localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(session),
    );
}

export function clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
}