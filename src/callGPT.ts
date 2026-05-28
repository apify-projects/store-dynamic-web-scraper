import OpenAI from 'openai';
import type { PageContext } from './types.js';

const openai = new OpenAI({
    apiKey: process.env.API_KEY,
});

/**
 * Requests to ChatGPT to perform an analysis on the provided webpage (passed in a markdown formatted string)
 */
export async function callGPT(
    prompt: string,
    markdownString: string,
    source: string,
    pageContext: PageContext,
    multipleTargets: boolean,
): Promise<GPTResponse> {
    const promptPresentation = `Find a respond for this user-prompt: "${prompt}" in a close relation to this source ${source}.`;

    const pageMetadata = `Current page metadata:
- URL: ${pageContext.url}
- Page title: ${pageContext.title}
- Page description: ${pageContext.description}
- Navigation depth: ${pageContext.depth} (0 = start/home page, higher = deeper into the site)
- Start source: ${pageContext.startSource}
- Current datetime (UTC): ${new Date().toISOString()}`;

    const positiveResponseStructure = multipleTargets
        ? `If you are able to respond, return the result in a JSON format with these properties:`
            + ` "answered": true, "response": (your response goes here), "bestUrls": (array of additional relevant URLs to continue exploring from this page).`
        : `If you are able to respond, return the result in a JSON format with these properties:`
            + ` "answered": true, "response": (your response goes here).`;

    const negativeResponseStructure = `If you are not able to respond, you should provide a list of text document absolute URLs (extracted from the markdown)`
        + ` that based on their label and url leads to the goal of the user-prompt (current url is ${pageContext.url} try to stick with the domain). You should structure this response in a JSON format`
        + ` with these properties: "answered": false, "bestUrls": (the array of ranked urls).`;

    const markdownPresentation = `Try find the answer in this document: \n${markdownString}`;

    const content = [
        promptPresentation,
        pageMetadata,
        positiveResponseStructure,
        negativeResponseStructure,
        markdownPresentation,
    ].join('\n\n');

    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content }],
        model: 'gpt-4o-mini',
        store: false,
    });
    if (!completion.choices[0].message.content) throw new Error('Empty response from GPT');
    const gptResponse = completion.choices[0].message.content!.split('```')[1].slice(4).trim(); /// content is "```json CONTENT ```"
    return (JSON.parse(gptResponse));
}

export interface GPTResponse {
    answered: boolean,
    response?: string,
    bestUrls?: string[]
}
