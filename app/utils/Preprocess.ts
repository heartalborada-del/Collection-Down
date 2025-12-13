import type { ApiResponse } from "~~/types/api/root";

export async function GetForwardedLink(link: string): Promise<string> {
    if (!link.startsWith("https://b23.tv"))
        return link;
    const raw: ApiResponse<string> = await fetch("/api/redirect", {
        method: "POST",
        body: JSON.stringify({
            origin: link
        }),
        headers: {
            "Content-Type": "application/json"
        }
    }).then(res => res.json());
    if (raw && raw.code === 0 && raw.data) {
        return raw.data;
    }
    throw new Error(raw.message);
}

export function ParseIdFromLink(link: string): {
    id: string,
    type: ParsedType
} {
    const match = link.match(/[?&]act_id=(\d+)/);
    if (match && match[1]) {
        return {
            id: match[1],
            type: ParsedType.DLC
        };
    }
    const match2 = link.match(/[?&]id=(\d+)/);
    if (match2 && match2[1]) {
        return {
            id: match2[1],
            type: ParsedType.THEME
        };
    }
    return {
        id: '',
        type: ParsedType.NONE
    };
}

export enum ParsedType {
    DLC = 1,
    THEME,
    NONE
}

export function GetFileExtensionFromUrl(url?: string): string | undefined {
    if (!url) return undefined;
    try {
        // 支持相对 URL：提供 base
        const u = new URL(url, 'http://example.com');
        const pathname = u.pathname || '';
        // 先尝试直接从 pathname 末尾匹配扩展名
        const m = pathname.match(/\.([a-z0-9]+)$/i);
        const ext = m?.[1];
        if (ext) return ext.toLowerCase();
        // 再尝试在整个 URL 中匹配（处理像 /file.jpg?x=1 的情况）
        const m2 = url.match(/\.([a-z0-9]+)(?=($|\?|#))/i);
        const ext2 = m2?.[1];
        if (ext2) return ext2.toLowerCase();
        return undefined;
    } catch {
        // 容错：简单正则解析
        const m = url.match(/\.([a-z0-9]+)(?=($|\?|#))/i);
        const ext = m?.[1];
        return ext ? ext.toLowerCase() : undefined;
    }
}

export function FormatDateWithDefaultOffset(date: Date, offset: string = '+0800', isShowHour = true): string {
    const padZero = (num: number) => num.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1); // 月份从0开始，所以要加1
    const day = padZero(date.getDate());

    const hours = padZero(date.getHours());
    const minutes = padZero(date.getMinutes());
    const seconds = padZero(date.getSeconds());
    if (isShowHour)
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}${offset}`;
    return `${year}/${month}/${day}`;
}