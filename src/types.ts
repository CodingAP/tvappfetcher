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
interface M3ULinkUpdateBody {
    /**
     * the updated url 
     */
    url: string;
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

    /**
     * list of parsed channels
     */
    channels?: M3UChannel[];
    
    /**
     * list of parsed movies
     */
    movies?: M3UMovie[];

    /**
     * list of parsed series
     */
    series?: M3USeries[];
}

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
    M3ULinkUpdateBody,
    M3UItem, M3UChannel, M3UMovie, M3USeries, M3UParsingMessageEventData,
    JSONToken
};