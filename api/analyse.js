export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { lyrics, intent, hasRecording, recordingName } = req.body;

    if (!lyrics || !intent) {
      return res.status(400).json({ error: 'Missing lyrics or intent' });
    }

    let content = [];
    if (hasRecording) {
      content.push({ type: 'text', text: `Recording uploaded: "${recordingName}". Factor in vocal delivery, melody, tone and energy in your feedback.` });
    }
    content.push({ type: 'text', text: `LYRICS:\n${lyrics}\n\nINTENT:\n${intent}` });

    const system = `You are a brutally honest, expert co-writer and music critic. Give specific, non-replicable feedback on this song. Every note must apply to THIS song only — no generic advice.

Rules:
- Quote specific lines when referencing lyrics
- Be honest — don't validate lazily
- Never suggest replacement lyrics — diagnose and give direction instead
- Measure everything against the songwriter's stated intent
- Keep each observation concise but specific

Respond ONLY with this exact JSON structure, no markdown, no extra text:
{
  "scores": {
    "lyrics": { "value": 0-10, "status": "strong|developing|needs work" },
    "melody": { "value": 0-10, "status": "strong|developing|needs work" },
    "delivery": { "value": 0-10, "status": "strong|developing|needs work" },
    "structure": { "value": 0-10, "status": "strong|developing|needs work" },
    "goal_alignment": { "value": 0-10, "status": "strong|developing|needs work" }
  },
  "preview": {
    "verdict": "2 sentence honest overall read of the song.",
    "top_line": "Strongest line and one sentence why.",
    "weak_spot": "Weakest element and one sentence why."
  },
  "sections": [
    {
      "id": "lyrics",
      "title": "Lyric analysis",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": "exact line or null", "observation": "specific observation — 1-2 sentences", "direction": "clear direction for the songwriter — 1 sentence" }
      ]
    },
    {
      "id": "arc",
      "title": "Emotional arc",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": null, "observation": "how emotion moves across the song — 1-2 sentences", "direction": "what to push or pull — 1 sentence" }
      ]
    },
    {
      "id": "attention",
      "title": "Listener attention",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": "line where attention drops or null", "observation": "where and why a listener zones out — 1-2 sentences", "direction": "how to recapture them — 1 sentence" }
      ]
    },
    {
      "id": "melody",
      "title": "Melody & vocal delivery",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": null, "observation": "melodic shape, hook strength, delivery — 1-2 sentences", "direction": "how to push it further — 1 sentence" }
      ]
    },
    {
      "id": "structure",
      "title": "Structure & flow",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": null, "observation": "does the structure serve the song — 1-2 sentences", "direction": "most valuable structural adjustment — 1 sentence" }
      ]
    },
    {
      "id": "intent",
      "title": "Goal alignment",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": null, "observation": "how well song achieves stated intent — 1-2 sentences", "direction": "single most important thing to close the gap — 1 sentence" }
      ]
    }
  ]
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
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'API error', detail: data });
    }

    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ debug: 'no_match', raw: clean.substring(0, 500) });
    }
    try {
      const result = JSON.parse(jsonMatch[0]);
      return res.status(200).json(result);
    } catch(parseErr) {
      return res.status(200).json({ debug: 'parse_failed', raw: jsonMatch[0].substring(0, 500) });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
