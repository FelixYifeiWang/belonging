// api/blob-upload.js
import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        return {
          // Accept all file types (you can later narrow this if you want)
          allowedContentTypes: ['*/*'],
          tokenPayload: JSON.stringify({}) // optional metadata
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[blob-upload] completed', {
          url: blob.url,
          size: blob.size,
          contentType: blob.contentType
        });
      }
    });

    res.status(200).json(jsonResponse);
  } catch (err) {
    console.error('[blob-upload] error', err);
    res.status(400).json({ error: err.message });
  }
}
