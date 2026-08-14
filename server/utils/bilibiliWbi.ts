import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
] as const;
const WBI_FILTER_PATTERN = /[!'()*]/g;
const TEXT_ENCODER = new TextEncoder();

export interface WbiKeys {
    imgKey: string;
    subKey: string;
}

export function extractWbiKey(imageUrl: string): string | undefined {
    try {
        const filename = new URL(imageUrl).pathname.split('/').at(-1);
        const key = filename?.split('.', 1)[0];
        return key && /^[a-f\d]{32}$/i.test(key) ? key : undefined;
    } catch {
        return undefined;
    }
}

function getMixinKey(keys: WbiKeys): string {
    const rawKey = keys.imgKey + keys.subKey;
    return MIXIN_KEY_ENC_TAB.map(index => rawKey[index]).join('').slice(0, 32);
}

export function signWbiUrl(
    input: string | URL,
    keys: WbiKeys,
    timestamp = Math.round(Date.now() / 1000),
): URL {
    const url = new URL(input);
    const params = [...url.searchParams.entries()]
        .filter(([key]) => key !== 'w_rid' && key !== 'wts')
        .map(([key, value]) => [key, value.replace(WBI_FILTER_PATTERN, '')] as const);
    const signingParams = [...params, ['wts', String(timestamp)] as const]
        .sort(([left], [right]) => left.localeCompare(right));
    const query = signingParams
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
    const signature = bytesToHex(md5(TEXT_ENCODER.encode(query + getMixinKey(keys))));

    url.search = '';
    for (const [key, value] of params) {
        url.searchParams.append(key, value);
    }
    url.searchParams.set('wts', String(timestamp));
    url.searchParams.set('w_rid', signature);
    return url;
}
