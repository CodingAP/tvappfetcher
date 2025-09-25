/**
 * the body for a login request (/api/m3u)
 */
interface LoginRequestBody {
    /**
     * the password sent
     */
    password: string;
};

/**
 * the body for a update m3u link request (/api/m3u)
 */
interface SettingsUpdateBody {
    /**
     * the updated url 
     */
    url: string;

    /**
     * updated path to save channel m3u file
     */
    channelsSavePath: string;

    /**
     * updated path to save movies
     */
    moviesSavePath: string;

    /**
     * updated path to save series
     */
    seriesSavePath: string;
};

/**
 * the body for a paginator search request
 */
interface PaginatorSearchRequestBody {
    /**
     * filter string for the search
     */
    search: string;

    /**
     * if we are looking for fetched specifically
     */
    fetched: boolean;

    /**
     * current page for the search
     */
    page: number;

    /**
     * page size for the search
     */
    pageSize: number;
};

/**
 * the body for a fetch request
 */
interface FetchItemRequestBody {
    /**
     * id of the m3u item
     */
    id: string;
    
    /**
     * fetched status to update to
     */
    fetched: boolean;
};

/**
 * settings for the application
 */
interface M3USettings {
    /**
     * url to fetch m3u file from
     */
    url: string;

    /**
     * last time the file was fetched
     */
    lastFetched: string;

    /**
     * path to save channel m3u file
     */
    channelsSavePath: string;

    /**
     * path to save movies
     */
    moviesSavePath: string;

    /**
     * path to save series
     */
    seriesSavePath: string;
};

/**
 * data needed from the m3u file for each item
 */
interface M3UItem {
    /**
     * id uses by the database
     */
    id: string;

    /**
     * xui id - unused
     */
    xuiId: string;

    /**
     * id of the tv guide - used for epg
     */
    tvgId: string;

    /**
     * name of the tv guide - used for epg
     */
    tvgName: string;

    /**
     * logo of the tv guide - used for epg
     */
    tvgLogo: string;

    /**
     * name of the group it belongs to
     */
    groupTitle: string;

    /**
     * name of the m3u item
     */
    name: string;

    /**
     * url of the m3u item
     */
    url: string;
};

/**
 * data needed to parse a m3u channel specifically
 */
interface M3UChannel extends M3UItem {}

/**
 * data needed to parse a m3u movie specifically
 */
interface M3UMovie extends M3UItem {
    /**
     * if the movie has been fetched
     */
    fetched: boolean;
};

/**
 * data needed to parse a m3u series specifically
 */
interface M3USeries extends M3UItem {
    /**
     * if the show has been fetched
     */
    fetched: boolean;

    /**
     * season number of the series episode
     */
    season: number;

    /**
     * episode number of the series episode
     */
    episode: number;
};

/**
 * worker message event for m3u parsing
 */
interface M3UParsingMessageEventData {
    /**
     * indicates if parsing was successful
     */
    success: boolean;

    /**
     * indicates if the parsing is done
     */
    done: boolean;

    /**
     * status of the parsing
     */
    status: string;
};

/**
 * the custom json web token 
 */
interface JSONToken {
    /**
     * the timestamp of the log in 
     */
    timestamp: string;

    /**
     * the id of the user
     */
    id: string;
};

export type {
    LoginRequestBody,
    SettingsUpdateBody,
    PaginatorSearchRequestBody,
    FetchItemRequestBody,
    M3USettings, M3UItem, M3UChannel, M3UMovie, M3USeries, M3UParsingMessageEventData,
    JSONToken
};