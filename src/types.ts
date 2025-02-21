export type RagStandByResponse = Array<{
    searchResult: {
        title: string
        description: string
        url: string
        rank: number
    }
    metadata: {
        title: string
        description: string
        languageCode: string
        url: string
    }
    crawl: {
        httpStatusCode: number
        httpStatusMessage: string
        loadedAt: string
        uniqueKey: string
        requestStatus: string
    }
    markdown: string
}>

export interface Input {
    startSources: string[];
    prompt: string;
    maxDepth?: number;
}
