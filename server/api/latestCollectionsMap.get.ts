import { CollectionCSVData } from "~~/types/api/inner/types"
import { ApiResponse } from "~~/types/api/root"

const Etags = {
  '100-300': '',
  '100000+': ''
}

const datas = {
  '100-300': '',
  '100000+': ''
}
// Thanks CloudyEagle/bilibili-collections-archive
export default defineEventHandler(async (event) => {
  const { GithubRawEndpoint } = useRuntimeConfig().public
  const w1_resp = await fetch(`${GithubRawEndpoint}/CloudyEagle/bilibili-collections-archive/refs/heads/main/collect-act_id-100000+.csv`,
    {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'If-None-Match': Etags['100000+'],
      },
      cache: 'default'
    }
  )
  Etags['100000+'] = w1_resp.headers.get('ETag') || ''
  if (w1_resp.status === 200) {
    datas['100000+'] = await w1_resp.text()
  }
  const w2_resp = await fetch(`${GithubRawEndpoint}/CloudyEagle/bilibili-collections-archive/refs/heads/main/collect-act_id-100~300.csv`,
    {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'If-None-Match': Etags['100-300'],
      },
      cache: 'default'
    }
  )
  Etags['100-300'] = w2_resp.headers.get('ETag') || ''
  if (w2_resp.status === 200) {
    datas['100-300'] = await w2_resp.text()
  }
  setResponseHeader(event, "X-Github-Raw-Endpoint", GithubRawEndpoint);
  setResponseHeader(event, "X-ETag-100-300", Etags['100-300']);
  setResponseHeader(event, "X-ETag-100000+", Etags['100000+']);
  return new ApiResponse<CollectionCSVData>(0, undefined, datas)
})
