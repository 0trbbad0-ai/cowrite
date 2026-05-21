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
    const { lyrics, intent, hasRecording, recordingName } = req.body;

    if (!lyrics || !intent) {
      return res.status(400).json({
        error: 'Missing lyrics or intent'
      });
    }

    let content = [];

    if (hasRecording) {
      content.push({
        type: 'text',
        text: `Recording uploaded: "${recordingName}". Factor in vocal delivery, melody, tone and energy in your feedback.`
      });
    }

    content.push({
      type: 'text',
      text: `LYRICS:\n${lyrics}\n\nINTENT:\n${intent}`
    });

    const system = `You are a brutally honest, expert co-writer and music critic.

Give specific, non-generic feedback on THIS exact song only.

IMPORTANT:
- Return ONLY valid JSON
- No markdown
- No code blocks
- No commentary outside JSON
- Escape quotes properly
- Never use trailing commas

JSON format:
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2200,
        temperature: 0,
        system,
        messages: [
          {
            role: 'user',
            content
          }
        ]
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

    const raw =
      data?.content
        ?.map(block => block.text || '')
        .join('') || '';

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
        raw: raw.substring(0, 4000)
      });
    }

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}
