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
import { M3UItem } from "../types.ts";

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

    executeSqlFile('./src/database/sql/update-m3u.sql', { url, timestamp });
};

/**
 * gets the m3u link from the database
 * 
 * @returns the link from the database
 */
const getM3ULink = (): string => {
    const response = selectSqlFile('./src/database/sql/get-m3u.sql').get() as Record<string, string>;
    return response['URL'];
};

/**
 * checks if channel exists already, if so updates, if not creates
 */
const upsertChannel = (item: M3UItem) => {
    const affected = executeSqlFile('./src/database/sql/update-channel.sql', { ...item });

    // if no items were affected, add entry to database
    if (affected === 0) {
        executeSqlFile('./src/database/sql/insert-channel.sql', { ...item });
    }
}

export {
    updateM3ULink, getM3ULink,
    upsertChannel
};
