import { Actor } from 'apify';
import { gotScraping } from 'crawlee';
import type { RagStandByResponse } from './types.js';

/**
 * Generates endpoint for the RAG Web Browser Actor
 */
export function generateRagUrl(query: string): string {
    const ragUrl = new URL('https://rag-web-browser.apify.actor/search');
    ragUrl.searchParams.set('query', query);
    ragUrl.searchParams.set('maxRequestRetries', '0');
    ragUrl.searchParams.set('dynamicContentWaitSecs', '60');
    ragUrl.searchParams.set('maxResults', '1'); // It's possible to have multiple results to jump-start the search
    return ragUrl.href;
}

/**
 * Calls the Rag Web Browser Actor
 */
export async function callRagStandby(url: string) {
    const ragResponse = await gotScraping<RagStandByResponse>({
        url,
        headers: {
            Authorization: `Bearer ${Actor.getEnv().token}`,
        },
        responseType: 'json',
    });
    return ragResponse.body;
}
