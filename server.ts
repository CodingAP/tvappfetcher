import { serveDir } from '@std/http/file-server';
import { route, type Route } from '@std/http/unstable-route';
import { getLogger } from './src/logger.ts';
import { getNotFoundResponse } from './src/middleware.ts';
import API_ROUTES from './src/api.ts';
import MAIN_ROUTES from './src/routes.ts';

const routers: Route[] = [
    ...MAIN_ROUTES,
    ...API_ROUTES,
    {
        pattern: new URLPattern({ pathname: '/static/*' }),
        handler: (request) => serveDir(request, { quiet: true })
    }
];

const PORT = Deno.env.get('SERVER_PORT') || '1338';
const logger = getLogger();

Deno.serve({
    port: parseInt(PORT),
    handler: route(routers, getNotFoundResponse),
    onListen: ({ port, hostname }) => {
        logger.info(`Deno.serve - Started https://tv.codingap.dev on http://${hostname}:${port}`)
    }
});