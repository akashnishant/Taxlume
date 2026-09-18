function bytesToHex(
    bytes: Uint8Array,
): string {
    return Array.from(bytes)
        .map((byte) =>
            byte
                .toString(16)
                .padStart(2, "0"),
        )
        .join("");
}

function constantTimeEquals(
    left: string,
    right: string,
): boolean {
    if (left.length !== right.length) {
        return false;
    }

    let difference = 0;

    for (
        let index = 0;
        index < left.length;
        index += 1
    ) {
        difference |=
            left.charCodeAt(index) ^
            right.charCodeAt(index);
    }

    return difference === 0;
}

export async function verifyRazorpayWebhookSignature(
    rawBody: string,
    receivedSignature: string,
    webhookSecret: string,
): Promise<boolean> {
    const encoder =
        new TextEncoder();

    const key =
        await crypto.subtle.importKey(
            "raw",
            encoder.encode(
                webhookSecret,
            ),
            {
                name: "HMAC",
                hash: "SHA-256",
            },
            false,
            ["sign"],
        );

    const signature =
        await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(rawBody),
        );

    const expectedSignature =
        bytesToHex(
            new Uint8Array(
                signature,
            ),
        );

    return constantTimeEquals(
        expectedSignature,
        receivedSignature
            .trim()
            .toLowerCase(),
    );
}