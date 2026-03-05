const https = require('https');

module.exports = async function (context, req) {
  const { imageBase64, mediaType } = req.body || {};

  if (!imageBase64) {
    context.res = { status: 400, body: { error: 'No image provided' } };
    return;
  }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType || 'image/jpeg',
            data: imageBase64
          }
        },
        {
          type: 'text',
          text: `Extract details from this business card. Reply ONLY with a JSON object, no extra text:
{
  "name": "full name",
  "company": "company name",
  "designation": "job title",
  "phone": "phone number (prefer mobile)",
  "email": "email address",
  "linkedin": "linkedin url if visible or empty string"
}
If a field is not found, use empty string "".`
        }
      ]
    }]
  });

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const request = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('Invalid JSON from Anthropic')); }
        });
      });
      request.on('error', reject);
      request.write(payload);
      request.end();
    });

    const text = result.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: parsed
    };
  } catch (e) {
    context.res = {
      status: 500,
      body: { error: e.message }
    };
  }
};