export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const symbols = {
    corn: 'ZC=F',
    soy: 'ZS=F',
    wheat: 'ZW=F',
    matif: 'EBM.PA'
  };

  const results = {};

  try {
    for (const [key, symbol] of Object.entries(symbols)) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${symbol}`);
      }
      
      const json = await response.json();
      const result = json.chart?.result?.[0];
      if (result) {
        const meta = result.meta;
        const timestamps = result.timestamp || [];
        const prices = result.indicators?.quote?.[0]?.close || [];
        
        // Filter out null values
        const validData = [];
        for (let i = 0; i < timestamps.length; i++) {
          if (prices[i] !== null && prices[i] !== undefined) {
            validData.push({
              time: timestamps[i],
              price: parseFloat(prices[i].toFixed(2))
            });
          }
        }

        // Calculate daily change
        const currentPrice = meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || currentPrice;
        const change = parseFloat((currentPrice - previousClose).toFixed(2));
        const changePercent = parseFloat(((change / previousClose) * 100).toFixed(2));

        results[key] = {
          symbol,
          name: meta.symbol,
          currentPrice,
          previousClose,
          change,
          changePercent,
          currency: meta.currency,
          history: validData
        };
      }
    }
    
    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    // Return fallback data if Yahoo Finance fails
    console.error("Fetch error:", error);
    return res.status(200).json({
      success: false,
      error: error.message,
      data: getFallbackData()
    });
  }
}

function getFallbackData() {
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 86400;
  
  const generateHistory = (startPrice, volatility) => {
    const history = [];
    let current = startPrice;
    for (let i = 30; i >= 0; i--) {
      current += (Math.random() - 0.48) * volatility;
      history.push({
        time: now - (i * oneDay),
        price: parseFloat(current.toFixed(2))
      });
    }
    return history;
  };

  return {
    corn: {
      symbol: "ZC=F",
      name: "ZC=F",
      currentPrice: 440.75,
      previousClose: 438.50,
      change: 2.25,
      changePercent: 0.51,
      currency: "USD",
      history: generateHistory(440.75, 2)
    },
    soy: {
      symbol: "ZS=F",
      name: "ZS=F",
      currentPrice: 1146.50,
      previousClose: 1139.00,
      change: 7.50,
      changePercent: 0.66,
      currency: "USD",
      history: generateHistory(1146.50, 6)
    },
    wheat: {
      symbol: "ZW=F",
      name: "ZW=F",
      currentPrice: 600.25,
      previousClose: 598.00,
      change: 2.25,
      changePercent: 0.38,
      currency: "USD",
      history: generateHistory(600.25, 4)
    },
    matif: {
      symbol: "EBM.PA",
      name: "EBM.PA",
      currentPrice: 190.25,
      previousClose: 192.15,
      change: -1.90,
      changePercent: -0.98,
      currency: "EUR",
      history: generateHistory(190.25, 1.5)
    }
  };
}
