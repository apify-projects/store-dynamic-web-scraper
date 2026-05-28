import { Actor } from 'apify';
import { HttpCrawler, log, RequestOptions } from 'crawlee';
import { type Input, type PageContext } from './types.js';
import { callGPT } from './callGPT.js';
import { callRagStandby, generateRagUrl } from './tools.js';
import { DEFAULT_MODEL } from './constants.js';

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
    multipleTargets = false,
    model = DEFAULT_MODEL,
} = await Actor.getInput<Input>() ?? {} as Input;

const urlsState = await Actor.useState<Record<string, { requests: RequestOptions[], index: number }>>('urls', {});
const solvedInputState = await Actor.useState<string[]>('solvedInputs', []);
const pushedUrls = await Actor.useState<Record<string, string[]>>('pushedUrls', {});

const httpCrawler = new HttpCrawler({
    requestHandlerTimeoutSecs: 60,
    requestHandler: async ({ request, crawler }) => {
        const { maxDepth: depth = maxDepthInput, inputSource } = request.userData;
        if (!multipleTargets && solvedInputState.includes(inputSource)) {
            return;
        }
        urlsState[inputSource] ??= {
            requests: [],
            index: 0,
        };
        pushedUrls[inputSource] ??= [];

        const query = new URL(request.url).searchParams.get('query');
        log.info(`Evaluating ${query} with depth: ${maxDepthInput - depth}...`);

        // Call RAG with url
        const results = await callRagStandby(request.url);

        if (('errorMessage' in results)) {
            throw new Error(`Found Error message ${results.errorMessage}`);
        }

        await Promise.all(results.map(async (result) => {
            const { markdown, metadata } = result;
            const { url } = metadata;

            const pageContext: PageContext = {
                title: metadata.title,
                description: metadata.description,
                url,
                depth: maxDepthInput - depth, // 0 = start page, increases with each hop
                startSource: inputSource,
            };

            // Call ChatGPT and ask if it's able to provide a solution
            const chatGptResponse = await callGPT(prompt, markdown, inputSource, pageContext, multipleTargets, model);
            await Actor.charge({ eventName: EVENTS_NAME.GPT_API_CALL, count: 1 });

            // ---- yes -> Information provided -> put into Dataset.
            if (chatGptResponse.answered) {
                const alreadyPushed = pushedUrls[inputSource].includes(url);
                if (!alreadyPushed) {
                    pushedUrls[inputSource].push(url);
                    await crawler.pushData({
                        url,
                        inputSource,
                        depth: pageContext.depth,
                        response: chatGptResponse.response,
                        contentMarkdown: markdown,
                    });
                    await Actor.charge({ eventName: EVENTS_NAME.PUSHING_DATASET, count: 1 });
                }

                if (!multipleTargets) {
                    solvedInputState.push(inputSource);
                    return;
                }
                // multipleTargets: fall through to process bestUrls returned alongside the answer
            } else if (depth === 0) {
                // Max depth reached without a result — skip silently, no information value.
                return;
            }

            // ---- no --> ChatGPT: What would be the best next links?
            //             enqueue them.
            const { bestUrls = [] } = chatGptResponse;

            // Update the url to enqueue in future crawls
            if (depth > 0 && (multipleTargets || !solvedInputState.includes(inputSource))) {
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
        }));

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
