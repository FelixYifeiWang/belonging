import { Client } from 'pg';

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

    const { rows } = await client.query(
      `insert into cultures (participant_name, participant_email, signature_url, explanation)
       values ($1,$2,$3,$4)
       returning id`,
      [participantName, participantEmail, signatureUrl, explanation]
    );
    const cultureId = rows[0].id;

    for (const m of members) {
      if (!m.name || !m.email) continue;
      await client.query(
        `insert into culture_members (culture_id, member_name, member_email)
         values ($1,$2,$3)`,
        [cultureId, m.name, m.email]
      );
    }

    for (const f of files) {
      await client.query(
        `insert into culture_files (culture_id, file_url, file_name, content_type, size_bytes)
         values ($1,$2,$3,$4,$5)`,
        [cultureId, f.url, f.name || null, f.contentType || null, f.size ?? null]
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ ok: true, cultureId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    await client.end();
  }
}
