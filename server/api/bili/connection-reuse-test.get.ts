import { createError, type H3Event } from 'h3';
import { BilibiliTcpClient } from '~~/server/utils/bilibiliTcpFetch';

function isTestEnabled(event: H3Event): boolean {
    const cloudflare = event.context.cloudflare as {
        env?: Record<string, unknown>;
    } | undefined;
    return cloudflare?.env?.BILIBILI_CONNECTION_TEST_ENABLED === 'true';
}

async function summarizeResponse(response: Response) {
    return {
        status: response.status,
        statusText: response.statusText,
        bodyLength: (await response.arrayBuffer()).byteLength,
        contentType: response.headers.get('content-type'),
    };
}

export default defineEventHandler(async (event) => {
    if (!isTestEnabled(event)) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found' });
    }

    const client = new BilibiliTcpClient();
    const headers = {
        accept: 'application/json,text/plain,*/*',
        'user-agent': 'Collection-Down connection diagnostic',
    };
    try {
        const apiResponse = await client.fetch(
            'https://api.bilibili.com/x/frontend/finger/spi',
            { headers },
        );
        const apiConnectionId = client.getStats().lastResponseConnectionId;
        const apiSummary = await summarizeResponse(apiResponse);

        const securityResponse = await client.fetch(
            'https://security.bilibili.com/robots.txt',
            { headers },
        );
        const stats = client.getStats();
        const securityConnectionId = stats.lastResponseConnectionId;
        const securitySummary = await summarizeResponse(securityResponse);

        return {
            ok: true,
            sameSocket: apiConnectionId !== null && apiConnectionId === securityConnectionId,
            connection: stats.activeConnection,
            connectionsOpened: stats.connectionsOpened,
            requestsCompleted: stats.requestsCompleted,
            requests: [
                {
                    host: 'api.bilibili.com',
                    path: '/x/frontend/finger/spi',
                    connectionId: apiConnectionId,
                    ...apiSummary,
                },
                {
                    host: 'security.bilibili.com',
                    path: '/robots.txt',
                    connectionId: securityConnectionId,
                    ...securitySummary,
                },
            ],
        };
    } catch (error) {
        console.warn({
            message: 'bilibili-api:connection_reuse_test_failed',
            scope: 'bilibili-api',
            event: 'connection_reuse_test_failed',
            errorType: error instanceof Error ? error.name : 'UnknownError',
        });
        throw createError({
            statusCode: 502,
            statusMessage: 'Bilibili connection reuse test failed',
            data: {
                error: error instanceof Error ? error.message : 'Unknown diagnostic error',
            },
        });
    } finally {
        client.close();
    }
});
