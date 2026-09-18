import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { authMiddleware } from "../middleware/auth";

export class Me extends OpenAPIRoute {
    schema = {
        tags: ["Authentication"],
        summary: "Get the authenticated user",
        responses: {
            "200": {
                description: "Authenticated user details",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            user_id: z.string(),
                            company_id: z.string(),
                        }),
                    },
                },
            },
            "401": {
                description: "Authentication required",
            },
        },
    };

    async handle(c: AppContext) {
        return {
            success: true,
            user_id: c.get("userId"),
            company_id: c.get("companyId"),
        };
    }
}