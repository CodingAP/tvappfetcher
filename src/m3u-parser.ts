import { getM3ULink, updateM3ULink, upsertChannel, upsertMovie, upsertSeries } from './database/database.ts';
import { getLogger } from './logger.ts';
import { M3UChannel, M3UMovie, M3USeries, M3UParsingMessageEventData } from './types.ts';

const logger = getLogger();

class M3UParser {
    url: string;
    nextFetch: Date;
    status = 'waiting on fetch...';

    channels: M3UChannel[] = [];
    movies: M3UMovie[] = [];
    series: M3USeries[] = [];

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
                this.channels = data.channels!;
                this.movies = data.movies!;
                this.series = data.series!;

                worker.terminate();
                logger.info('M3UParser.parseM3UFile - finished parsing and saving m3u file!');
            }
            this.status = data.status;
        };

        worker.onerror = err => {
            logger.error(`crashed while parsing file - ${err.message}`);
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

    const url = getM3ULink();

    parser = new M3UParser(url);
    return parser;
}

export { getParser };