/**
 * src/database.ts
 *
 * controls the sqlite database and all interactions with it
 * 
 * hold posts and project data to be display and edited by the cms
 *
 * by alex prosser
 * 9/15/2025
 */

import { Database } from '@db/sqlite';
import { existsSync } from '@std/fs';
import { ChannelFilter, M3UChannel, M3UMovie, M3USeries, M3USettings } from '../types.ts';

/**
 * global database reference (essentially a singleton)
 */
let database: Database | null = null;

/**
 * allow queries to be cached so we don't have to keep reading them from files
 */
const queryCache: { [key: string]: string } = {};

/**
 * gets an instance of the database and initializes the tables if needed
 * 
 * @returns an initialized database
 */
const getDatabase = (): Database => {
    if (database !== null) return database;

    // create directory for the database if needed
    if (!existsSync('./data/data.db')) {
        if (!existsSync('./data')) Deno.mkdirSync('./data');
        database = new Database('./data/data.db');

        // initialize database if needed
        executeSqlFile('./src/database/sql/init-tables.sql');
    } else {
        database = new Database('./data/data.db');
    }

    database.exec('PRAGMA journal_mode = WAL;');
    database.exec('PRAGMA synchronous = NORMAL;');

    return database;
};

/**
 * executes a sql file on the database
 * 
 * used only for creates/inserts/updates
 * 
 * @param file path to the sql file
 * @param args all arguments needed for sql
 */
const executeSqlFile = (file: string, args?: { [key: string]: string | number }): number => {
    const database = getDatabase(); 

    // cache the query to prevent file i/o from being taken up
    if (queryCache[file] === undefined) queryCache[file] = Deno.readTextFileSync(file);
    const sqlFile = queryCache[file];

    let affected: number;
    if (args === undefined) affected = database.exec(sqlFile);
    else affected = database.exec(sqlFile, args);

    return affected;
};

/**
 * run a select using a sql file on the database
 * 
 * used only for selects
 * 
 * @param file path to the sql file
 */
const selectSqlFile = (file: string) => {
    const database = getDatabase();

    // cache the query to prevent file i/o from being taken up
    if (queryCache[file] === undefined) queryCache[file] = Deno.readTextFileSync(file);
    const sqlFile = queryCache[file];

    return database.prepare(sqlFile);
};

/**
 * updates the m3u link in the database
 * 
 * @param url updated url
 */
const updateSettings = (url: string, channelsSavePath: string, moviesSavePath: string, seriesSavePath: string) => {
    const timestamp = new Date().toISOString();

    executeSqlFile('./src/database/sql/settings/update-settings.sql', { url, timestamp, channelsSavePath, moviesSavePath, seriesSavePath });
};

/**
 * gets the m3u link from the database
 * 
 * @returns the link from the database
 */
const getSettings = (): M3USettings => {
    const response = selectSqlFile('./src/database/sql/settings/get-settings.sql').get<{ URL: string, LAST_FETCHED: string, CHANNELS_SAVE_PATH: string, MOVIES_SAVE_PATH: string, SERIES_SAVE_PATH: string }>()!;
    return {
        url: response.URL,
        lastFetched: response.LAST_FETCHED,
        channelsSavePath: response.CHANNELS_SAVE_PATH,
        moviesSavePath: response.MOVIES_SAVE_PATH,
        seriesSavePath: response.SERIES_SAVE_PATH
    };
};

/**
 * checks if channel exists already, if so updates, if not creates
 * 
 * @param channel m3u channel data
 */
const upsertChannel = (channel: M3UChannel) => {
    const affected = executeSqlFile('./src/database/sql/channel/update-channel.sql', { ...channel });

    // if no items were affected, add entry to database
    if (affected === 0) {
        executeSqlFile('./src/database/sql/channel/insert-channel.sql', { ...channel });
    }
};

/**
 * gets channel based on id
 * 
 * @param id channel id
 */
