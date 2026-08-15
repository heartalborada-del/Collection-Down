# [Collection Down](https://cd.griseo.top/)

- [![EdgeOne](https://img.shields.io/website?url=https%3A%2F%2Fcd-eo.griseo.top&style=flat&logo=edgeone&label=EdgeOne) cd-eo.griseo.top](https://cd-eo.griseo.top)
- [![Netlify Deploy](https://img.shields.io/netlify/e6d5a4e0-dee1-4261-833e-2f47f509c68f?logo=netlify) cd-netlify.griseo.top](https://cd-netlify.griseo.top)
- [![Cloudflare](https://img.shields.io/website?url=https%3A%2F%2Fcd-cloudflare.griseo.top&style=flat&logo=cloudflare&label=Cloudflare) cd-cloudflare.griseo.top](https://cd-cloudflare.griseo.top)
- [![Vercel Deploy](https://img.shields.io/website?url=https%3A%2F%2Fcd-vercel.griseo.top&style=flat&logo=vercel&label=Vercel) ~~cd-vercel.griseo.top~~](https://cd-vercel.griseo.top) **因超出限制而被暂停部署**

又一个Bilibili收藏集下载工具，支持下载视频，图片，表情包等

此项目旨在给予B站用户更好的站装扮以及收藏集下载体验

基于Vue3+Nuxt.js开发
## Group
QQ Group: [1031419163](https://qun.qq.com/universal-share/share?ac=1&authKey=Z%2Fi6gDC%2F21mFPhcpKww4o3IsSMJnv%2FW5sp%2F70IwX4W7OQuROILQD509rAjudD4f5&busi_data=eyJncm91cENvZGUiOiIxMDMxNDE5MTYzIiwidG9rZW4iOiJ3WWN0QVpBdzc4TG84KzgvUGpKUVQ2K1ZBMHVRTjRpUGw0dm5qeTlVSEJJdkFrcTBTUWs2T1B6ZnlVMGIwb21BIiwidWluIjoiMzEyNTI3OTU2MiJ9&data=JhK6VLx_39V3raM4aXxYBOCwOsKY5aZdngAzlkZVjGijaiY5Rikl2Z_GhQWgajsX3ArSQL4YrbScK9FzZai37Q&svctype=4&tempid=h5_group_info)
## Thanks To
- [bilibili-collections-archive](https://github.com/CloudyEagle/bilibili-collections-archive)
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)

## Deploy
[![Use EdgeOne Pages to deploy](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https://github.com/heartalborada-del/Collection-Down)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fheartalborada-del%2FCollection-Down)

[![Deploy with Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https%3A%2F%2Fgithub.com%2Fheartalborada-del%2FCollection-Down)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fheartalborada-del%2FCollection-Down)
## Development

```bash
# Clone & Install dependencies
yarn install
# Start the development server on `http://localhost:3000`
yarn dev
# Build the application for production
yarn build
# Locally preview production build
yarn preview
```

## Desktop builds

Every push builds downloadable desktop packages for Windows, Linux, and macOS in GitHub Actions. Open the latest successful `Desktop builds` workflow run and download the package from its `Artifacts` section.

Tags matching `v*` also publish the packages to GitHub Releases. To build the current platform locally, run:

```bash
yarn desktop:dist
```

Desktop dependencies are isolated in `desktop/package.json` and are installed only by desktop commands. Web deployment platforms therefore do not download Electron or `electron-builder` during their root dependency installation.

Web deployment is handled by [`.github/workflows/web-deploy.yml`](.github/workflows/web-deploy.yml). Add the following GitHub Actions secrets to enable each target:

- EdgeOne Makers: `EDGEONE_PROJECT_NAME`, `EDGEONE_API_TOKEN`
- Netlify: `NETLIFY_SITE_ID`, `NETLIFY_AUTH_TOKEN`

Application variables are shared by both targets: `GITHUB_RAW_ENDPOINT`, `UMAMI_ENABLED`, `UMAMI_HOST`, `UMAMI_ID`, `UMAMI_TAG`, and `DEV_MODE`. EdgeOne additionally receives `EDGEONE_COMPATIBILITY=true` by default; set the `EDGEONE_COMPATIBILITY` Secret only when the EdgeOne project requires another value.

The workflow builds and uploads through the platform CLIs, so the EdgeOne and Netlify dashboard build hooks should be disabled to avoid duplicate builds.
