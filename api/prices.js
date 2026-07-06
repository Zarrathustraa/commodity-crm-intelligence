
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const databentoApiKey = process.env.DATABENTO_API_KEY || 'db-jy7TNdxEWARYU46EvpifL9JvDupTA';
  const authHeader = 'Basic ' + Buffer.from(databentoApiKey + ':').toString('base64');

  // Compute dates for 30 days window in 2026
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const formatDate = (date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}T00:00:00`;
  };

  const startStr = formatDate(thirtyDaysAgo);
  const endStr = formatDate(today);

  const results = {};

  // 1. Fetch from Databento for ZC.c.0 (Corn), ZS.c.0 (Soy), ZW.c.0 (Wheat)
  const dbSymbols = {
    corn: 'ZC.c.0',
    soy: 'ZS.c.0',
    wheat: 'ZW.c.0'
  };

  for (const [key, dbSym] of Object.entries(dbSymbols)) {
    try {
      const url = `https://hist.databento.com/v0/timeseries.get_range?dataset=GLBX.MDP3&schema=ohlcv-1d&stype_in=continuous&symbols=${dbSym}&start=${startStr}&end=${endStr}&encoding=json`;
      const response = await fetch(url, {
        headers: { 'Authorization': authHeader }
      });

      if (!response.ok) {
        throw new Error(`Databento response error: ${response.status}`);
      }

      const text = await response.text();
      const lines = text.trim().split('\n').filter(Boolean);
      
      if (lines.length === 0) {
        throw new Error('No data returned from Databento');
      }

      const history = [];
      for (const line of lines) {
        const item = JSON.parse(line);
        const tsSeconds = Number(BigInt(item.hd.ts_event) / 1000000000n);
        const price = parseFloat(item.close) / 1000000000;
        history.push({ time: tsSeconds, price: price });
      }

      // Sort history by time
      history.sort((a, b) => a.time - b.time);

      const currentPrice = history[history.length - 1].price;
      const previousClose = history.length > 1 ? history[history.length - 2].price : currentPrice;
      const change = currentPrice - previousClose;
      const changePercent = (change / previousClose) * 100;

      results[key] = {
        symbol: dbSym,
        name: key.toUpperCase(),
        currentPrice,
        previousClose,
        change,
        changePercent,
        currency: 'USD',
        history
      };
    } catch (err) {
      console.error(`Databento failed for ${key}, falling back to Yahoo Finance`, err);
      // Fallback to Yahoo Finance
      try {
        const ySym = key === 'corn' ? 'ZC=F' : (key === 'soy' ? 'ZS=F' : 'ZW=F');
        const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ySym}?interval=1d&range=1mo`;
        const response = await fetch(yUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const json = await response.json();
        const chartData = json.chart.result[0];
        const quote = chartData.indicators.quote[0];
        const timestamps = chartData.timestamp;

        const history = [];
        for (let i = 0; i < timestamps.length; i++) {
          if (quote.close[i] !== null) {
            history.push({ time: timestamps[i], price: quote.close[i] });
          }
        }

        const currentPrice = chartData.meta.regularMarketPrice;
        const previousClose = chartData.meta.chartPreviousClose;
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;

        results[key] = {
          symbol: ySym,
          name: key.toUpperCase(),
          currentPrice,
          previousClose,
          change,
          changePercent,
          currency: 'USD',
          history
        };
      } catch (yErr) {
        console.error(`Yahoo fallback failed for ${key}, using simulated data`, yErr);
        // Deep Simulated Fallback
        results[key] = generateSimulatedHistory(key);
      }
    }
  }

  // 2. Fetch from Yahoo Finance for MATIF (EBM.PA)
  try {
    const matifSymbol = 'EBM.PA';
    const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${matifSymbol}?interval=1d&range=1mo`;
    const response = await fetch(yUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await response.json();
    const chartData = json.chart.result[0];
    const quote = chartData.indicators.quote[0];
    const timestamps = chartData.timestamp;

    const history = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.close[i] !== null) {
        history.push({ time: timestamps[i], price: quote.close[i] });
      }
    }

    const currentPrice = chartData.meta.regularMarketPrice;
    const previousClose = chartData.meta.chartPreviousClose;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    results['matif'] = {
      symbol: matifSymbol,
      name: 'MATIF WHEAT',
      currentPrice,
      previousClose,
      change,
      changePercent,
      currency: 'EUR',
      history
    };
  } catch (err) {
    console.error(`MATIF fetch failed, using simulated data`, err);
    results['matif'] = generateSimulatedHistory('matif');
  }

  res.status(200).json({ success: true, data: results });
}

function generateSimulatedHistory(key) {
  let basePrice, volatility;
  if (key === 'corn') { basePrice = 430; volatility = 3; }
  else if (key === 'soy') { basePrice = 1130; volatility = 8; }
  else if (key === 'wheat') { basePrice = 590; volatility = 5; }
  else { basePrice = 245; volatility = 2; } // matif

  const history = [];
  const now = Math.floor(Date.now() / 1000);
  let currentPrice = basePrice;

  for (let i = 30; i >= 0; i--) {
    const time = now - i * 24 * 60 * 60;
    const change = (Math.random() - 0.49) * volatility;
    currentPrice = parseFloat((currentPrice + change).toFixed(2));
    history.push({ time, price: currentPrice });
  }

  const currentPriceFinal = history[history.length - 1].price;
  const previousClose = history[history.length - 2].price;
  const change = currentPriceFinal - previousClose;
  const changePercent = (change / previousClose) * 100;

  return {
    symbol: key.toUpperCase() + '-SIM',
    name: key.toUpperCase(),
    currentPrice: currentPriceFinal,
    previousClose,
    change,
    changePercent,
    currency: key === 'matif' ? 'EUR' : 'USD',
    history
  };
}
