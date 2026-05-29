/**
 * Voz — POST /api/voice/transcribe (Whisper) y /api/voice/synthesize (ElevenLabs).
 *
 * transcribe: multipart (campo "audio") → OpenAI whisper-1 → { text, durationSeconds }.
 *   Protegido por quotaCheck('voice_seconds'): en free (quota 0) devuelve 402.
 *   Tras éxito, recordUsage('voice_seconds', round(duration)).
 *
 * synthesize: { text } → ElevenLabs (voz Elisa María, eleven_v3) → audio/mpeg.
 *   No consume cuota de voz (la voz que cuenta es el habla del usuario en
 *   transcribe); recorta textos muy largos para no abusar de TTS.
 *
 * Reutiliza la lógica probada de V1 (nexus/src/routes/voiceRouter.ts),
 * parametrizada por env y por usuario (voice_id de user_settings si existe).
 *
 * TODO-DEUDA(voice-stream): synthesize podría hacer streaming chunked en vez de
 *  bufferizar; suficiente para Hito 1.
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { quotaCheck, recordUsage } from '../middleware/quota.js';
import { env } from '../lib/env.js';
import { db } from '../db/index.js';
import { userSettings } from '../db/schema.js';

export const voiceRouter = Router();

voiceRouter.use(authJwt, tenantContext);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

// Tope defensivo de caracteres para TTS (evita abusar de ElevenLabs).
const MAX_TTS_CHARS = 2500;

// ── Transcribe (Whisper) ────────────────────────────────────────────────────
voiceRouter.post(
  '/transcribe',
  quotaCheck('voice_seconds'),
  upload.single('audio'),
  async (req: Request, res: Response) => {
    if (!env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'OPENAI_API_KEY no configurada.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Falta el archivo de audio (campo multipart "audio").' });
      return;
    }
    try {
      const form = new FormData();
      const blob = new Blob([new Uint8Array(req.file.buffer)], {
        type: req.file.mimetype || 'audio/webm',
      });
      form.append('file', blob, req.file.originalname || 'audio.webm');
      form.append('model', 'whisper-1');
      form.append('response_format', 'verbose_json');
      const lang = typeof req.body?.language === 'string' ? req.body.language : 'es';
      if (lang) form.append('language', lang);

      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: form,
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        res.status(502).json({ error: `Whisper HTTP ${r.status}`, detail: detail.slice(0, 500) });
        return;
      }
      const data = (await r.json()) as { text?: string; language?: string; duration?: number };
      const durationSeconds = Math.max(0, Math.round(Number(data?.duration ?? 0)));

      if (durationSeconds > 0) {
        await recordUsage(req.tenant!.orgId, req.tenant!.tier, 'voice_seconds', durationSeconds);
      }

      res.json({
        text: String(data?.text ?? '').trim(),
        language: data?.language,
        durationSeconds,
      });
    } catch (err) {
      console.error('[voice] transcribe error:', err);
      res.status(500).json({ error: 'No se pudo transcribir el audio.' });
    }
  }
);

// ── Synthesize (ElevenLabs Elisa María, eleven_v3) ───────────────────────────
voiceRouter.post('/synthesize', async (req: Request, res: Response) => {
  if (!env.ELEVENLABS_API_KEY) {
    res.status(500).json({ error: 'ELEVENLABS_API_KEY no configurada.' });
    return;
  }
  const raw = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!raw) {
    res.status(400).json({ error: 'Falta el texto a sintetizar.' });
    return;
  }
  const text = raw.length > MAX_TTS_CHARS ? raw.slice(0, MAX_TTS_CHARS) : raw;

  // voice_id: el del usuario (user_settings) si está, si no el de env.
  let voiceId = env.ELEVENLABS_VOICE_ID;
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, req.tenant!.userId))
    .limit(1);
  if (settings?.voiceId && settings.voiceId !== 'elisa-maria') {
    voiceId = settings.voiceId; // si guardaron un id real de ElevenLabs
  }

  try {
    // optimize_streaming_latency=3 reduce el time-to-first-byte del TTS.
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=3`, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: env.ELEVENLABS_MODEL_ID,
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.8,
          style: 0.4,
          use_speaker_boost: true,
        },
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      res.status(502).json({ error: `ElevenLabs HTTP ${r.status}`, detail: detail.slice(0, 500) });
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(buf);
  } catch (err) {
    console.error('[voice] synthesize error:', err);
    res.status(500).json({ error: 'No se pudo generar el audio.' });
  }
});
