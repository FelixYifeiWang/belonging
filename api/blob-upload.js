// api/blob-upload.js
import { handleUpload } from '@vercel/blob/client';

// IMPORTANT for handleUpload to read the raw request
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const json = await handleUpload({
      request: req,
      onBeforeGenerateToken: async (pathname /*, reqLike */) => {
        console.log('[blob-upload] generate token for', pathname);
        return {
          // Be permissive (includes image/png, text/markdown, etc.)
          allowedContentTypes: ['image/*', 'video/*', 'audio/*', 'application/*', 'text/*', '*/*'],
          tokenPayload: JSON.stringify({ ts: Date.now() }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[blob-upload] completed', {
          url: blob.url,
          contentType: blob.contentType,
          size: blob.size,
        });
      },
    });

    res.status(200).json(json);
  } catch (err) {
    console.error('[blob-upload] error', err);
    res.status(400).json({ error: err.message });
  }
}
