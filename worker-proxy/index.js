// linxai-proxy — Cloudflare Worker that proxies Groq API calls
// API key stored as a secret (GROQ_API_KEY), never exposed to the client

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'

// Simple in-memory rate limiter per IP (resets on worker cold start)
const rateMap = new Map()
const RATE_LIMIT = 20      // max requests
const RATE_WINDOW = 60_000 // per 60 seconds

function isRateLimited(ip) {
  const now = Date.now()
  let entry = rateMap.get(ip)
  if (!entry || now - entry.start > RATE_WINDOW) {
    entry = { start: now, count: 1 }
    rateMap.set(ip, entry)
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT
}

function corsHeaders(origin, allowedOrigin) {
  const isAllowed =
    origin === allowedOrigin ||
    origin === 'http://localhost:5500' ||
    origin === 'http://127.0.0.1:5500' ||
    origin?.startsWith('http://localhost:')
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN)

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // Only POST allowed
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })
    }

    // Rate limit by IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
    if (isRateLimited(ip)) {
      return Response.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429, headers: cors }
      )
    }

    try {
      const body = await request.json()

      // Sanitize: only allow expected fields
      const payload = {
        model: body.model || 'llama-3.3-70b-versatile',
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: Math.min(body.max_tokens || 2048, 4096),
        stream: false,
      }

      const groqRes = await fetch(GROQ_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await groqRes.text()
      return new Response(data, {
        status: groqRes.status,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
        },
      })
    } catch (err) {
      return Response.json(
        { error: 'Proxy error', detail: err.message },
        { status: 500, headers: cors }
      )
    }
  },
}
