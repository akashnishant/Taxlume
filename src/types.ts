import type { Context } from "hono";

declare module "hono" {
	interface ContextVariableMap {
		userId: string;
		companyId: string;
	}
}

export type AppContext = Context<{
	Bindings: Env;
}>;