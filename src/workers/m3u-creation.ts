/// <reference lib="webworker" />

import { exists } from '@std/fs';
import { join, resolve } from '@std/path';
import { countChannels, countMovies, getChannels, getFetchedEpisodes, getFilters, getMovies, getSettings } from '../database/database.ts';

const createMovies = async (savePath: string) => {
    const total = countMovies('', true);
    const movies = getMovies('', 0, total, true);

    // remove all content in the path
    const path = resolve(savePath);
    if (await exists(path)) {
        await Deno.remove(path, { recursive: true });
    }
    await Deno.mkdir(path, { recursive: true });

    // create all needed files
    for (const movie of movies) {
        const moviePath = join(path, movie.name.replace(/[/<>:"\|?*]/g, ''));
        if (!(await exists(moviePath))) {
            await Deno.mkdir(moviePath, { recursive: true });
        }
        await Deno.writeTextFile(join(moviePath, 'movie.strm'), movie.url);
        self.postMessage({
            success: true,
            done: false,
            status: `creating file for movie ${movie.name}...!`
        });
    }
};

const createSeries = async (savePath: string) => {
    const episodes = getFetchedEpisodes();

    // remove all content in the path
    const path = resolve(savePath);
    if (await exists(path)) {
        await Deno.remove(path, { recursive: true });
    }
    await Deno.mkdir(path, { recursive: true });

    // create all needed files
    for (const episode of episodes) {
        const episodePath = join(path, episode.groupTitle.replace(/[/<>:"',\|?*]/g, ''), `Season ${episode.season}`);
        if (!(await exists(episodePath))) {
            await Deno.mkdir(episodePath, { recursive: true });
        }
        await Deno.writeTextFile(join(episodePath, `${episode.name.replace(/[/<>:"',\|?*]/g, '')}.strm`), episode.url);
        self.postMessage({
            success: true,
            done: false,
            status: `creating file for series ${episode.name}...!`
        });
    }
};

const createChannels = async (savePath: string) => {
    const allChannels = getChannels(0, countChannels());
    const filters = getFilters();
    let file = '#EXTM3U\n';

    // we have to separately check not includes as we don't want anything in those to be there
    for (let j = 0; j < allChannels.length; j++) {
        let notIncludes = true, result = false;
        for (let i = 0; i < filters.length; i++) {
            if (filters[i].filterType === 'not-includes' && allChannels[j].name.includes(filters[i].filterText)) {
                notIncludes = false;
            }

            if (filters[i].filterType === 'starts-with' && allChannels[j].name.startsWith(filters[i].filterText)) {
                result = true;
            }

            if (filters[i].filterType === 'includes' && allChannels[j].name.includes(filters[i].filterText)) {
                result = true;
            }
        }

        if (notIncludes && result || filters.length === 0) {
            file += `#EXTINF:-1 xui-id="${allChannels[j].xuiId}" tvg-id="${allChannels[j].tvgId}" tvg-name="${allChannels[j].tvgName}" tvg-logo="${allChannels[j].tvgLogo}" group-title="${allChannels[j].groupTitle}",${allChannels[j].name}\n`;
            file += `${allChannels[j].url}\n`;
        }
    }

    // remove all content in the path
    const path = resolve(savePath);
    if (await exists(path)) {
        await Deno.remove(path, { recursive: true });
    }

    await Deno.writeTextFile(path, file);
    self.postMessage({
        success: true,
        done: false,
        status: `creating playlist file for filtered channels...!`
    });
};

try {
    const settings = getSettings();
    await createMovies(settings.moviesSavePath);
    await createSeries(settings.seriesSavePath);
    await createChannels(settings.channelsSavePath);

    self.postMessage({
        success: true,
        done: true,
        status: 'finished creating files!'
    });
} catch (err) {
    self.postMessage({ success: false, error: (err instanceof Error) ? err.message : String(err) });
}