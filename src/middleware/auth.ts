import { createMiddleware } from "hono/factory";
import { verifyAuthToken } from "../utils/auth/token";

export const authMiddleware = createMiddleware<{
    Bindings: Env;
}>(async (c, next) => {
    const authorization =
        c.req.header("Authorization");

    if (!authorization) {
        return c.json(
            {
                success: false,
                message: "Authentication required",
            },
            401,
        );
    }

    const [scheme, token] =
        authorization.split(" ");

    if (
        scheme !== "Bearer" ||
        !token
    ) {
        return c.json(
            {
                success: false,
                message: "Invalid authorization header",
            },
            401,
        );
    }

    const payload = await verifyAuthToken(
        token,
        c.env.JWT_SECRET,
    );

    if (!payload) {
        return c.json(
            {
                success: false,
                message: "Invalid or expired authentication token",
            },
            401,
        );
    }

    const membership = await c.env.DB
        .prepare(`
		SELECT
			cm.user_id,
			cm.company_id
		FROM company_members cm
		INNER JOIN users u
			ON u.id = cm.user_id
		INNER JOIN companies c
			ON c.id = cm.company_id
		WHERE cm.user_id = ?
			AND cm.company_id = ?
			AND cm.is_active = 1
			AND u.is_active = 1
			AND c.is_active = 1
		LIMIT 1
	`)
        .bind(
            payload.userId,
            payload.companyId,
        )
        .first<{
            user_id: string;
            company_id: string;
        }>();

    if (!membership) {
        return c.json(
            {
                success: false,
                message: "Account or company access is no longer active",
            },
            401,
        );
    }

    c.set("userId", payload.userId);
    c.set("companyId", payload.companyId);

    await next();
});