import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'image/png','image/jpeg','image/webp','image/gif',
          'application/pdf','text/plain','audio/*','video/*',
          'application/zip','application/octet-stream'
        ],
        tokenPayload: JSON.stringify({})
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('Blob uploaded:', blob.url);
      }
    });
    res.status(200).json(jsonResponse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}