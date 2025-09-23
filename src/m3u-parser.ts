import { getM3ULink, updateM3ULink, upsertChannel } from './database/database.ts';
import { getLogger } from "./logger.ts";
import { M3UItem, M3UParsingMessageEventData } from './types.ts';

const logger = getLogger();

class M3UParser {
    url: string;
    nextFetch: Date;
    status = 'waiting on fetch...';

    channels: M3UItem[] = [];
    movies: M3UItem[] = [];
    shows: M3UItem[] = [];

    constructor(url: string) {
        this.url = url;

        this.nextFetch = new Date();
        this.nextFetch.setDate(this.nextFetch.getDate() + 1);
        this.nextFetch.setHours(2, 30, 0, 0);
    }

    /**
     * updates the url and the fetch cycle
     * 
     * throws error if unsuccessful
     * 
     * @param url updated url
     */
    updateURL(url: string) {
        updateM3ULink(url);

        this.url = url;

        // set next fetch to the next day at 2:30 am
        this.nextFetch = new Date();
        this.nextFetch.setDate(this.nextFetch.getDate() + 1);
        this.nextFetch.setHours(2, 30, 0, 0);

        // set status to waiting on fetch
        this.status = 'waiting on fetch...';

        // try to fetch
        this.parseM3UFile();
    }

    /**
     * creates a worker that parses the file in the background
     * 
     * parses the m3u file from the url and creates/updates data if needed
     * 
     * throws error if unsuccessful
     */
    parseM3UFile() {
        // run parsing in the background
        const worker = new Worker(new URL('./workers/m3u-parser.ts', import.meta.url).href, { type: 'module', deno: { permissions: 'inherit' } });

        worker.onmessage = event => {
            const data = event.data as M3UParsingMessageEventData;

            if (!data.success) {
                logger.error(`failed parsing file - ${event.data.error}`);
            } else if (data.done) {
                this.loadData(data);
                worker.terminate();
            } else {
                this.status = data.status!;
            }
        };

        worker.onerror = err => {
            logger.error(`crashed while parsing file - ${err.message}`);
            worker.terminate();
        };

        worker.postMessage({ url: this.url });
    }

    loadData(data: M3UParsingMessageEventData)  {
        this.channels = data.channels!;
        this.movies = data.movies!;
        this.shows = data.shows!;

        logger.info(`M3UParser.loadData - uploading channels to database...`);

        for (const channel of this.channels) {
            upsertChannel(channel);
        }

        logger.info('M3UParser.loadData - uploaded channels to database!');

        logger.info(`M3UParser.loadData - uploading movies to database...`);

        for (const channel of this.channels) {
            upsertChannel(channel);
        }

        logger.info('M3UParser.loadData - uploaded movies to database!');

        logger.info(`M3UParser.loadData - uploading shows to database...`);

        for (const channel of this.channels) {
            upsertChannel(channel);
        }

        logger.info('M3UParser.loadData - uploaded shows to database!');

        this.status = `finished parsing m3u file!`;
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

    const url = getM3ULink();

    parser = new M3UParser(url);
    return parser;
}

export { getParser };