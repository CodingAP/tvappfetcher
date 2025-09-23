/// <reference lib="webworker" />

import type { M3UItem } from '../types.ts';

self.onmessage = async (event: MessageEvent) => {
    const { url } = event.data;
    try {
        const { channels, movies, shows } = await parseM38File(url);
        self.postMessage({
            success: true,
            done: true,
            status: 'finished parsing m3u file!',
            channels,
            movies,
            shows,
        });
    } catch (err) {
        self.postMessage({ success: false, error: (err instanceof Error) ? err.message : String(err) });
    }
};

const parseM38File = async (url: string) => {
    self.postMessage({
        success: true,
        done: false,
        status: 'fetching file from url...',
    });
    
    const response = await fetch(url);
    const file = await response.text();

    self.postMessage({
        success: true,
        done: false,
        status: 'starting file parsing...',
    });

    const lines = file.replace(/\r/g, '').split(/\n/);
    if (lines.length === 0) {
        throw new Error('file is empty!');
    } else if (lines[0] !== '#EXTM3U') {
        throw new Error('this is not a valid m3u or m3u8 file!');
    }

    const total = (lines.length - 1) / 2;

    const channels: M3UItem[] = [];
    const movies: M3UItem[] = [];
    const shows: M3UItem[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXTINF')) {
            const url = lines[i + 1] || '';

            const regex = /([\w-]+?)="(.*?)"/g;
            const attributes: Record<string, string> = {};
            let match;
            while ((match = regex.exec(line)) !== null) {
                attributes[match[1]] = match[2];
            }

            const nameMatch = line.match(/",(.*)$/);
            const displayName = nameMatch ? nameMatch[1].trim() : undefined;

            self.postMessage({
                success: true,
                done: false,
                status: `parsing item ${(i - 1) / 2}/${total} (${displayName})...`,
            });

            const item: M3UItem = {
                xuiId: attributes['xui-id'],
                tvgId: attributes['tvg-id'],
                tvgName: attributes['tvg-name'] || displayName,
                tvgLogo: attributes['tvg-logo'],
                groupTitle: attributes['group-title'],
                name: displayName,
                url,
            };

            if (url.includes('movie')) {
                movies.push(item);
            } else if (url.includes('series')) {
                shows.push(item);
            } else {
                item.channelId = createChannelID(displayName!);
                channels.push(item);
            }
            i++;
        }
    }

    return { channels, movies, shows };
};

/**
 * create an identifier that removes things like special characters and one-time show names 
 * 
 * @param displayName raw display name 
 * @returns unique identifier
 */
const createChannelID = (displayName: string) => {
    let result = displayName.toLowerCase().trim();

    // remove anything past a colon except for some channels that need it for formatting
    const antiColon = ['SPFL', '24/7', 'XXX'];
    if (!antiColon.some(channel => displayName.startsWith(channel))) {
        result = result.split(/[:]/g)[0];
    }

    result = result.replace(/[|()\[\]:]/g, ''); // remove unwanted characters
    result = result.replace(/\s+/g, '-'); // normalize spaces and make them dashes
    result = result.replace(/\-+/g, '-'); // normalize multiple dashes
    result = result.replace(/[^\x00-\x7F]/g, ''); // remove non-ascii characters
    return result.trim();
}