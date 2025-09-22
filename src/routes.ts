import { type Route } from '@std/http/unstable-route';

const defaultHeaders = new Headers();
defaultHeaders.append('Content-Type', 'text/html');

const routes: Route[] = [
    {
        pattern: new URLPattern({ pathname: '/' }),
        handler: async () => {
            const html = await Deno.readTextFile('./views/index.html');
            return new Response(html, { status: 200, headers: defaultHeaders });
        },
    },
];

export default routes;