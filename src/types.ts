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
     * xui id - unused
     */
    xuiId?: string;

    /**
     * id of the tv guide - used for epg
     */
    tvgId?: string;

    /**
     * name of the tv guide - used for epg
     */
    tvgName?: string;

    /**
     * logo of the tv guide - used for epg
     */
    tvgLogo?: string;

    /**
     * name of the group it belongs to
     */
    groupTitle?: string;

    /**
     * name of the channel
     */
    name?: string;

    /**
     * channel id to help identify channels
     */
    channelId?: string;

    /**
     * url of hte channel
     */
    url: string;
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
    status?: string;

    /**
     * list of parsed channels
     */
    channels?: M3UItem[];
    
    /**
     * list of parsed movies
     */
    movies?: M3UItem[];

    /**
     * list of parsed shows
     */
    shows?: M3UItem[];
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
    M3UItem, M3UParsingMessageEventData,
    JSONToken
};