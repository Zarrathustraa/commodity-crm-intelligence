
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    const url = "https://news.google.com/rss/search?q=agriculture+commodities&hl=en-US&gl=US&ceid=US:en";
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Google News response error: ${response.status}`);
    }

    const xmlText = await response.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];
      const title = (itemContent.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (itemContent.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const pubDate = (itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const description = (itemContent.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
      const source = (itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';

      const clean = (str) => str
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();

      // Parse relative time or clean date
      const dateObj = new Date(clean(pubDate));
      const formattedDate = isNaN(dateObj.getTime()) ? clean(pubDate) : dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Strip source from title if present (Google News format: "Title - Source")
      let cleanTitle = clean(title);
      const sourceSuffix = ` - ${clean(source)}`;
      if (cleanTitle.endsWith(sourceSuffix)) {
        cleanTitle = cleanTitle.substring(0, cleanTitle.length - sourceSuffix.length);
      }

      items.push({
        title: cleanTitle,
        link: clean(link),
        pubDate: formattedDate,
        rawDate: clean(pubDate),
        description: clean(description).replace(/<[^>]*>/g, '').substring(0, 200),
        source: clean(source) || 'AgriNews'
      });
    }

    res.status(200).json({ success: true, count: items.length, articles: items.slice(0, 10) });
  } catch (error) {
    console.error("News fetch failed, providing fallback articles", error);
    res.status(200).json({
      success: false,
      count: fallbackArticles.length,
      articles: fallbackArticles
    });
  }
}

const fallbackArticles = [
  {
    title: "Global Grain Supply Concerns Mount as Dry Weather Grips Eastern Europe",
    source: "AgriMarket Intelligence",
    pubDate: "Today, 14:30 UTC",
    link: "https://www.usda.gov",
    description: "Milling wheat spot premiums on Euronext (MATIF) climbed today as weather models predict continued precipitation deficits in key French and German wheat-growing regions."
  },
  {
    title: "USDA Crop Progress Report: Corn Rated 58% Good/Excellent",
    source: "USDA NASS",
    pubDate: "Yesterday, 20:00 UTC",
    link: "https://quickstats.nass.usda.gov",
    description: "The USDA's weekly report indicates a 3% drop in corn crop conditions due to heat stress across the Eastern Corn Belt, fueling rallies in CBOT front-month contracts."
  },
  {
    title: "Soybean Export Demands Accelerate Despite Logistics Bottlenecks",
    source: "Reuters Agriculture",
    pubDate: "2 days ago",
    link: "https://reuters.com",
    description: "US Gulf export sales of soybeans surged on strong late-season purchases. Freight rates remain highly volatile, squeezing local basis prices for Midwest producers."
  }
];
