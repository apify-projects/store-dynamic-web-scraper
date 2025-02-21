## What does Dynamic Web Scraper do?
Dynamic Web Scraper is an open-source Apify Actor that gathers information online by simulating user browsing behavior on the web. It reduces the time and amount of scraped web pages by using a model (ChatGPT) to make decisions regarding browser navigation and results evaluation.

Dynamic Web Scraper takes as input a prompt and a list of initial URLs or Google queries. The model then decides which URLs should be visited in order to provide the best answer to the prompt.

## Development
If you are interested in the development check out the [GitHub Repository](https://github.com/apify-projects/store-dynamic-web-scraper).
Feel free to contribute!

## Why scrape websites dynamically?
Dynamic web scraping allows for more efficient data extraction by automating the browsing process. It can help gather specific information from websites that may not be easily accessible through traditional scraping methods.

## How to use Dynamic Web Scraper
To use Dynamic Web Scraper, follow these steps:
1. Click on Try for free.
2. Enter the prompt and a list of initial URLs or Google queries.
3. Click on Run.
4. Once the actor has finished, preview or download your data from the Dataset tab.

## How much will it cost to use Dynamic Web Scraper?
Apify provides $5 free usage credits every month on the Apify Free plan. For more extensive data extraction needs, consider upgrading to a paid Apify subscription.

## Results

###An example of the JSON results produced by the Actor:
```
{
  "url": "https://www.example.com",
  "inputSource": "Example input",
  "depth": 3,
  "response": <Response based on input>
}
```

## Tips for using Dynamic Web Scraper
- Ensure that your prompt is clear and specific to get accurate results.
- Monitor the actor's progress to ensure it is navigating the web effectively.

## Is it legal to use Dynamic Web Scraper?
It is important to be aware of legal considerations when scraping websites, especially regarding data privacy regulations such as GDPR. Ensure that you have a legitimate reason for scraping and consult legal advice if needed.
For more information on the legality of web scraping, read our blog post: [Is Web Scraping Legal?](https://blog.apify.com/is-web-scraping-legal/)
