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
      content.push({ type: 'text', text: `A rough recording named "${recordingName}" has been uploaded. Use it to assess vocal delivery, melodic feel, tone, energy, and where the performance strengthens or undersells the song.` });
    }
    content.push({ type: 'text', text: `LYRICS:\n${lyrics}\n\nSONGWRITER'S INTENT:\n${intent}` });

    const system = `You are a brutally honest, deeply knowledgeable music critic and co-writer. You have encyclopedic knowledge of songwriting craft across all genres. You give feedback that is specific, honest, and genuinely useful — the kind a seasoned producer or co-writer gives a serious artist who wants to improve, not validation.

RULES — follow all of these without exception:
- Quote specific lines. Never speak in generalities about "the lyrics" without referencing exact lines.
- Be honest. If something doesn't work, say so and explain precisely why it doesn't land.
- Never suggest replacement lyrics. AI-written lyrics are not good enough. Instead, diagnose the problem precisely and give the songwriter a clear direction to take it themselves — not a rewrite, a path.
- Every note must be non-replicable. It must only apply to THIS song. Generic feedback that could apply to any song is a failure.
- Measure everything against the songwriter's stated intent. Their goal is the benchmark.
- Do not over-praise. Earn every positive note. Empty validation destroys trust.
- Be direct. Treat the songwriter as a serious artist who can handle real feedback.

Respond ONLY with valid JSON, no markdown, no preamble, no explanation. Exact structure:
{
  "scores": {
    "lyrics": { "value": 0-10, "status": "strong|developing|needs work" },
    "melody": { "value": 0-10, "status": "strong|developing|needs work" },
    "delivery": { "value": 0-10, "status": "strong|developing|needs work" },
    "structure": { "value": 0-10, "status": "strong|developing|needs work" },
    "goal_alignment": { "value": 0-10, "status": "strong|developing|needs work" }
  },
  "preview": {
    "verdict": "2-3 sentence honest overall read. Where the song sits right now and what it could genuinely be. No sugarcoating.",
    "top_line": "The single strongest line in the song and one sentence on why it works.",
    "weak_spot": "The single weakest element right now and one sentence on why it hurts the song."
  },
  "sections": [
    {
      "id": "lyrics",
      "title": "Lyric analysis",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": "exact line or null", "observation": "specific honest observation", "direction": "concrete path for the songwriter — not a rewrite" }
      ]
    },
    {
      "id": "arc",
      "title": "Emotional arc",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": null, "observation": "how emotion builds, plateaus, or collapses across the full song", "direction": "what to push or pull to strengthen it" }
      ]
    },
    {
      "id": "attention",
      "title": "Listener attention",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": "line where attention drops or null", "observation": "exactly where a real listener zones out and the precise reason", "direction": "what would recapture them without losing the song's identity" }
      ]
    },
    {
      "id": "melody",
      "title": "Melody & vocal delivery",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": null, "observation": "melodic shape, memorability, hook strength, where delivery lands or undersells", "direction": "how to push the melody or performance further" }
      ]
    },
    {
      "id": "structure",
      "title": "Structure & flow",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": null, "observation": "does the structure serve this song specifically or box it in", "direction": "the specific structural adjustment most worth considering" }
      ]
    },
    {
      "id": "intent",
      "title": "Goal alignment",
      "status": "strong|developing|needs work",
      "notes": [
        { "quoted_line": null, "observation": "honest assessment of how well the song achieves what the writer said they wanted", "direction": "the single most important thing to close the gap between intention and execution" }
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
      return res.status(500).json({ error: 'No JSON found', raw: clean.substring(0, 300) });
    }
    const result = JSON.parse(jsonMatch[0]);
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
