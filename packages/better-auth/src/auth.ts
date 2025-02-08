import { getEndpoints, router } from "./api";
import { init } from "./init";
import type { BetterAuthOptions } from "./types/options";
import type {
	InferPluginErrorCodes,
	InferPluginTypes,
	InferSession,
	InferUser,
	PrettifyDeep,
	Expand,
} from "./types";
import { getBaseURL } from "./utils/url";
import type { FilterActions, InferAPI } from "./types";
import { BASE_ERROR_CODES } from "./error/codes";

export type WithJsDoc<T, D> = Expand<T & D>;

export const betterAuth = <O extends BetterAuthOptions>(options: O) => {
	const errorCodes = options.plugins?.reduce((acc, plugin) => {
		if (plugin.$ERROR_CODES) {
			return { ...acc, ...plugin.$ERROR_CODES };
		}
		return acc;
	}, {});
	return {
		handler: async (request: Request) => {
			const ctx = await init(options as O);
			const basePath = ctx.options.basePath || "/api/auth";
			const url = new URL(request.url);
			if (!ctx.options.baseURL) {
				const baseURL =
					getBaseURL(undefined, basePath) || `${url.origin}${basePath}`;
				ctx.options.baseURL = baseURL;
				ctx.baseURL = baseURL;
			}
			ctx.trustedOrigins = [
				...(options.trustedOrigins || []),
				ctx.baseURL,
				url.origin,
			];
			return router(ctx, options).handler(request);
		},
		api: new Proxy(
			{},
			{
				get(_, key: string) {
					return async (args?: any) => {
						const ctx = await init(options as O);
						const { api } = getEndpoints(ctx, options);
						// @ts-ignore
						const endpoint = api[key];
						if (!endpoint) throw new Error(`Endpoint ${key} not found`);
						return endpoint(args);
					};
				},
			},
		) as InferAPI<any>,
		options: options as O,
		$Infer: {} as {
			Session: {
				session: PrettifyDeep<InferSession<O>>;
				user: PrettifyDeep<InferUser<O>>;
			};
		} & InferPluginTypes<O>,
		$ERROR_CODES: {
			...errorCodes,
			...BASE_ERROR_CODES,
		} as InferPluginErrorCodes<O> & typeof BASE_ERROR_CODES,
	};
};

export type Auth = {
	handler: (request: Request) => Promise<Response>;
	api: FilterActions<ReturnType<typeof router>["endpoints"]>;
	options: BetterAuthOptions;
	$ERROR_CODES: typeof BASE_ERROR_CODES;
};
