export const maxDuration = 60;
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  try {
    const { lyrics, intent, hasRecording, recordingName } = req.body;
    if (!lyrics || !intent) return res.status(400).json({ error: 'Missing lyrics or intent' });
 
    let content = [];
    
    content.push({ type: 'text', text: `LYRICS:\n${lyrics}\n\nINTENT:\n${intent}` });
 
    const system = `You are a brutally honest expert co-writer and music critic. Give specific feedback that only applies to THIS song.
 
Rules:
- Quote specific lines when critiquing lyrics
- Never suggest replacement lyrics — diagnose and give direction
- Be honest, do not over-praise
- Measure everything against the songwriter's stated intent
 
Return ONLY valid JSON with NO markdown, NO code blocks, NO extra text. Use this exact structure:
 
{
  "scores": {
    "lyrics": { "value": 7, "status": "developing" },
    "melody": { "value": 6, "status": "developing" },
    "delivery": { "value": 7, "status": "developing" },
    "structure": { "value": 6, "status": "developing" },
    "goal_alignment": { "value": 7, "status": "developing" }
  },
  "preview": {
    "verdict": "Write 2 honest sentences about where this song sits right now.",
    "top_line": "Quote the strongest line and explain why it works.",
    "weak_spot": "Name the weakest element and explain why it hurts the song."
  },
  "sections": [
    {
      "id": "lyrics",
      "title": "Lyric analysis",
      "status": "developing",
      "notes": [
        {
          "quoted_line": "quote a specific line here",
          "observation": "what works or does not work about this line specifically",
          "direction": "what direction to take it — not a rewrite, a path"
        }
      ]
    },
    {
      "id": "arc",
      "title": "Emotional arc",
      "status": "developing",
      "notes": [
        {
          "quoted_line": null,
          "observation": "how the emotion moves or fails to move across the full song",
          "direction": "what to push or pull to strengthen the arc"
        }
      ]
    },
    {
      "id": "attention",
      "title": "Listener attention",
      "status": "developing",
      "notes": [
        {
          "quoted_line": null,
          "observation": "where a real listener would zone out and exactly why",
          "direction": "what would recapture them"
        }
      ]
    },
    {
      "id": "melody",
      "title": "Melody and delivery",
      "status": "developing",
      "notes": [
        {
          "quoted_line": null,
          "observation": "melodic shape, hook strength, where delivery lands or undersells",
          "direction": "how to push the melody or performance further"
        }
      ]
    },
    {
      "id": "structure",
      "title": "Structure and flow",
      "status": "developing",
      "notes": [
        {
          "quoted_line": null,
          "observation": "does the structure serve this song or box it in",
          "direction": "the most valuable structural adjustment"
        }
      ]
    },
    {
      "id": "intent",
      "title": "Goal alignment",
      "status": "developing",
      "notes": [
        {
          "quoted_line": null,
          "observation": "how well the song achieves what the writer said they wanted",
          "direction": "the single most important thing to close the gap"
        }
      ]
    }
  ]
}
 
Replace all placeholder text with real specific feedback. Set accurate scores and statuses. Return only the JSON object.`;
 
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content }]
      })
    });
 
    const data = await response.json();
 
    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic API error', detail: data });
    }
 
    const raw = data?.content?.map(b => b.text || '').join('') || '';
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
 
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'No JSON in response', raw: raw.substring(0, 500) });
    }
 
    const result = JSON.parse(cleaned.slice(start, end + 1));
 
    if (!result.sections || result.sections.length === 0) {
      return res.status(500).json({ error: 'Empty sections', raw: raw.substring(0, 500) });
    }
 
    return res.status(200).json(result);
 
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
