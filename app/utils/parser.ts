import type {ApiResponse} from "~~/types/api/root";

export async function GetForwardedLink(link:string):Promise<string> {
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

export function ParseIdFromLink(link:string): {
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