const getChannels = (page: number, pageSize: number): M3UChannel[] => {
    const response = selectSqlFile('./src/database/sql/channel/get-channels.sql').all<{ CHANNEL_ID: string, XUI_ID: string, TVG_ID: string, TVG_NAME: string, TVG_LOGO: string, GROUP_TITLE: string, NAME: string, URL: string }>({ pageSize, offset: page * pageSize });
    const result: M3UChannel[] = [];
    for (const channel of response) {
        result.push({
            id: channel.CHANNEL_ID,
            xuiId: channel.XUI_ID,
            tvgId: channel.TVG_ID,
            tvgName: channel.TVG_NAME,
            tvgLogo: channel.TVG_LOGO,
            groupTitle: channel.GROUP_TITLE,
            name: channel.NAME,
            url: channel.URL
        });
    }

    return result;
};

/**
 * counts total amount of channels in database
 * 
 * @param id movie id
 */
const countChannels = (): number => {
    const response = selectSqlFile('./src/database/sql/channel/count-channels.sql').get<{ TOTAL: number }>()!;
    return response?.TOTAL;
};

/**
 * gets all the filters from the database 
 * 
 * @returns all filters in database
 */
const getFilters = () => {
    const response = selectSqlFile('./src/database/sql/filters/get-filters.sql').all<{ FILTER_ID: number, FILTER_TEXT: string, FILTER_TYPE: string }>();
    const result: ChannelFilter[] = [];
    for (const filter of response) {
        result.push({
            filterId: filter.FILTER_ID,
            filterText: filter.FILTER_TEXT,
            filterType: filter.FILTER_TYPE,
        });
    }

    return result;
};

/**
 * inserts a new filter into the database 
 * 
 * @param text filtered text
 * @param type type of filtering
 */
const insertFilter = (text: string, type: string) => {
    executeSqlFile('./src/database/sql/filters/insert-filter.sql', { filterText: text, filterType: type });
};

/**
 * removes a filter from the database 
 * 
 * @param id id of the filter
 */
const removeFilter = (id: number) => {
    executeSqlFile('./src/database/sql/filters/remove-filter.sql', { filterId: id });
};

/**
 * checks if movie exists already, if so updates, if not creates
 * 
 * @param movie m3u movie data
 */
const upsertMovie = (movie: M3UMovie) => {
    const data = {
        id: movie.id,
        xuiId: movie.xuiId,
        tvgId: movie.tvgId,
        tvgName: movie.tvgName,
        tvgLogo: movie.tvgLogo,
        groupTitle: movie.groupTitle,
        name: movie.name,
        url: movie.url
    };

    const affected = executeSqlFile('./src/database/sql/movie/update-movie.sql', data);

    // if no items were affected, add entry to database
    if (affected === 0) {
        executeSqlFile('./src/database/sql/movie/insert-movie.sql', { ...data, fetched: 0 });
    }
};

/**
 * gets all movies based on pagination
 * 
 * @param page current page
 * @param pageSize size of the pages
 */
const getMovies = (search: string, page: number, pageSize: number, fetched: boolean): M3UMovie[] => {
    const sqlFile = fetched ? './src/database/sql/movie/get-fetched-movies.sql' : './src/database/sql/movie/get-movies.sql';
    const response = selectSqlFile(sqlFile).all<{ MOVIE_ID: string, XUI_ID: string, TVG_ID: string, TVG_NAME: string, TVG_LOGO: string, GROUP_TITLE: string, NAME: string, URL: string, FETCHED: number }>({ search, pageSize, offset: page * pageSize });

    const result: M3UMovie[] = [];
    for (const movie of response) {
        result.push({
            id: movie.MOVIE_ID,
            xuiId: movie.XUI_ID,
            tvgId: movie.TVG_ID,
            tvgName: movie.TVG_NAME,
            tvgLogo: movie.TVG_LOGO,
            groupTitle: movie.GROUP_TITLE,
            name: movie.NAME,
            url: movie.URL,
            fetched: movie.FETCHED === 1
        });
    }

    return result;
};

/**
 * counts total amount of movies in database
 * 
 * @param search filter string
 */
const countMovies = (search: string, fetched: boolean): number => {
    const sqlFile = fetched ? './src/database/sql/movie/count-fetched-movies.sql' : './src/database/sql/movie/count-movies.sql';
    const response = selectSqlFile(sqlFile).get<{ TOTAL: number }>({ search })!;
    return response?.TOTAL;
};

/**
 * updates the fetched data on a movie
 * 
 * @param id id of the movie
 * @param fetched update fetched status
 */
