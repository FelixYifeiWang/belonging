import { Client } from 'pg';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function evaluateCulture({ participantName, participantEmail, explanation, members, files }) {
  const sys = `You are a careful but pragmatic reviewer for a community registry.
Decide if the submission qualifies as a "Culture" for our platform.

Return strict JSON:
{
  "qualifies": true | false,
  "score": number (0-100),
  "category": "Culture" | "Proto-Culture" | "Sub-Culture",
  "rationale": "short clear reason (1-3 sentences)"
}`;

  const user = {
    participantName,
    participantEmail,
    explanation,
    members: members?.map(m => ({ name: m?.name, email: m?.email })) ?? [],
    files: files?.map(f => ({ name: f?.name, url: f?.url, type: f?.contentType, size: f?.size })) ?? []
  };

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: JSON.stringify(user) }
    ]
  });

  let json = {};
  try {
    json = JSON.parse(resp.choices?.[0]?.message?.content || "{}");
  } catch {}
  // sane defaults if model output was off-spec
  return {
    qualifies: !!json.qualifies,
    score: Math.max(0, Math.min(100, Number(json.score) || 0)),
    category: ["Culture","Proto-Culture","Sub-Culture"].includes(json.category) ? json.category : "Proto-Culture",
    rationale: (json.rationale || "No rationale provided.").toString().slice(0, 1000)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    participantName,
    participantEmail,
    explanation,
    signatureUrl,
    files = [],
    members = []
  } = req.body || {};

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1) Create the culture
    const { rows } = await client.query(
      `insert into cultures (participant_name, participant_email, signature_url, explanation)
       values ($1,$2,$3,$4)
       returning id`,
      [participantName, participantEmail, signatureUrl, explanation]
    );
    const cultureId = rows[0].id;

    // 2) Merge main participant + invited members (dedupe by email)
    const norm = e => (e || '').trim().toLowerCase();
    const all = [
      { name: participantName, email: participantEmail },
      ...members.filter(m => m && m.name && m.email)
    ];
    const seen = new Set();
    const finalMembers = [];
    for (const m of all) {
      const key = norm(m.email);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      finalMembers.push({ name: m.name, email: m.email });
    }

    // 3) Insert members
    for (const m of finalMembers) {
      await client.query(
        `insert into culture_members (culture_id, member_name, member_email)
         values ($1,$2,$3)`,
        [cultureId, m.name, m.email]
      );
    }

    // 4) Insert files
    for (const f of files) {
      await client.query(
        `insert into culture_files (culture_id, file_url, file_name, content_type, size_bytes)
         values ($1,$2,$3,$4,$5)`,
        [cultureId, f.url, f.name || null, f.contentType || null, f.size ?? null]
      );
    }

    await client.query('COMMIT');

    // 5) GPT review (runs after DB writes to reduce rollback complexity)
    let review = { qualifies: false, score: 0, category: "Proto-Culture", rationale: "Unavailable." };
    try {
      review = await evaluateCulture({
        participantName,
        participantEmail,
        explanation,
        members: finalMembers,
        files
      });
    } catch (e) {
      // don’t fail the request if GPT hiccups
      console.error("GPT review error:", e);
    }

    // Optional: persist the review (uncomment after adding a table/columns)
    await client.query(
      `insert into culture_reviews (culture_id, qualifies, score, category, rationale)
       values ($1,$2,$3,$4,$5)`,
      [cultureId, review.qualifies, review.score, review.category, review.rationale]
    );

    res.status(200).json({ ok: true, cultureId, review });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    await client.end();
  }
}
