/**
 * src/middleware.ts
 *
 * the functions sit in the middle of routers to handle stuff, like encryption and auth
 *
 * by alex prosser
 * 9/22/2025
 */

import { decodeHex, encodeHex } from '@std/encoding/hex';
import { getCookies } from '@std/http/cookie';
import { JSONToken } from './types.ts';

/**
 * key that encrypts/decrypts the needed content
 */
const AUTH_KEY = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('AUTH_KEY')), 'AES-CBC', true, ['encrypt', 'decrypt']);

/**
 * return default 404 response for any missing file
 * 
 * @returns a response object with 404 message
 */
const getNotFoundResponse = async () => {
    return new Response(await Deno.readTextFile('./views/notfound.html', {}), {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
    });
};

/**
 * encrypts a string with AES with a hidden AUTH_KEY
 * 
 * @param plaintext plaintext to encrypt
 * @returns encrypted text
 */
const encrypt = async (plaintext: string): Promise<string> => {
    const text = new TextEncoder().encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const buffer = await crypto.subtle.encrypt({ name: 'AES-CBC', length: 256, iv }, AUTH_KEY, text);
    return `${encodeHex(buffer)}.${encodeHex(iv)}`;
};

/**
 * decrypt a string with AES with a hidden AUTH_KEY
 * 
 * @param encrypted encrypted text to decrypt
 * @returns decrypted text
 */
const decrypt = async (encrypted: string): Promise<string> => {
    const [buffer, iv] = encrypted.split('.').map(text => new Uint8Array(decodeHex(text)));
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, AUTH_KEY, buffer);
    return new TextDecoder().decode(plaintext);
};

/**
 * check if request is authenticated
 * 
 * @param request incoming request
 * @returns if the request is authenticated or not
 */
const authenticated = async (request: Request): Promise<boolean> => {
    const cookies = getCookies(request.headers);
    if (cookies.session !== undefined) {
        try {
            const json = JSON.parse(await decrypt(cookies.session)) as JSONToken;
            return json.id === 'codingap';
        } catch (_e) {
            return false;
        }
    }
    return false;
}

export {
    authenticated,
    encrypt, decrypt,
    getNotFoundResponse
};