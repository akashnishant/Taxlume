import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

export class HealthCheck extends OpenAPIRoute {
    schema = {
        tags: ["System"],
        summary: "Check API and database health",
        responses: {
            "200": {
                description: "API and database are healthy",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                            database: z.string(),
                        }),
                    },
                },
            },
            "500": {
                description: "Database connection failed",
            },
        },
    };

    async handle(c: AppContext) {
        try {
            const result = await c.env.DB
                .prepare("SELECT 1 AS ok")
                .first<{ ok: number }>();

            if (result?.ok !== 1) {
                return c.json(
                    {
                        success: false,
                        message: "Database health check failed",
                        database: "unhealthy",
                    },
                    500,
                );
            }

            return {
                success: true,
                message: "BillDesk API is running",
                database: "connected",
            };
        } catch (error) {
            console.error("Database health check failed:", error);

            return c.json(
                {
                    success: false,
                    message: "Database connection failed",
                    database: "unhealthy",
                },
                500,
            );
        }
    }
}