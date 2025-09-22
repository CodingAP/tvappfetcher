import { type Route } from '@std/http/unstable-route';
import { LoginRequestBody, M3ULinkUpdateBody } from './types.ts';
import { encrypt } from './middleware.ts';
import { setCookie } from '@std/http/cookie';
import { getLogger } from './logger.ts';
import { crypto } from '@std/crypto';
import { encodeHex } from '@std/encoding/hex';
import { getParser } from "./m3u-parser.ts";

const logger = getLogger();
const parser = getParser();

const defaultHeaders = new Headers();
defaultHeaders.append('Content-Type', 'application/json');

const routes: Route[] = [
    {
        method: ['POST'],
        pattern: new URLPattern({ pathname: '/api/login' }),
        handler: async (request) => {
            if (request.headers.get('Content-Type') === 'application/json') {
                const body = (await request.json()) as LoginRequestBody;
    
                // encrypted session token and send to client
                const passwordBuffer = new TextEncoder().encode(body.password + Deno.env.get('SALT'));
                const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBuffer);
                if (Deno.env.get('HASH') === encodeHex(hashBuffer)) {
                    const cookie = await encrypt(JSON.stringify({ timestamp: new Date().toISOString(), id: 'codingap' }));
                    const headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    setCookie(headers, { name: 'session', value: cookie, path: '/', sameSite: 'Lax' });

                    logger.info('GET /api/login - successful log-in!');
                    return new Response(JSON.stringify({ message: 'success!', error: false }), { status: 200, headers });
                } else {
                    logger.warn('GET /api/login - unsuccessful log-in!');      
                    return new Response(JSON.stringify({ message: 'incorrect password!', error: true }), { status: 400, headers: defaultHeaders });
                }
            }

            logger.warn('GET /api/login - unsuccessful log-in!');
            return new Response(JSON.stringify({ message: 'failed to login!', error: true }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['GET', 'POST'],
        pattern: new URLPattern({ pathname: '/api/m3u' }),
        handler: async (request) => {
            // get the url in the parser
            if (request.method === 'GET') {
                return new Response(JSON.stringify({ url: parser.url }), { status: 200, headers: defaultHeaders });
            }

            // must be a POST, try to update the url
            if (request.headers.get('Content-Type') === 'application/json') {
                const body = (await request.json()) as M3ULinkUpdateBody;
    
                // check for a valid url
                if (body.url === undefined) {
                    logger.warn('POST /api/m3u - failed to update m3u link (missing the url)!');      
                    return new Response(JSON.stringify({ message: 'missing the url!', error: true }), { status: 401, headers: defaultHeaders });
                }

                // TODO: check for valid m3u file here
                parser.updateURL(body.url);

                logger.info('POST /api/m3u - successfully updated m3u link!');
                return new Response(JSON.stringify({ message: 'successfully updated m3u link!', error: false }), { status: 200, headers: defaultHeaders });
            }

            logger.warn('POST /api/m3u - failed to update m3u link!');
            return new Response(JSON.stringify({ message: 'failed to update m3u link!', error: true }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['GET'],
        pattern: new URLPattern({ pathname: '/api/next-fetch' }),
        handler: () => {
            return new Response(JSON.stringify({ time: parser.nextFetch.toLocaleString() }), { status: 200, headers: defaultHeaders });
        }
    },
];

export default routes;