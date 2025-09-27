// api/blob-upload.js
import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Build a WHATWG Request from the Node req
    const url = `https://${req.headers.host}${req.url}`;
    const webRequest = new Request(url, {
      method: req.method,
      headers: req.headers, // headers is fine; Vercel normalizes them
      body: req,            // pass the raw stream body through
      duplex: 'half'        // needed by some runtimes for streamy bodies
    });

    // Let @vercel/blob generate a client token & handle policy
    const upstream = await handleUpload({
      request: webRequest,
      onBeforeGenerateToken: async (pathname) => {
        console.log('[blob-upload] token for', pathname);
        return {
          // Be permissive while debugging; tighten later
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

    // Proxy the Response from handleUpload back to the client
    const body = await upstream.text();
    res.status(upstream.status);
    upstream.headers.forEach((v, k) => res.setHeader(k, v));
    res.send(body);
  } catch (err) {
    console.error('[blob-upload] error', err);
    res.status(400).json({ error: err.message });
  }
}
