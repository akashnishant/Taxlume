import axios from "axios";

function extractMessage(value: unknown): string | null {
  if (typeof value === "string") {
    const message = value.trim();

    return message || null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = extractMessage(item);

      if (message) {
        return message;
      }
    }

    return null;
  }

  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;

    if (typeof item.message === "string") {
      const message = item.message.trim();

      if (message) {
        return message;
      }
    }
  }

  return null;
}

export function getApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = error.response?.data;

  if (!data) {
    return fallback;
  }

  const directMessage = extractMessage(data);

  if (directMessage) {
    return directMessage;
  }

  if (typeof data === "object" && data !== null) {
    const payload = data as {
      message?: unknown;
      errors?: unknown;
      error?: unknown;
    };

    return (
      extractMessage(payload.message) ??
      extractMessage(payload.errors) ??
      extractMessage(payload.error) ??
      fallback
    );
  }

  return fallback;
}