import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes } from '@noble/hashes/utils.js';
import type { BilibiliPowWorkerRequest, BilibiliPowWorkerResponse } from '~~/types/api/bili/pow';

const encoder = new TextEncoder();

self.onmessage = (event: MessageEvent<BilibiliPowWorkerRequest>) => {
    const { q, r, start, end } = event.data;
    try {
        const expectedDigest = hexToBytes(r);
        const prefix = encoder.encode(q);
        const input = new Uint8Array(prefix.length + 7);
        input.set(prefix);

        for (let result = start; result < end; result++) {
            let value = result;
            let digits = 1;
            for (let remaining = value; remaining >= 10; remaining = Math.floor(remaining / 10)) {
                digits++;
            }
            for (let index = prefix.length + digits - 1; index >= prefix.length; index--) {
                input[index] = 48 + (value % 10);
                value = Math.floor(value / 10);
            }

            const digest = sha256(input.subarray(0, prefix.length + digits));
            let matches = true;
            for (let index = 0; index < expectedDigest.length; index++) {
                if (digest[index] !== expectedDigest[index]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                self.postMessage({ result } satisfies BilibiliPowWorkerResponse);
                return;
            }
        }
        self.postMessage({} satisfies BilibiliPowWorkerResponse);
    } catch (error) {
        self.postMessage({
            error: error instanceof Error ? error.message : 'Unable to calculate Bilibili proof of work',
        } satisfies BilibiliPowWorkerResponse);
    }
};
