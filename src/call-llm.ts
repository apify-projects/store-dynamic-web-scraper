import OpenAI from 'openai';
import { Actor } from 'apify';
import { jsonrepair } from 'jsonrepair';
import type { PageContext } from './types.js';

const openai = new OpenAI({
    baseURL: 'https://openrouter.apify.actor/api/v1',
    apiKey: 'no-key-required-but-must-not-be-empty',
    defaultHeaders: {
        Authorization: `Bearer ${Actor.getEnv().token}`,
    },
});

/**
 * Requests an LLM via OpenRouter to perform an analysis on the provided webpage (passed in a markdown formatted string)
 */
export async function callLlm(
    prompt: string,
    markdownString: string,
    source: string,
    pageContext: PageContext,
    multipleTargets: boolean,
    model: string,
): Promise<GPTResponse> {
    const promptPresentation = `Find a respond for this user-prompt: "${prompt}" in a close relation to this source ${source}.`;

    const pageMetadata = `Current page metadata:
- URL: ${pageContext.url}
- Page title: ${pageContext.title}
- Page description: ${pageContext.description}
- Navigation depth: ${pageContext.depth} (0 = start/home page, higher = deeper into the site)
- Start source: ${pageContext.startSource}
- Current datetime (UTC): ${new Date().toISOString()}`;

    const numberedMarkdown = markdownString.split('\n').map((line, i) => `${i}: ${line}`).join('\n');

    const contentLinesInstruction = ` Also include "contentLines": { "start": <line_number>, "end": <line_number> } with the 0-indexed line range of the main content in the numbered document, excluding navigation, ads, and footer. Do NOT include the article text, body, or any large text field in the JSON response — use contentLines to reference the content by line numbers only.`;

    const positiveResponseStructure = multipleTargets
        ? `If you are able to respond, return a JSON object with "answered": true, any additional fields the user-prompt asks for as top-level properties (do NOT nest them inside a "response" field), and "bestUrls": (array of additional relevant URLs to continue exploring from this page).`
            + contentLinesInstruction
        : `If you are able to respond, return a JSON object with "answered": true and any additional fields the user-prompt asks for as top-level properties (do NOT nest them inside a "response" field).`
            + contentLinesInstruction;

    const negativeResponseStructure = `If you are not able to respond, you should provide a list of text document absolute URLs (extracted from the markdown)`
        + ` that based on their label and url leads to the goal of the user-prompt (current url is ${pageContext.url} try to stick with the domain). You should structure this response in a JSON format`
        + ` with these properties: "answered": false, "bestUrls": (the array of ranked urls).`;

    const markdownPresentation = `Try find the answer in this document (lines are numbered for reference):\n${numberedMarkdown}`;

    const content = [
        promptPresentation,
        pageMetadata,
        positiveResponseStructure,
        negativeResponseStructure,
        markdownPresentation,
    ].join('\n\n');

    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content }],
        model,
        store: false,
        response_format: { type: 'json_object' },
    });
    const raw = completion.choices[0].message.content;
    if (!raw) throw new Error('Empty response from LLM');
    try {
        return JSON.parse(jsonrepair(raw));
    } catch (e) {
        const key = `llm-parse-error-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await Actor.setValue(key, {
            url: pageContext.url,
            model,
            error: (e as Error).message,
            rawLlmResponse: raw,
        });
        throw e;
    }
}

export interface GPTResponse {
    answered: boolean,
    bestUrls?: string[],
    contentLines?: { start: number, end: number },
    [key: string]: unknown,  // user-prompt fields (title, publishedAt, etc.) land here directly
}
