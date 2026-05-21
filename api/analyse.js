export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      lyrics,
      intent,
      hasRecording,
      recordingName,
      style // 👈 NEW (for AI personalities)
    } = req.body;

    if (!lyrics || !intent) {
      return res.status(400).json({
        error: 'Missing lyrics or intent'
      });
    }

    // -----------------------------
    // 🎭 AI PERSONALITIES
    // -----------------------------
    const personas = {
      pop: `You are a pop songwriting coach. Focus on hooks, catchiness, replay value, and simplicity.`,

      rap: `You are a rap songwriting coach. Focus on flow, rhyme schemes, punchlines, cadence, and wordplay.`,

      indie: `You are an indie songwriting coach. Focus on emotional depth, imagery, vulnerability, and authenticity.`,

      drill: `You are a drill music coach. Focus on energy, rhythm, aggression, and delivery.`,

      default: `You are a brutally honest expert co-writer and music critic.`
    };

    const persona = personas[style] || personas.default;

    // -----------------------------
    // BUILD INPUT
    // -----------------------------
    let content = [];

    if (hasRecording) {
      content.push({
        type: 'text',
        text: `Recording uploaded: "${recordingName}". Factor in vocal delivery, melody, tone and energy.`
      });
    }

    content.push({
      type: 'text',
      text: `LYRICS:\n${lyrics}\n\nINTENT:\n${intent}`
    });

    // -----------------------------
    // SYSTEM PROMPT
    // -----------------------------
    const system = `${persona}

You MUST respond ONLY in valid JSON.

Rules:
- No markdown
- No explanations outside JSON
- No code blocks
- No trailing commas
- Be brutally honest but specific
- Always reference real lyrics when possible

Return EXACT JSON format:

{
  "scores": {
    "lyrics": { "value": 0, "status": "developing" },
    "melody": { "value": 0, "status": "developing" },
    "delivery": { "value": 0, "status": "developing" },
    "structure": { "value": 0, "status": "developing" },
    "goal_alignment": { "value": 0, "status": "developing" }
  },
  "preview": {
    "verdict": "",
    "top_line": "",
    "weak_spot": ""
  },
  "sections": []
}`;

    // -----------------------------
    // CALL CLAUDE
    // -----------------------------
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1400, // 👈 more stable than 2200
        temperature: 0,
        system,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return res.status(500).json({
        error: 'Anthropic API error',
        detail: data
      });
    }

    const raw = data?.content?.map(b => b.text || '').join('') || '';

    // -----------------------------
    // SAFE JSON PARSING
    // -----------------------------
    try {
      const cleaned = raw
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');

      if (start === -1 || end === -1) {
        throw new Error('No JSON found');
      }

      const jsonString = cleaned.slice(start, end + 1);
      const result = JSON.parse(jsonString);

      return res.status(200).json(result);

    } catch (parseError) {
      console.error('PARSE ERROR:', parseError);
      console.error('RAW RESPONSE:', raw);

      return res.status(500).json({
        error: 'Failed to parse AI response',
        raw: raw.substring(0, 3000)
      });
    }

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}
