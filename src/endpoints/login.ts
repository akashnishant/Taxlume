import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { verifyPassword } from "../utils/password";
import { createAuthToken } from "../utils/auth/token";

const LoginRequest = z.object({
    email: z.email(),
    password: z.string().min(1).max(128),
});

export class Login extends OpenAPIRoute {
    schema = {
        tags: ["Authentication"],
        summary: "Authenticate a Taxlume user",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: LoginRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Login successful",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            token: z.string(),
                            user: z.object({
                                id: z.string(),
                                email: z.string(),
                                full_name: z.string(),
                            }),
                            company: z.object({
                                id: z.string(),
                                legal_name: z.string(),
                                trade_name: z.string().nullable(),
                                role: z.string(),
                            }),
                        }),
                    },
                },
            },
            "401": {
                description: "Invalid email or password",
            },
        },
    };

    async handle(c: AppContext) {
        const data =
            await this.getValidatedData<typeof this.schema>();

        const body = data.body;

        const user = await c.env.DB
            .prepare(`
				SELECT
					id,
					email,
					password_hash,
					full_name,
					is_active
				FROM users
				WHERE email = ?
			`)
            .bind(body.email.toLowerCase())
            .first<{
                id: string;
                email: string;
                password_hash: string;
                full_name: string;
                is_active: number;
            }>();

        if (!user || user.is_active !== 1) {
            return c.json(
                {
                    success: false,
                    message: "Invalid email or password",
                },
                401,
            );
        }

        const passwordValid = await verifyPassword(
            body.password,
            user.password_hash,
        );

        if (!passwordValid) {
            return c.json(
                {
                    success: false,
                    message: "Invalid email or password",
                },
                401,
            );
        }

        const membership = await c.env.DB
            .prepare(`
				SELECT
					cm.company_id,
					cm.role,
					c.legal_name,
					c.trade_name
				FROM company_members cm
				INNER JOIN companies c
					ON c.id = cm.company_id
				WHERE cm.user_id = ?
					AND cm.is_active = 1
					AND c.is_active = 1
				ORDER BY cm.created_at ASC
				LIMIT 1
			`)
            .bind(user.id)
            .first<{
                company_id: string;
                role: string;
                legal_name: string;
                trade_name: string | null;
            }>();

        if (!membership) {
            return c.json(
                {
                    success: false,
                    message: "No active company membership found",
                },
                401,
            );
        }

        const expiresAt =
            Date.now() + 12 * 60 * 60 * 1000;

        const token = await createAuthToken(
            {
                userId: user.id,
                companyId: membership.company_id,
                expiresAt,
            },
            c.env.JWT_SECRET,
        );

        return {
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
            },
            company: {
                id: membership.company_id,
                legal_name: membership.legal_name,
                trade_name: membership.trade_name,
                role: membership.role,
            },
        };
    }
}