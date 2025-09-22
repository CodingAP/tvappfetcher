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
    JSONToken
};