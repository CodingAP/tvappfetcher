/// <reference lib="webworker" />

import { join, resolve } from "@std/path";
import { getMovies, countMovies, getSettings, getFetchedEpisodes } from '../database/database.ts';
import { exists } from "@std/fs";

const createMovies = async (savePath: string) => {
    const total = countMovies('', true);
    const movies = getMovies('', 0, total, true);

    const path = resolve(savePath);
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

    const path = resolve(savePath);
    for (const episode of episodes) {
        const episodePath = join(path, episode.groupTitle.replace(/[/<>:"\|?*]/g, ''), `Season ${episode.season}`);
        if (!(await exists(episodePath))) {
            await Deno.mkdir(episodePath, { recursive: true });
        }
        await Deno.writeTextFile(join(episodePath, `${episode.name}.strm`), episode.url);
        self.postMessage({
            success: true,
            done: false,
            status: `creating file for movie ${episode.name}...!`
        });
    }
};

try {
    const settings = getSettings();
    await createMovies(settings.moviesSavePath);
    await createSeries(settings.seriesSavePath);

    self.postMessage({
        success: true,
        done: true,
        status: 'finished creating files!'
    });
} catch (err) {
    self.postMessage({ success: false, error: (err instanceof Error) ? err.message : String(err) });
}