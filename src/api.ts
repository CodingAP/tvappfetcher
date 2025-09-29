import { crypto } from '@std/crypto';
import { encodeHex } from '@std/encoding/hex';
import { setCookie } from '@std/http/cookie';
import { type Route } from '@std/http/unstable-route';
import { getLogger } from './logger.ts';
import { getParser } from './m3u-parser.ts';
import { authenticated, encrypt } from './middleware.ts';
import { CreateFilterRequestBody, DeleteFilterRequestBody, FetchItemRequestBody, LoginRequestBody, M3UChannel, PaginatorSearchRequestBody, SettingsUpdateBody } from './types.ts';
import { countChannels, countMovies, countSeries, getChannels, getFilters, getMovies, getSeries, getSettings, insertFilter, removeFilter, updateMovieFetched, updateSeriesFetched, updateSettings } from "./database/database.ts";

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
                console.log(encodeHex(hashBuffer));
                if (Deno.env.get('HASH') === encodeHex(hashBuffer)) {
                    const cookie = await encrypt(JSON.stringify({ timestamp: new Date().toISOString(), id: 'codingap' }));
                    const headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    setCookie(headers, { name: 'session', value: cookie, path: '/', sameSite: 'Lax' });

                    logger.info('GET /api/login - successful log-in!');
                    return new Response(JSON.stringify({ message: 'success!' }), { status: 200, headers });
                } else {
                    logger.warn('GET /api/login - unsuccessful log-in!');      
                    return new Response(JSON.stringify({ message: 'incorrect password!' }), { status: 400, headers: defaultHeaders });
                }
            }

            logger.warn('GET /api/login - unsuccessful log-in!');
            return new Response(JSON.stringify({ message: 'failed to login!' }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['GET', 'POST'],
        pattern: new URLPattern({ pathname: '/api/settings' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            // get the url in the parser
            if (request.method === 'GET') {
                return new Response(JSON.stringify(getSettings()), { status: 200, headers: defaultHeaders });
            }

            // must be a POST, try to update the url
            if (request.headers.get('Content-Type') === 'application/json') {
                const body = (await request.json()) as SettingsUpdateBody;
    
                // check for a valid url
                if (body.url === undefined) {
                    logger.warn('POST /api/settings - failed to update settings (missing the url)!');      
                    return new Response(JSON.stringify({ message: 'missing the url!' }), { status: 401, headers: defaultHeaders });
                }

                // check for a valid channelsSavePath
                if (body.channelsSavePath === undefined) {
                    logger.warn('POST /api/settings - failed to update settings (missing the channelsSavePath)!');      
                    return new Response(JSON.stringify({ message: 'missing the channelsSavePath!' }), { status: 401, headers: defaultHeaders });
                }

                // check for a valid moviesSavePath
                if (body.moviesSavePath === undefined) {
                    logger.warn('POST /api/settings - failed to update settings (missing the moviesSavePath)!');      
                    return new Response(JSON.stringify({ message: 'missing the moviesSavePath!' }), { status: 401, headers: defaultHeaders });
                }

                // check for a valid seriesSavePath
                if (body.seriesSavePath === undefined) {
                    logger.warn('POST /api/settings - failed to update settings (missing the seriesSavePath)!');      
                    return new Response(JSON.stringify({ message: 'missing the seriesSavePath!' }), { status: 401, headers: defaultHeaders });
                }

                updateSettings(body.url, body.channelsSavePath, body.moviesSavePath, body.seriesSavePath);
                parser.updateURL(body.url);

                // show that url was successfully accepted
                logger.info('POST /api/settings - successfully updated settings!');
                return new Response(JSON.stringify({ message: 'successfully updated settings!' }), { status: 202, headers: defaultHeaders });
            }

            logger.warn('POST /api/settings - failed to update m3u link!');
            return new Response(JSON.stringify({ message: 'failed to update settings!' }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['GET'],
        pattern: new URLPattern({ pathname: '/api/fetch' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            logger.info('GET /api/fetch - starting parsing m3u file!');
            parser.parseM3UFile();
            return new Response(JSON.stringify({ message: 'successfully started parsing!' }), { status: 202, headers: defaultHeaders });
        }
    },
    {
        method: ['GET'],
        pattern: new URLPattern({ pathname: '/api/create' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            logger.info('GET /api/fetch - starting creating files!');
            parser.createFiles();
            return new Response(JSON.stringify({ message: 'successfully started creating!' }), { status: 202, headers: defaultHeaders });
        }
    },
    {
        method: ['GET'],
        pattern: new URLPattern({ pathname: '/api/next-fetch' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            return new Response(JSON.stringify({ time: parser.nextFetch.toLocaleString() }), { status: 200, headers: defaultHeaders });
        }
    },
    {
        method: ['GET'],
        pattern: new URLPattern({ pathname: '/api/status' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            logger.info(`GET /api/status - ${parser.status}`);
            return new Response(JSON.stringify({ status: parser.status }), { status: 200, headers: defaultHeaders });
        }
    },
    {
        method: ['POST'],
        pattern: new URLPattern({ pathname: '/api/movie/search' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            // must be a POST, try to get all movies currently loaded
            if (parser.isParsing || parser.isCreating) {
                logger.warn('POST /api/movie/search - failed to get movies (still parsing/creating files!)');
                return new Response(JSON.stringify({ message: 'currently parsing/creating files! please wait...' }), { status: 401, headers: defaultHeaders });
            }

            if (request.headers.get('Content-Type') === 'application/json') {
                const body = (await request.json()) as PaginatorSearchRequestBody;
    
                const search = body.search || '';
                const totalMovies = countMovies(search, body.fetched);
                let page = body.page || 0;
                const pageSize = body.pageSize || totalMovies;

                if (page * pageSize > totalMovies) page = 0;

                const movies = getMovies(search, page, pageSize, body.fetched);

                // return the list of movies as well as the total amount of movies
                logger.info(`POST /api/movie/search - successfully obtained ${movies.length} movies!`);
                return new Response(JSON.stringify({ movies, total: totalMovies }), { status: 200, headers: defaultHeaders });
            }

            logger.warn('POST /api/movie/search - failed to get movies!');
            return new Response(JSON.stringify({ message: 'failed to get movies!' }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['PUT'],
        pattern: new URLPattern({ pathname: '/api/movie/fetch' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            // must be a POST, try to get all movies currently loaded
            if (parser.isParsing || parser.isCreating) {
                logger.warn('POST /api/movie/fetch - failed to get movies (still parsing/creating files!)');
                return new Response(JSON.stringify({ message: 'currently parsing/creating files! please wait...' }), { status: 401, headers: defaultHeaders });
            }

            if (request.headers.get('Content-Type') === 'application/json') {
                const body = (await request.json()) as FetchItemRequestBody;
    
                if (body.id === undefined) {
                    logger.warn('PUT /api/movie/fetch - failed to update the movie (missing the id)!');      
                    return new Response(JSON.stringify({ message: 'missing the id!' }), { status: 401, headers: defaultHeaders });
                }

                if (body.fetched === undefined) {
                    logger.warn('PUT /api/movie/fetch - failed to update the movie (missing the fetched status)!');      
                    return new Response(JSON.stringify({ message: 'missing the fetched status!' }), { status: 401, headers: defaultHeaders });
                }
                
                updateMovieFetched(body.id, body.fetched);

                // return a successful attempt after updating
                logger.info(`PUT /api/movie/fetch - successfully updated movie (${body.id})!`);
                return new Response(JSON.stringify({ message: 'successfully updated movie!' }), { status: 200, headers: defaultHeaders });
            }

            logger.warn('PUT /api/movie/fetch - failed to update movie!');
            return new Response(JSON.stringify({ message: 'failed to update movie!' }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['POST'],
        pattern: new URLPattern({ pathname: '/api/series/search' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            // must be a POST, try to get all series currently loaded
            if (parser.isParsing || parser.isCreating) {
                logger.warn('POST /api/movie/search - failed to get series (still parsing/creating files!)');
                return new Response(JSON.stringify({ message: 'currently parsing/creating files! please wait...' }), { status: 401, headers: defaultHeaders });
            }

            if (request.headers.get('Content-Type') === 'application/json') {
                const body = (await request.json()) as PaginatorSearchRequestBody;
    
                const search = body.search || '';
                const totalSeries = countSeries(search, body.fetched);
                let page = body.page || 0;
                const pageSize = body.pageSize || totalSeries;

                if (page * pageSize > totalSeries) page = 0;

                const series = getSeries(search, page, pageSize, body.fetched);

                // return the list of series as well as the total amount of series
                logger.info(`POST /api/series/search - successfully obtained ${series.length} series!`);
                return new Response(JSON.stringify({ series, total: totalSeries }), { status: 200, headers: defaultHeaders });
            }

            logger.warn('POST /api/series/search - failed to get series!');
            return new Response(JSON.stringify({ message: 'failed to get series!' }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['PUT'],
        pattern: new URLPattern({ pathname: '/api/series/fetch' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            // must be a POST, try to get all movies currently loaded
            if (parser.isParsing || parser.isCreating) {
                logger.warn('POST /api/series/fetch - failed to get series (still parsing/creating files!)');
                return new Response(JSON.stringify({ message: 'currently parsing/creating files! please wait...' }), { status: 401, headers: defaultHeaders });
            }

            if (request.headers.get('Content-Type') === 'application/json') {
                const body = (await request.json()) as FetchItemRequestBody;
    
                if (body.id === undefined) {
                    logger.warn('PUT /api/series/fetch - failed to update the movie (missing the id)!');      
                    return new Response(JSON.stringify({ message: 'missing the id!' }), { status: 401, headers: defaultHeaders });
                }

                if (body.fetched === undefined) {
                    logger.warn('PUT /api/series/fetch - failed to update the series (missing the fetched status)!');      
                    return new Response(JSON.stringify({ message: 'missing the fetched status!' }), { status: 401, headers: defaultHeaders });
                }
                
                updateSeriesFetched(body.id, body.fetched);

                // return a successful attempt after updating
                logger.info(`PUT /api/series/fetch - successfully updated series (${body.id})!`);
                return new Response(JSON.stringify({ message: 'successfully updated series!' }), { status: 200, headers: defaultHeaders });
            }

            logger.warn('PUT /api/series/fetch - failed to update series!');
            return new Response(JSON.stringify({ message: 'failed to update series!' }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['POST'],
        pattern: new URLPattern({ pathname: '/api/channel/search' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            // try to get all channels currently loaded
            if (parser.isParsing || parser.isCreating) {
                logger.warn(`POST /api/channel/search - failed to get channels (still parsing/creating files!)`);
                return new Response(JSON.stringify({ message: 'currently parsing/creating files! please wait...' }), { status: 401, headers: defaultHeaders });
            }

            if (request.headers.get('Content-Type') === 'application/json') {
                const body = (await request.json()) as PaginatorSearchRequestBody;
    
                const total = countChannels();
                let page = body.page || 0;
                const pageSize = body.pageSize || total;

                if (page * pageSize > total) page = 0;

                const channels = getChannels(page, pageSize);

                // return the list of series as well as the total amount of series
                logger.info(`POST /api/channel/search - successfully obtained ${channels.length} channels!`);
                return new Response(JSON.stringify({ channels, total }), { status: 200, headers: defaultHeaders });
            }

            logger.warn('POST /api/channel/search - failed to get channels!');
            return new Response(JSON.stringify({ message: 'failed to get channels!' }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['POST'],
        pattern: new URLPattern({ pathname: '/api/channel/search-filtered' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }

            // try to get all channels currently loaded
            if (parser.isParsing || parser.isCreating) {
                logger.warn(`POST /api/channel/search-filtered - failed to get filtered channels (still parsing/creating files!)`);
                return new Response(JSON.stringify({ message: 'currently parsing/creating files! please wait...' }), { status: 401, headers: defaultHeaders });
            }

            if (request.headers.get('Content-Type') === 'application/json') {
                const body = (await request.json()) as PaginatorSearchRequestBody;
    
                const allChannels = getChannels(0, countChannels());
                const filters = getFilters();
                const filteredChannels: M3UChannel[] = [];

                // we have to separately check not includes as we don't want anything in those to be there
                for (let j = 0; j < allChannels.length; j++) {
                    let notIncludes = true, result = false;
                    for (let i = 0; i < filters.length; i++) {
                        if (filters[i].filterType === 'not-includes' && allChannels[j].name.includes(filters[i].filterText)) {
                            notIncludes = false;
                        }

                        if (filters[i].filterType === 'starts-with' && allChannels[j].name.startsWith(filters[i].filterText)) {
                            result = true;
                        }

                        if (filters[i].filterType === 'includes' && allChannels[j].name.includes(filters[i].filterText)) {
                            result = true;
                        }
                    }

                    if ((notIncludes && result )|| filters.length === 0) {
                        filteredChannels.push(allChannels[j]);
                    }
                }

                const total = filteredChannels.length;
                let page = body.page || 0;
                const pageSize = body.pageSize || total;

                if (page * pageSize > total) page = 0;

                const slicefilteredChannels = filteredChannels.slice(page * pageSize, (page + 1) * pageSize);

                // return the list of series as well as the total amount of series
                logger.info(`POST /api/channel/search-filtered - successfully obtained ${slicefilteredChannels.length} filtered channels!`);
                return new Response(JSON.stringify({ channels: slicefilteredChannels, total }), { status: 200, headers: defaultHeaders });
            }

            logger.warn('POST /api/channel/search-filtered - failed to get filtered channels!');
            return new Response(JSON.stringify({ message: 'failed to get filtered channels!' }), { status: 400, headers: defaultHeaders });
        }
    },
    {
        method: ['GET', 'POST', 'DELETE'],
        pattern: new URLPattern({ pathname: '/api/filter' }),
        handler: async (request) => {
            // only allow authenticated requests
            if (!(await authenticated(request))) {
                return new Response(JSON.stringify({ message: 'unauthenticated/forbidden!' }), { status: 403, headers: defaultHeaders });
            }
            
            // must be a POST, try to get all movies currently loaded
            if (parser.isParsing || parser.isCreating) {
                logger.warn(`${request.method} /api/filter - failed to modify a filter (still parsing/creating files!)`);
                return new Response(JSON.stringify({ message: 'currently parsing/creating files! please wait...' }), { status: 401, headers: defaultHeaders });
            }

            // get all filters
            if (request.method === 'GET') {
                const filters = getFilters();
                return new Response(JSON.stringify({ filters, total: filters.length }), { status: 200, headers: defaultHeaders });
            } else if (request.method === 'DELETE') {
                // delete specific filters
                if (request.headers.get('Content-Type') === 'application/json') {
                    const body = (await request.json()) as DeleteFilterRequestBody;
        
                    if (body.id === undefined) {
                        logger.warn('DELETE /api/filter - failed to delete the filter (missing the id)!');      
                        return new Response(JSON.stringify({ message: 'missing the id!' }), { status: 401, headers: defaultHeaders });
                    }
                    
                    removeFilter(body.id);

                    // return a successful attempt after deleting
                    logger.info(`DELETE /api/filter - successfully deleted filter!`);
                    return new Response(JSON.stringify({ message: 'successfully deleted filter!' }), { status: 200, headers: defaultHeaders });
                }
            } else if (request.method === 'POST') {
                // create a new filter
                if (request.headers.get('Content-Type') === 'application/json') {
                    const body = (await request.json()) as CreateFilterRequestBody;
        
                    if (body.filterText === undefined) {
                        logger.warn('POST /api/filter - failed to insert the filter (missing the text)!');      
                        return new Response(JSON.stringify({ message: 'missing the text!' }), { status: 401, headers: defaultHeaders });
                    }

                    if (body.filterType === undefined) {
                        logger.warn('POST /api/filter - failed to insert the filter (missing the type)!');      
                        return new Response(JSON.stringify({ message: 'missing the type!' }), { status: 401, headers: defaultHeaders });
                    }
                    
                    insertFilter(body.filterText, body.filterType);

                    // return a successful attempt after inserting
                    logger.info(`POST /api/filter - successfully created filter!`);
                    return new Response(JSON.stringify({ message: 'successfully created filter!' }), { status: 200, headers: defaultHeaders });
                }
            }

            logger.warn(`${request.method} /api/filter - failed to modify a filter (still parsing/creating files!)`);
            return new Response(JSON.stringify({ message: 'failed to modify a filter!' }), { status: 400, headers: defaultHeaders });
        }
    },
];

export default routes;