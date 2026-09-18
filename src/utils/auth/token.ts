const TOKEN_VERSION = "v1";
const TOKEN_ALGORITHM = "HMAC-SHA256";

export interface AuthTokenPayload {
    userId: string;
    companyId: string;
    expiresAt: number;
}

function toBase64Url(bytes: Uint8Array): string {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
    const base64 = value
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "=");

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function encodeText(value: string): Uint8Array {
    return new TextEncoder().encode(value);
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        encodeText(secret),
        {
            name: "HMAC",
            hash: "SHA-256",
        },
        false,
        ["sign", "verify"],
    );
}

export async function createAuthToken(
    payload: AuthTokenPayload,
    secret: string,
): Promise<string> {
    const payloadBase64 = toBase64Url(
        encodeText(JSON.stringify(payload)),
    );

    const data = `${TOKEN_VERSION}.${payloadBase64}`;

    const key = await getSigningKey(secret);

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encodeText(data),
    );

    return `${data}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAuthToken(
    token: string,
    secret: string,
): Promise<AuthTokenPayload | null> {
    const parts = token.split(".");

    if (parts.length !== 3) {
        return null;
    }

    const version = parts[0];
    const payloadBase64 = parts[1];
    const signatureBase64 = parts[2];

    if (
        version !== TOKEN_VERSION ||
        payloadBase64 === undefined ||
        signatureBase64 === undefined
    ) {
        return null;
    }

    try {
        const key = await getSigningKey(secret);

        const data = `${version}.${payloadBase64}`;
        const signature = fromBase64Url(signatureBase64);

        const valid = await crypto.subtle.verify(
            "HMAC",
            key,
            signature,
            encodeText(data),
        );

        if (!valid) {
            return null;
        }

        const payloadBytes = fromBase64Url(payloadBase64);
        const payloadText = new TextDecoder().decode(payloadBytes);
        const payload = JSON.parse(
            payloadText,
        ) as AuthTokenPayload;

        if (
            typeof payload.userId !== "string" ||
            typeof payload.companyId !== "string" ||
            typeof payload.expiresAt !== "number"
        ) {
            return null;
        }

        if (payload.expiresAt <= Date.now()) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}