const updateMovieFetched = (id: string, fetched: boolean) => {
    executeSqlFile('./src/database/sql/movie/update-movie-fetch.sql', { id, fetched: fetched ? '1' : '0' });
}

/**
 * checks if series exists already, if so updates, if not creates
 * 
 * @param series m3u series data
 */
const upsertSeries = (series: M3USeries) => {
    const data = {
        id: series.id,
        xuiId: series.xuiId,
        tvgId: series.tvgId,
        tvgName: series.tvgName,
        tvgLogo: series.tvgLogo,
        groupTitle: series.groupTitle,
        name: series.name,
        url: series.url,
        season: series.season.toString(),
        episode: series.episode.toString()
    };

    const affected = executeSqlFile('./src/database/sql/series/update-series.sql', data);

    // if no items were affected, add entry to database
    if (affected === 0) {
        executeSqlFile('./src/database/sql/series/insert-series.sql', { ...data, fetched: 0 });
    }
};

/**
 * gets all series based on pagination
 * 
 * @param search filter text
 * @param page current page
 * @param pageSize size of the pages
 * @param fetched gets either all of just the fetched items
 */
const getSeries = (search: string, page: number, pageSize: number, fetched: boolean): M3USeries[] => {
    const sqlFile = fetched ? './src/database/sql/series/get-fetched-series.sql' : './src/database/sql/series/get-series.sql';
    const response = selectSqlFile(sqlFile).all<{ SERIES_ID: string, XUI_ID: string, TVG_ID: string, TVG_NAME: string, TVG_LOGO: string, GROUP_TITLE: string, NAME: string, URL: string, SEASON: number, EPISODE: number, FETCHED: number }>({ search, pageSize, offset: page * pageSize });

    const result: M3USeries[] = [];
    for (const series of response) {
        result.push({
            id: series.SERIES_ID,
            xuiId: series.XUI_ID,
            tvgId: series.TVG_ID,
            tvgName: series.TVG_NAME,
            tvgLogo: series.TVG_LOGO,
            groupTitle: series.GROUP_TITLE,
            name: series.NAME,
            url: series.URL,
            season: series.SEASON,
            episode: series.EPISODE,
            fetched: series.FETCHED === 1
        });
    }

    return result;
};

const getFetchedEpisodes = () => {
    const response = selectSqlFile('./src/database/sql/series/get-fetched-episodes.sql').all<{ SERIES_ID: string, XUI_ID: string, TVG_ID: string, TVG_NAME: string, TVG_LOGO: string, GROUP_TITLE: string, NAME: string, URL: string, SEASON: number, EPISODE: number, FETCHED: number }>();

    const result: M3USeries[] = [];
    for (const series of response) {
        result.push({
            id: series.SERIES_ID,
            xuiId: series.XUI_ID,
            tvgId: series.TVG_ID,
            tvgName: series.TVG_NAME,
            tvgLogo: series.TVG_LOGO,
            groupTitle: series.GROUP_TITLE,
            name: series.NAME,
            url: series.URL,
            season: series.SEASON,
            episode: series.EPISODE,
            fetched: series.FETCHED === 1
        });
    }

    return result;
} 

/**
 * counts total amount of movies in database
 * 
 * @param search filter string
 */
const countSeries = (search: string, fetched: boolean): number => {
    const sqlFile = fetched ? './src/database/sql/series/count-fetched-series.sql' : './src/database/sql/series/count-series.sql';
    const response = selectSqlFile(sqlFile).get<{ TOTAL: number }>({ search })!;
    return response?.TOTAL;
};

/**
 * updates the fetched data on a movie
 * 
 * @param id id of the movie
 * @param fetched update fetched status
 */
const updateSeriesFetched = (groupTitle: string, fetched: boolean) => {
    console.log(groupTitle, fetched);
    executeSqlFile('./src/database/sql/series/update-series-fetch.sql', { groupTitle, fetched: fetched ? '1' : '0' });
}

export {
    updateSettings, getSettings,
    getChannels, upsertChannel, countChannels,
    getFilters, insertFilter, removeFilter,
    getMovies, upsertMovie, countMovies, updateMovieFetched,
    getSeries, getFetchedEpisodes, upsertSeries, countSeries, updateSeriesFetched
};
