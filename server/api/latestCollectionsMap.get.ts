import { CollectionCSVData } from "~~/types/api/inner/types"
import { ApiResponse } from "~~/types/api/root"
import crypto from 'crypto'

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

const Etags = {
  '100-300': '',
  '100000+': ''
}

const datas = {
  '100-300': '',
  '100000+': ''
}
// Thanks CaleyGoldue/bilibili-collections-archive
export default defineEventHandler(async (event) => {
  try {
    const requestIfNoneMatch = getRequestHeader(event, 'if-none-match')
    const { GithubRawEndpoint } = useRuntimeConfig().public
    const w1_resp = await fetch(`${GithubRawEndpoint}/CaleyGoldue/bilibili-collections-archive/refs/heads/act_id/collect-act_id-100000+.csv`,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'If-None-Match': Etags['100000+'],
        }
      }
    )
    Etags['100000+'] = w1_resp.headers.get('ETag') || ''
    if (w1_resp.status === 200) {
      datas['100000+'] = await w1_resp.text()
    }
    const w2_resp = await fetch(`${GithubRawEndpoint}/CaleyGoldue/bilibili-collections-archive/refs/heads/act_id/collect-act_id-100~300.csv`,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'If-None-Match': Etags['100-300'],
        }
      }
    )
    Etags['100-300'] = w2_resp.headers.get('ETag') || ''
    if (w2_resp.status === 200) {
      datas['100-300'] = await w2_resp.text()
    }
    setResponseHeader(event, "X-Github-Raw-Endpoint", GithubRawEndpoint);
    const hash = crypto.createHash('sha256');
    hash.update(Etags['100-300'] + Etags['100000+']);
    const currentEtag = `W/"${hash.digest('hex')}"`
    const now = new Date()
    const maxAgeSeconds = 600
    const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1000)

    // Keep cache headers identical for 200 and 304 responses.
    setResponseHeader(event, "Date", now.toUTCString());
    setResponseHeader(event, "Expires", expiresAt.toUTCString());
    setResponseHeader(event, "ETag", currentEtag);
    setResponseHeader(event, "Vary", "If-None-Match");
    setResponseHeader(event, "Cache-Control", `max-age=${maxAgeSeconds}, must-revalidate`);
    setResponseHeader(event, "Content-Location", "/api/latest-collections-map");
    if (matchesIfNoneMatch(requestIfNoneMatch, currentEtag)) {
      setResponseStatus(event, 304);
      return null;
    } else {
      setResponseStatus(event, 200);
      return new ApiResponse<CollectionCSVData>(0, undefined, datas)
    }
  } catch (e) {
    if (useRuntimeConfig().isDev && e instanceof Error) {
      setHeaders(event, { 'X-Error-Detail': e.message });
    }
    setResponseStatus(event, 500);
    return new ApiResponse<CollectionCSVData>(-1, 'An error occurred while fetching data');
  }
})
