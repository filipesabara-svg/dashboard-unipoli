const TOKEN = 'EAAaxoyA8nS4BQx3UmNok5xAWpRZBUzWjKwvSMyvqM9XnMZAz5If7wiZCWIGuDpocoZBo4288JZC3RtiEZCgDw64GhDliNdHYwbRE1STKuhZBSSNSxmfZByjHVcNhfGmmii2wde3HfOGo7YbHvApoh5m4YafnZBp52KZB4Vv0Gm90U6OEeJZCHJmNnHkrjyKxaTckFoVNakkk7j9cscZArA5yA20Yubhgygigo1KK1C12kxiDYZCZCFx38IHdctJaADWmrBmVA36mNuldnbB3eCNS3ESgZDZD';
const ACCOUNT_ID = 'act_1852895338684346';
const API_VERSION = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

async function fetchMeta(path, params = {}) {
  const qs = new URLSearchParams({ access_token: TOKEN, ...params });
  const res = await fetch(`${BASE_URL}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

function getAction(actions, type) {
  if (!actions) return 0;
  const a = actions.find(x => x.action_type === type);
  return a ? parseFloat(a.value) : 0;
}

function getActionValue(action_values, type) {
  if (!action_values) return 0;
  const a = action_values.find(x => x.action_type === type);
  return a ? parseFloat(a.value) : 0;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  try {
    const fields = 'spend,impressions,clicks,ctr,cpc,actions,action_values';

    const campaignInsights = await fetchMeta(`${ACCOUNT_ID}/insights`, {
      level: 'campaign',
      date_preset: 'last_30d',
      fields: `campaign_name,${fields}`,
      limit: 100,
    });

    const dailyInsights = await fetchMeta(`${ACCOUNT_ID}/insights`, {
      date_preset: 'last_30d',
      time_increment: 1,
      fields,
      limit: 100,
    });

    const campaigns = (campaignInsights.data || []).map(c => {
      const spend = parseFloat(c.spend || 0);
      const purchases = getAction(c.actions, 'purchase');
      const leads =
        getAction(c.actions, 'lead') ||
        getAction(c.actions, 'offsite_conversion.lead') ||
        getAction(c.actions, 'onsite_web_lead');
      const revenue = getActionValue(c.action_values, 'purchase');
      const roas = spend > 0 && revenue > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0;
      return {
        name: c.campaign_name,
        spend: parseFloat(spend.toFixed(2)),
        revenue: parseFloat(revenue.toFixed(2)),
        roas,
        purchases: Math.round(purchases),
        leads: Math.round(leads),
        ctr: parseFloat(parseFloat(c.ctr || 0).toFixed(2)),
        cpc: parseFloat(parseFloat(c.cpc || 0).toFixed(2)),
        impressions: parseInt(c.impressions || 0),
        clicks: parseInt(c.clicks || 0),
      };
    });

    const daily = (dailyInsights.data || []).map(d => {
      const [y, m, day] = d.date_start.split('-');
      const purchases = getAction(d.actions, 'purchase');
      const leads =
        getAction(d.actions, 'lead') ||
        getAction(d.actions, 'offsite_conversion.lead') ||
        getAction(d.actions, 'onsite_web_lead');
      const revenue = getActionValue(d.action_values, 'purchase');
      return {
        date: `${day}/${m}`,
        spend: parseFloat(parseFloat(d.spend || 0).toFixed(2)),
        revenue: parseFloat(revenue.toFixed(2)),
        purchases: Math.round(purchases),
        leads: Math.round(leads),
        clicks: parseInt(d.clicks || 0),
        ctr: parseFloat(parseFloat(d.ctr || 0).toFixed(2)),
        impressions: parseInt(d.impressions || 0),
      };
    });

    daily.sort((a, b) => {
      const [da, ma] = a.date.split('/').map(Number);
      const [db, mb] = b.date.split('/').map(Number);
      if (ma !== mb) return ma - mb;
      return da - db;
    });

    res.writeHead(200, corsHeaders());
    res.end(JSON.stringify({ campaigns, daily }));
  } catch (err) {
    res.writeHead(500, corsHeaders());
    res.end(JSON.stringify({ error: err.message }));
  }
}
