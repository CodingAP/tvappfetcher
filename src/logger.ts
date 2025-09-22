/**
 * src/logger.ts
 *
 * a custom logger class with a singleton attached to allow for colorful logs as well as dated file logs
 *
 * by alex prosser
 * 9/15/2025
 */

import { existsSync } from '@std/fs';
import { join, resolve } from '@std/path';

/**
 * logger class that can append to a file and print colorful message in a console
 */
class Logger {
    /**
     * red ansi color code
     */
    static RED = '\x1b[31m';

    /**
     * green ansi color code
     */
    static GREEN = '\x1b[32m';

    /**
     * yellow ansi color code
     */
    static YELLOW = '\x1b[33m';

    /**
     * blue ansi color code
     */
    static BLUE = '\x1b[34m';

    /**
     * default ansi color code
     */
    static DEFAULT = '\x1b[39m';

    /**
     * path of the folder where all the logs are stored
     */
    folderPath: string;

    constructor(folderPath: string) {
        this.folderPath = resolve('./', folderPath);

        // create folder if it doesn't exist
        if (!existsSync(this.folderPath)) Deno.mkdirSync(this.folderPath)
    }
 
    /**
     * logs a message at info level
     * 
     * @param message message to log
     */
    info(message: string) {
        this.consoleLog(`${Logger.GREEN}INFO`, message);
        this.fileLog('INFO', message);
    }

    /**
     * logs a message at warning level
     * 
     * @param message message to log
     */
    warn(message: string) {
        this.consoleLog(`${Logger.YELLOW}WARN`, message);
        this.fileLog('WARN', message);
    }

    /**
     * logs a message at warning level
     * 
     * @param message message to log
     */
    error(message: string) {
        this.consoleLog(`${Logger.RED}ERROR`, message);
        this.fileLog('WARN', message);
    }

    /**
     * logs a message at warning level
     * 
     * @param message message to log
     */
    debug(message: string) {
        this.consoleLog(`${Logger.BLUE}DEBUG`, message);
        this.fileLog('WARN', message);
    }

    /**
     * logs a message to the console, preferable with color
     * 
     * @param message message to log
     */
    private consoleLog(level: string, message: string) {
        // only log to the console if we are in dev
        if (Deno.env.get('ENVIRONMENT') === 'DEV') {
            const timestamp = new Date();
            console.log(`${level}${Logger.DEFAULT} [${timestamp.toLocaleString()}]: ${message}`);
        }
    }

    /**
     * logs a message to a file, with the current date
     * 
     * makes a new file if a new date has been logged
     * 
     * @param message message to log
     */
    private fileLog(level: string, message: string) {
        const timestamp = new Date();
        const result = `${level} [${timestamp.toLocaleString()}]: ${message}\n`;
        const filename = `${timestamp.getFullYear()}-${(timestamp.getMonth() + 1).toString().padStart(2, '0')}-${timestamp.getDate().toString().padStart(2, '0')}.log`;
        Deno.writeTextFileSync(join(this.folderPath, filename), result, { append: true });
    }
};

/**
 * logger reference, singleton
 */
let logger: Logger | null = null;

/**
 * gets the global logger
 * 
 * @returns instance of the logger
 */
const getLogger = (): Logger => {
    if (logger !== null) return logger;

    logger = new Logger('logs');
    return logger;
}

export { getLogger };