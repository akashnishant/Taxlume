const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

async function deriveHash(
    password: string,
    salt: Uint8Array,
    iterations: number,
): Promise<Uint8Array> {
    const encoder = new TextEncoder();

    const passwordKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations,
            hash: "SHA-256",
        },
        passwordKey,
        HASH_BYTES * 8,
    );

    return new Uint8Array(derivedBits);
}

export async function hashPassword(
    password: string,
): Promise<string> {
    const salt = crypto.getRandomValues(
        new Uint8Array(SALT_BYTES),
    );

    const hash = await deriveHash(
        password,
        salt,
        PBKDF2_ITERATIONS,
    );

    return [
        "pbkdf2",
        "sha256",
        PBKDF2_ITERATIONS.toString(),
        toBase64(salt),
        toBase64(hash),
    ].join("$");
}

export async function verifyPassword(
    password: string,
    storedHash: string,
): Promise<boolean> {
    const parts = storedHash.split("$");

    if (parts.length !== 5) {
        return false;
    }

    const algorithm = parts[0];
    const hashAlgorithm = parts[1];
    const iterationsText = parts[2];
    const saltBase64 = parts[3];
    const hashBase64 = parts[4];

    if (
        algorithm === undefined ||
        hashAlgorithm === undefined ||
        iterationsText === undefined ||
        saltBase64 === undefined ||
        hashBase64 === undefined
    ) {
        return false;
    }

    if (
        algorithm !== "pbkdf2" ||
        hashAlgorithm !== "sha256"
    ) {
        return false;
    }

    const iterations = Number(iterationsText);

    if (
        !Number.isSafeInteger(iterations) ||
        iterations <= 0
    ) {
        return false;
    }

    try {
        const salt = fromBase64(saltBase64);
        const expectedHash = fromBase64(hashBase64);

        const actualHash = await deriveHash(
            password,
            salt,
            iterations,
        );

        if (actualHash.length !== expectedHash.length) {
            return false;
        }

        let difference = 0;

        for (let i = 0; i < actualHash.length; i++) {
            difference |=
                actualHash[i]! ^ expectedHash[i]!;
        }

        return difference === 0;
    } catch {
        return false;
    }
}