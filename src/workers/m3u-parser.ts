/// <reference lib="webworker" />

import type { M3UItem, M3UChannel, M3UMovie, M3USeries } from '../types.ts';
import { getSettings, upsertChannel, upsertMovie, upsertSeries } from "../database/database.ts";

const parseM3UFile = async (url: string) => {
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
            const displayName = nameMatch ? nameMatch[1].trim() : 'no title';

            self.postMessage({
                success: true,
                done: false,
                status: `parsing item ${(i - 1) / 2}/${total} (${displayName})...`,
            });

            const item: M3UItem = {
                id: '',
                xuiId: attributes['xui-id'],
                tvgId: attributes['tvg-id'],
                tvgName: attributes['tvg-name'] || displayName,
                tvgLogo: attributes['tvg-logo'],
                groupTitle: attributes['group-title'],
                name: displayName,
                url,
            };

            if (url.includes('movie')) {
                const movie = item as M3UMovie;
                movie.id = getID(displayName, 'movie');
                movie.fetched = false;
                upsertMovie(movie);
            } else if (url.includes('series')) {
                const series = item as M3USeries;
                const episodeData = getEpisodeData(displayName);
                series.id = getID(displayName, 'series');
                series.groupTitle = episodeData.series;
                series.season = episodeData.season;
                series.episode = episodeData.episode;
                series.fetched = false;
                upsertSeries(series);
            } else {
                const channel = item as M3UChannel;
                channel.id = getID(displayName, 'channel');
                upsertChannel(channel);
            }
            i++;
        }
    }
};

/**
 * create an identifier that removes things like special characters and one-time show names 
 * 
 * @param displayName raw display name 
 * @param type type of m3u item
 * @returns unique identifier
 */
const getID = (displayName: string, type: string): string => {
    let result = displayName.toLowerCase().trim();

    // remove anything past a colon except for some channels that need it for formatting
    const antiColon = ['SPFL', '24/7', 'XXX'];
    if (!antiColon.some(channel => displayName.startsWith(channel)) && type === 'channel') {
        result = result.split(/[:]/g)[0];
    }

    result = result.replace(/[|()\[\]:,.]/g, ''); // remove unwanted characters
    result = result.replace(/\s+/g, '-'); // normalize spaces and make them dashes
    result = result.replace(/\-+/g, '-'); // normalize multiple dashes
    result = result.replace(/[^\x00-\x7F]/g, ''); // remove non-ascii characters

    return result.trim();
};

/**
 * extracts the series name, season, and episode
 * 
 * @param displayName display name with season/episode
 * @return season and episode
 */
const getEpisodeData = (displayName: string): { series: string, season: number, episode: number } => {
    const nameSeasonEpisode = displayName.match(/(.+) S(\d+) E(\d+)/);
    if (nameSeasonEpisode) {
        const [_, series, season, episode] = [...nameSeasonEpisode];
        return { series, season: parseInt(season), episode: parseInt(episode) };
    }

    const seasonEpisode = displayName.match(/S(\d+) E(\d+)/);
    if (seasonEpisode) {
        const [_, season, episode] = [...seasonEpisode];
        return { series: '', season: parseInt(season), episode: parseInt(episode) };
    }

    return { series: 'error', season: 0, episode: 0 };
};

try {
    await parseM3UFile(getSettings().url);

    self.postMessage({
        success: true,
        done: true,
        status: 'finished parsing m3u file!'
    });
} catch (err) {
    self.postMessage({ success: false, error: (err instanceof Error) ? err.message : String(err) });
}