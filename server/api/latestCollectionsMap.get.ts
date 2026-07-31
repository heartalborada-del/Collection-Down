import type { CollectionCSVData } from "~~/types/api/inner/types"
import { ApiResponse } from "~~/types/api/root"
import { describeError, describeUpstreamResponse } from "~~/server/utils/apiError"

const normalizeEtag = (etag: string) => etag.trim().replace(/^W\//i, '')

const matchesIfNoneMatch = (ifNoneMatch: string | undefined, currentEtag: string) => {
  if (!ifNoneMatch) {
    return false
  }

  return ifNoneMatch
    .split(',')
    .map(tag => tag.trim())
    .some(tag => tag === '*' || normalizeEtag(tag) === normalizeEtag(currentEtag))
}

let Etag = ""

let data = ""

// Thanks CaleyGoldue/bilibili-collections-archive
export default defineEventHandler(async (event) => {
  try {
    const requestIfNoneMatch = getRequestHeader(event, 'if-none-match')
    const { GithubRawEndpoint } = useRuntimeConfig().public
    const resp = await fetch(`${GithubRawEndpoint}/CaleyGoldue/bilibili-collections-archive/refs/heads/act_id/result_collect-act_id.csv`,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'If-None-Match': Etag,
        }
      }
    )
    Etag = resp.headers.get('ETag') || ''
    if (resp.status === 200) {
      data = await resp.text()
    }
    else if (!(resp.status === 304 && data)) {
      setResponseStatus(event, resp.status || 502)
      return new ApiResponse<CollectionCSVData>(-1, await describeUpstreamResponse(resp, 'GitHub collection list'))
    }
    setResponseHeader(event, "X-Github-Raw-Endpoint", GithubRawEndpoint);
    const now = new Date()
    const maxAgeSeconds = 600
    const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1000)

    // Keep cache headers identical for 200 and 304 responses.
    setResponseHeader(event, "Date", now.toUTCString());
    setResponseHeader(event, "Expires", expiresAt.toUTCString());
    setResponseHeader(event, "ETag", Etag);
    setResponseHeader(event, "Vary", "If-None-Match");
    setResponseHeader(event, "Cache-Control", `max-age=${maxAgeSeconds}, must-revalidate`);
    setResponseHeader(event, "Content-Location", "/api/latest-collections-map");
    if (matchesIfNoneMatch(requestIfNoneMatch, Etag)) {
      setResponseStatus(event, 304);
      return null;
    } else {
      setResponseStatus(event, 200);
      return new ApiResponse<CollectionCSVData>(0, undefined, { data: data });
    }
  } catch (e) {
    setResponseStatus(event, 500);
    return new ApiResponse<CollectionCSVData>(-1, describeError(e, 'Failed to load GitHub collection list'));
  }
})
