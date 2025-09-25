import { getSettings, updateSettings } from './database/database.ts';
import { getLogger } from './logger.ts';
import { M3UParsingMessageEventData } from './types.ts';

const logger = getLogger();

class M3UParser {
    url: string;
    nextFetch: Date;
    status = 'waiting on fetch...';
    isParsing = false;
    isCreating = false;

    constructor(url: string) {
        this.url = url;

        this.nextFetch = new Date();
        this.nextFetch.setDate(this.nextFetch.getDate() + 1);
        this.nextFetch.setHours(2, 30, 0, 0);

        // every five minutes, check for an automated fetch
        setInterval(() => {
            logger.info('M3UParser - checking for an automated fetch...');

            if (new Date().getTime() > this.nextFetch.getTime()) {
                logger.info('M3UParser - it is time for an automated fetch!');
                this.parseM3UFile();
                this.nextFetch = new Date();
                this.nextFetch.setDate(this.nextFetch.getDate() + 1);
                this.nextFetch.setHours(2, 30, 0, 0);
            }
        }, 1000 * 60 * 5);
    }

    /**
     * updates the url and the fetch cycle
     * 
     * throws error if unsuccessful
     * 
     * @param url updated url
     */
    updateURL(url: string) {
        const settings = getSettings();
        updateSettings(url, settings.channelsSavePath, settings.moviesSavePath, settings.seriesSavePath);

        this.url = url;

        // set next fetch to the next day at 2:30 am
        this.nextFetch = new Date();
        this.nextFetch.setDate(this.nextFetch.getDate() + 1);
        this.nextFetch.setHours(2, 30, 0, 0);
    }

    /**
     * creates a worker that parses the file in the background
     * 
     * parses the m3u file from the url and creates/updates data if needed
     * 
     * throws error if unsuccessful
     */
    parseM3UFile() {
        // update last fetch timestamp
        const settings = getSettings();
        updateSettings(settings.url, settings.channelsSavePath, settings.moviesSavePath, settings.seriesSavePath);

        // run parsing in the background
        const worker = new Worker(new URL('./workers/m3u-parser.ts', import.meta.url).href, { type: 'module', deno: { permissions: 'inherit' } });
        this.isParsing = true;

        // set status to waiting on fetch
        this.status = 'waiting on fetch worker...';

        worker.onmessage = event => {
            const data = event.data as M3UParsingMessageEventData;

            if (!data.success) {
                logger.error(`failed parsing file - ${event.data.error}`);
            } else if (data.done) {
                this.isParsing = false;
                worker.terminate();
                logger.info('M3UParser.parseM3UFile - finished parsing and saving m3u file!');
                this.createFiles();
            }
            this.status = data.status;
        };

        worker.onerror = err => {
            logger.error(`crashed while parsing file - ${err.message}`);
            worker.terminate();
        };
    }

    /**
     * after parsing the data, create all needed files for channels, movies, and tv shows
     */
    createFiles() {
        // run creation in the background
        const worker = new Worker(new URL('./workers/m3u-creation.ts', import.meta.url).href, { type: 'module', deno: { permissions: 'inherit' } });
        this.isCreating = true;

        // set status to waiting on fetch
        this.status = 'waiting on creation worker...';

        worker.onmessage = event => {
            const data = event.data as M3UParsingMessageEventData;

            if (!data.success) {
                logger.error(`failed creating file - ${event.data.error}`);
            } else if (data.done) {
                this.isCreating = false;
                worker.terminate();
                logger.info('M3UParser.createFiles - finished creating all files!');
            }
            this.status = data.status;
        };

        worker.onerror = err => {
            logger.error(`crashed while creating file - ${err.message}`);
            worker.terminate();
        };
    }
};

/**
 * parser reference, singleton
 */
let parser: M3UParser | null = null;

/**
 * gets the global parser
 * 
 * @returns instance of the parser
 */
const getParser = (): M3UParser => {
    if (parser !== null) return parser;

    const url = getSettings().url;

    parser = new M3UParser(url);
    return parser;
}

export { getParser };