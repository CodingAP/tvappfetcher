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
import { M3UChannel, M3UMovie, M3USeries } from '../types.ts';

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
        Deno.mkdirSync('./data');
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
const executeSqlFile = (file: string, args?: { [key: string]: string }): number => {
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
const updateM3ULink = (url: string) => {
    const timestamp = new Date().toISOString();

    executeSqlFile('./src/database/sql/m3u/update-m3u.sql', { url, timestamp });
};

/**
 * gets the m3u link from the database
 * 
 * @returns the link from the database
 */
const getM3ULink = (): string => {
    const response = selectSqlFile('./src/database/sql/m3u/get-m3u.sql').get<{ URL: string, LAST_FETCHED: string }>()!;
    return response.URL;
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

const getChannel = (id: string): M3UChannel => {
    const response = selectSqlFile('./src/database/sql/channel/get-channel.sql').get({ id }) as Record<string, string>;
    return {
        id: response['CHANNEL_ID'],
        xuiId: response['XUI_ID'],
        tvgId: response['TVG_ID'],
        tvgName: response['TVG_NAME'],
        tvgLogo: response['TVG_LOGO'],
        groupTitle: response['GROUP_TITLE'],
        name: response['NAME'],
        url: response['URL']
    };
}

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
        url: movie.url,
        fetched: movie.fetched ? '1' : '0'
    };

    const affected = executeSqlFile('./src/database/sql/movie/update-movie.sql', data);

    // if no items were affected, add entry to database
    if (affected === 0) {
        executeSqlFile('./src/database/sql/movie/insert-movie.sql', data);
    }
};

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
        episode: series.episode.toString(),
        fetched: series.fetched ? '1' : '0'
    };

    const affected = executeSqlFile('./src/database/sql/series/update-series.sql', data);

    // if no items were affected, add entry to database
    if (affected === 0) {
        executeSqlFile('./src/database/sql/series/insert-series.sql', data);
    }
};

export {
    updateM3ULink, getM3ULink,
    getChannel, upsertChannel,
    upsertMovie, upsertSeries
};
