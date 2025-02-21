import { Actor } from 'apify';
import { HttpCrawler, log, RequestOptions } from 'crawlee';
import { type Input } from './types.js';
import { callGPT } from './callGPT.js';
import { callRagStandby, generateRagUrl } from './tools.js';

const EVENTS_NAME = {
    START_ACTOR: 'START_ACTOR',
    GPT_API_CALL: 'GPT_API_CALL',
    PUSHING_DATASET: 'PUSHING_DATASET',
};

await Actor.init();
await Actor.charge({ eventName: EVENTS_NAME.START_ACTOR, count: 1 });
const {
    startSources = [],
    prompt,
    maxDepth: maxDepthInput = 3,
} = await Actor.getInput<Input>() ?? {} as Input;

const urlsState = await Actor.useState<Record<string, { requests: RequestOptions[], index: number }>>('urls', {});
const solvedInputState = await Actor.useState<string[]>('solvedInputs', []);

const httpCrawler = new HttpCrawler({
    requestHandlerTimeoutSecs: 60,
    maxConcurrency: 2,
    requestHandler: async ({ request, crawler }) => {
        const { maxDepth: depth = maxDepthInput, inputSource } = request.userData;
        if (solvedInputState.includes(inputSource)) {
            return;
        }
        urlsState[inputSource] ??= {
            requests: [],
            index: 0,
        };
        const query = new URL(request.url).searchParams.get('query');
        log.info(`Evaluating ${query} with depth: ${depth}...`);

        // Call RAG with url
        const results = await callRagStandby(request.url);

        if (('errorMessage' in results)) {
            throw new Error(`Found Error message ${results.errorMessage}`);
        }
        for (const result of results) {
            const { markdown, metadata: { url } } = result;

            // Call ChatGRT and ask if it's able to provide a solution
            const chatGptResponse = await callGPT(prompt, markdown, inputSource, url);
            await Actor.charge({ eventName: EVENTS_NAME.GPT_API_CALL, count: 1 });

            // ---- yes -> Information provided -> put into Dataset.
            if (chatGptResponse.answered && !solvedInputState.includes(inputSource)) {
                solvedInputState.push(inputSource);
                await crawler.pushData({
                    url,
                    inputSource,
                    depth,
                    response: chatGptResponse.response,
                });
                await Actor.charge({ eventName: EVENTS_NAME.PUSHING_DATASET, count: 1 });
                return;
            } else if (depth === 0) {
                await crawler.pushData({
                    inputSource,
                    response: null,
                });
                return;
            }

            // ---- no --> ChatGPT: What would be the best next links?
            //             enqueue them.
            const { bestUrls = [] } = chatGptResponse;

            // Update the url to enqueue in future crawls
            if (depth > 0 && !solvedInputState.includes(inputSource)) {
                for (const bestUrl of bestUrls) {
                    const isAlreadyEnqueued = urlsState[inputSource].requests.some((requestA) => requestA.url === bestUrl);
                    if (!isAlreadyEnqueued) {
                        urlsState[inputSource].requests.push({
                            url: bestUrl,
                            skipNavigation: true,
                            userData: {
                                maxDepth: depth - 1,
                                inputSource,
                            },
                        });
                    }
                }
            }
        }

        // Enqueue next request (if available)
        const nextRequest = urlsState[inputSource].requests[urlsState[inputSource].index];
        if (nextRequest) {
            await crawler.addRequests([{
                ...nextRequest,
                url: generateRagUrl(nextRequest.url),
            }]);
            urlsState[inputSource].index++;
        }
    },
});

await httpCrawler.run(startSources.map((startSource) => ({
    url: generateRagUrl(startSource),
    skipNavigation: true,
    userData: {
        inputSource: startSource,
    },
})));

await Actor.exit();
