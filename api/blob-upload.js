// api/blob-upload.js
import { handleUpload } from '@vercel/blob/client';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const resp = await handleUpload({
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        console.log('[blob-upload] token for', pathname);
        return {
          allowedContentTypes: ['image/*', 'video/*', 'audio/*', 'application/*', 'text/*', '*/*'],
          tokenPayload: JSON.stringify({ ts: Date.now() })
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[blob-upload] uploaded', {
          url: blob.url,
          size: blob.size,
          contentType: blob.contentType
        });
      }
    });
    return resp; // MUST return the Response from handleUpload
  } catch (err) {
    console.error('[blob-upload] error', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
}
