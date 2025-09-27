// api/blob-upload.js
import { handleUpload } from '@vercel/blob/client';

// Edge runtime uses the Web Request/Response API
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    // Pass the incoming Web Request straight to handleUpload
    const resp = await handleUpload({
      request: req,
      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        console.log('[blob-upload] token for', pathname);
        return {
          // Broad allow-list so image/png, text/markdown, .py, etc. work
          allowedContentTypes: ['image/*', 'video/*', 'audio/*', 'application/*', 'text/*', '*/*'],
          maximumSizeInBytes: 50 * 1024 * 1024,
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

    // Important: return the Response that @vercel/blob produced
    return resp;
  } catch (err) {
    console.error('[blob-upload] error', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
}
