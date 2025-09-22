import { getM3ULink, updateM3ULink } from "./database/database.ts";

class M38Parser {
    url: string;
    nextFetch: Date;

    constructor(url: string) {
        this.url = url;

        this.nextFetch = new Date();
        this.nextFetch.setDate(this.nextFetch.getDate() + 1);
        this.nextFetch.setHours(2, 30, 0, 0);
    }

    /**
     * updates the url and the fetch cycle
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
    }
};

/**
 * parser reference, singleton
 */
let parser: M38Parser | null = null;

/**
 * gets the global parser
 * 
 * @returns instance of the parser
 */
const getParser = (): M38Parser => {
    if (parser !== null) return parser;

    const url = getM3ULink();

    parser = new M38Parser(url);
    return parser;
}

export { getParser };