const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype))
});

// GitHub Pages e Vercel ficam em origens diferentes.
// Liberamos somente o site oficial para chamar a API pelo navegador.
const ALLOWED_ORIGINS = new Set([
  'https://studioinfinityia.github.io',
  'https://criesuafoto.vercel.app'
]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = Buffer.from(buf); }
}));
app.use(express.static(__dirname));

const BUCKET = 'studio-infinity-images';
const OPENAI_MODEL = 'gpt-image-2.5-sunburst';

const THEME_PROMPTS = {
  familia: 'Create a premium, natural family studio portrait. Preserve every person from the input exactly: identity, face, facial features, skin tone, hair, apparent age and expression. Improve only lighting, wardrobe coordination, composition and professional studio environment. Photorealistic, natural proportions, no artificial-looking skin.',
  aniversario: 'Create a premium birthday photo session based on the selected birthday concept. Preserve the subject identity, face, facial features, skin tone, hair, expression and proportions. Add an elegant themed birthday setting with tasteful decorations and a professional photographic finish. Photorealistic and natural.',
  hulk: 'Create a child-friendly green superhero-inspired birthday or monthly milestone photo session, with green and purple decor, playful comic energy and premium studio photography. Do not copy protected logos or exact character artwork. Preserve the baby or child identity, face, facial features, skin tone, hair, expression and proportions exactly.',
  bezerrinho: 'Create a delicate baby calf/farm themed milestone studio photo in neutral beige, brown and soft black-and-white details. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Cute, realistic props, premium newborn photography, natural lighting.',
  velozes: 'Create a child-friendly cinematic street-racing inspired milestone photo session with tasteful cars, racing details and dramatic but realistic studio lighting. Do not reproduce movie logos or copyrighted character likenesses. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly.',
  'toy-story': 'Create a playful toy-room inspired baby milestone photo with colorful classic toy motifs, clouds, stars and friendly original toy-like props. Do not reproduce copyrighted characters or logos. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Premium realistic studio photography.',
  'pequeno-principe': 'Create a poetic little-prince-inspired baby milestone portrait with navy blue, gold stars, a tiny planet, crown motifs and dreamy storybook atmosphere, without reproducing copyrighted illustrations. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Photorealistic premium studio image.',
  goku: 'Create a child-friendly martial-arts adventure inspired birthday photo session with orange and blue clothing cues, glowing spheres and energetic sky details, without copying copyrighted characters, logos or exact costumes. Preserve the child identity, face, facial features, skin tone, hair, expression and proportions exactly. Photorealistic.',
  safari: 'Create a warm premium safari baby milestone studio photo with soft realistic plush animals, foliage, beige, green and earthy tones. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Natural newborn photography, soft light, tasteful composition.',
  'sao-francisco': 'Create a delicate Saint Francis inspired baby milestone portrait with warm earthy tones, flowers, subtle nature and peaceful faith-inspired elements. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Photorealistic premium studio photography.',
  cerejinha: 'Create a cherry-themed baby milestone studio portrait with red, white and soft green palette, plush cherry props, gingham details and an elegant cozy setup. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Photorealistic, natural newborn photography.',
  'pequena-sereia': 'Create a whimsical under-the-sea inspired baby milestone portrait with shells, pearls, soft aqua, lilac and coral tones and original mermaid-inspired decor. Do not reproduce copyrighted characters. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Photorealistic.',
  bezerrinha: 'Create a cute pink baby calf/farm themed milestone studio photo with pink, white, black and soft cow-print accents, tasteful plush farm props and premium newborn styling. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Photorealistic and natural.',
  frozen: 'Create a magical winter-princess inspired baby milestone portrait in icy blue, white and silver with snowflakes and elegant frozen scenery, without reproducing copyrighted characters or logos. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Photorealistic premium studio photography.'
};

function envReady() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sbHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ...extra
  };
}

function storageUrl(objectPath) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
}

async function storageUpload(objectPath, buffer, contentType, upsert = false) {
  const r = await fetch(storageUrl(objectPath), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': contentType, 'x-upsert': upsert ? 'true' : 'false' }),
    body: buffer
  });
  if (!r.ok) throw new Error(`Supabase upload: ${r.status} ${await r.text()}`);
}

async function storageGet(objectPath) {
  const r = await fetch(storageUrl(objectPath), { headers: sbHeaders() });
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw new Error(`Supabase read: ${r.status} ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}

async function signedUrl(objectPath, expiresIn = 1800) {
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn })
  });
  if (!r.ok) throw new Error(`Supabase signed URL: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const p = j.signedURL || j.signedUrl;
  return p.startsWith('http') ? p : `${process.env.SUPABASE_URL}/storage/v1${p}`;
}

async function saveOrder(order) {
  await storageUpload(`orders/${order.id}.json`, Buffer.from(JSON.stringify(order)), 'application/json', true);
}

async function loadOrder(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return null;
  const b = await storageGet(`orders/${id}.json`);
  if (!b) return null;
  try { return JSON.parse(b.toString('utf8')); } catch { return null; }
}

function clientFingerprint(req, deviceId) {
  const raw = `${String(deviceId || '').slice(0, 120)}|${req.headers['user-agent'] || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function createWatermarkedPreview(imageBuffer) {
  // A marca d'água é incorporada aos pixels; bloquear clique direito sozinho não protege a imagem.
  const base = sharp(imageBuffer).resize({ width: 800, height: 1000, fit: 'cover' });
  const logoPath = path.join(__dirname, 'logo.jpeg');
  let logoData = '';
  try { logoData = `data:image/jpeg;base64,${require('fs').readFileSync(logoPath).toString('base64')}`; } catch {}
  const width = 800, height = 1000;
  const rows = [];
  for (let y = -100; y < 1120; y += 125) {
    rows.push(`<text x="-180" y="${y}" font-size="31" font-family="Arial,sans-serif" font-weight="800" letter-spacing="2" fill="rgba(255,255,255,.48)" stroke="rgba(0,0,0,.22)" stroke-width="1">STUDIO INFINITY IA  •  PRÉVIA  •  STUDIO INFINITY IA  •  PRÉVIA</text>`);
  }
  const logos = logoData ? [110,350,590,830].map((y,i)=>`<image href="${logoData}" x="${i%2?500:95}" y="${y}" width="150" height="150" opacity=".27" preserveAspectRatio="xMidYMid slice"/>`).join('') : '';
  const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-27 ${width/2} ${height/2})">${rows.join('')}</g>${logos}<rect x="0" y="925" width="800" height="75" fill="rgba(5,8,23,.72)"/><text x="400" y="970" text-anchor="middle" font-size="24" font-family="Arial,sans-serif" font-weight="800" fill="white">PRÉVIA • PAGUE SOMENTE SE GOSTAR</text></svg>`);
  return base.composite([{ input: svg, blend: 'over' }]).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
}

function buildPrompt(body) {
  const base = THEME_PROMPTS[body.theme];
  if (!base) throw new Error('Tema não disponível para geração automática.');
  const name = String(body.babyName || '').trim().slice(0, 40);
  const months = Math.max(1, Math.min(36, Number(body.babyMonths || 0)));
  const notes = String(body.photoNotes || '').trim().slice(0, 500);
  const additions = [];
  if (body.cake === '1') additions.push('Inclua um bolo temático elegante e minimalista, integrado naturalmente ao cenário.');
  const people = Math.max(0, Math.min(3, Number(body.extraPeople || 0)));
  if (people) additions.push(`A composição pode incluir até ${people} pessoa(s) adicional(is), mas nunca invente a identidade de uma pessoa real sem foto de referência.`);
  if (notes) additions.push(`Preferências específicas da cliente: ${notes}. Siga-as quando forem compatíveis com uma fotografia natural e segura.`);
  return `EDITE a fotografia enviada e transforme-a em um ensaio fotográfico profissional. ${base}
REGRAS OBRIGATÓRIAS:
- Estética padrão Studio Infinity IA: MINIMALISTA, elegante, natural, ultrarrealista, poucos elementos, cenário limpo e acabamento premium.
- Composição vertical EXATAMENTE em proporção 4:5.
- Preserve com máxima fidelidade a identidade, o rosto, os traços faciais, tom de pele, cabelo, expressão e proporções da pessoa da foto de referência. Anatomia realista e textura natural de pele; sem aparência artificial de IA.
- O nome do bebê é "${name}" e está fazendo ${months} ${months === 1 ? 'mês' : 'meses'}.
- Se houver QUALQUER texto visível na imagem (nome, idade, placa, letreiro, bolo ou decoração), escreva SOMENTE em PORTUGUÊS DO BRASIL. Nunca gere palavras em inglês. Use exatamente o nome "${name}" e, quando a idade aparecer, use "${months} ${months === 1 ? 'mês' : 'meses'}".
- Não adicione marca-d'água; ela será aplicada pelo sistema depois.
- Não mostre equipamentos de estúdio.
${additions.join('\n')}`;
}

async function callOpenAIEdit(file, prompt) {
  const fd = new FormData();
  fd.append('model', OPENAI_MODEL);
  fd.append('image[]', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'input.jpg');
  fd.append('prompt', prompt);
  fd.append('size', '1024x1280');
  fd.append('quality', 'max');
  fd.append('output_format', 'jpeg');
  fd.append('output_compression', '94');
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd
  });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = null; }
  if (!r.ok) {
    const msg = j?.error?.message || `OpenAI retornou ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error('A OpenAI não retornou a imagem gerada.');
  return { buffer: Buffer.from(b64, 'base64'), usage: j.usage || null };
}

app.get('/api/health', async (_req, res) => {
  const result = { server: true, openaiKey: Boolean(process.env.OPENAI_API_KEY), supabase: false, bucket: BUCKET };
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json(result);
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, { headers: sbHeaders() });
    result.supabase = r.ok;
    return res.status(result.openaiKey && result.supabase ? 200 : 503).json(result);
  } catch { return res.status(503).json(result); }
});

app.post('/api/generate', upload.single('image'), async (req, res) => {
  let orderId = null;
  try {
    if (!envReady()) return res.status(503).json({ error: 'Integração ainda não está configurada no servidor.' });
    if (!req.file) return res.status(400).json({ error: 'Selecione uma foto.' });
    if (!req.body.theme || req.body.theme === 'outros') return res.status(400).json({ error: 'Para temas personalizados, fale conosco no WhatsApp.' });
    if (!THEME_PROMPTS[req.body.theme]) return res.status(400).json({ error: 'Este tema ainda não está habilitado para prévia automática.' });
    if (!String(req.body.babyName || '').trim()) return res.status(400).json({ error: 'Informe o nome do bebê.' });
    if (!Number(req.body.babyMonths || 0)) return res.status(400).json({ error: 'Informe quantos meses o bebê está fazendo.' });

    const deviceId = String(req.body.deviceId || '');
    if (deviceId.length < 12) return res.status(400).json({ error: 'Atualize a página e tente novamente.' });
    const fingerprint = clientFingerprint(req, deviceId);
    const markerPath = `preview-limits/${fingerprint}.json`;
    const existing = await storageGet(markerPath);
    if (existing) return res.status(429).json({ error: 'A prévia gratuita deste dispositivo já foi utilizada. Para outro tema ou ajustes, fale conosco no WhatsApp.' });

    const requestedOrderId = String(req.body.orderId || '');
    orderId = /^[0-9a-f-]{36}$/i.test(requestedOrderId) ? requestedOrderId : crypto.randomUUID();
    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const inputPath = `orders/${orderId}/input.${ext}`;
    const originalPath = `orders/${orderId}/original.jpg`;
    const previewPath = `orders/${orderId}/preview.jpg`;

    await storageUpload(inputPath, req.file.buffer, req.file.mimetype);
    const order = {
      id: orderId,
      created_at: new Date().toISOString(),
      status: 'generating',
      payment_status: 'pending',
      gender: req.body.gender || null,
      baby_name: String(req.body.babyName || '').trim().slice(0, 40),
      baby_months: Number(req.body.babyMonths || 0),
      photo_notes: String(req.body.photoNotes || '').trim().slice(0, 500),
      theme: req.body.theme,
      theme_name: req.body.themeName || req.body.theme,
      photos: Number(req.body.photos || 1),
      cake: req.body.cake === '1',
      extra_people: Number(req.body.extraPeople || 0),
      total: Number(req.body.total || 0),
      input_path: inputPath,
      original_path: originalPath,
      preview_path: previewPath
    };
    await saveOrder(order);

    const prompt = buildPrompt(req.body);
    const generated = await callOpenAIEdit(req.file, prompt);
    await storageUpload(originalPath, generated.buffer, 'image/jpeg');
    const previewBuffer = await createWatermarkedPreview(generated.buffer);
    await storageUpload(previewPath, previewBuffer, 'image/jpeg');

    order.status = 'preview_ready';
    order.generated_at = new Date().toISOString();
    if (generated.usage) order.openai_usage = generated.usage;
    await saveOrder(order);
    await storageUpload(markerPath, Buffer.from(JSON.stringify({ order_id: orderId, created_at: order.created_at })), 'application/json', true);

    const previewUrl = await signedUrl(previewPath, 60 * 60);
    return res.json({ orderId, previewUrl });
  } catch (e) {
    console.error('generate error', e);
    let message = 'Não foi possível criar sua prévia agora. Tente novamente em alguns instantes.';
    if (e.status === 429) message = 'A geração está temporariamente no limite. Tente novamente em alguns minutos.';
    if (/billing|credit|quota|insufficient/i.test(e.message || '')) message = 'A geração de imagens ainda não está liberada nesta conta. Fale conosco no WhatsApp enquanto finalizamos a ativação.';
    if (/verification/i.test(e.message || '')) message = 'A conta de geração de imagens ainda precisa concluir a verificação da OpenAI.';
    return res.status(500).json({ error: message, orderId });
  }
});

app.get('/api/order-status', async (req, res) => {
  try {
    if (!envReady()) return res.status(503).json({ paid: false });
    const order = await loadOrder(req.query.orderId);
    if (!order) return res.status(404).json({ paid: false });
    if (order.payment_status !== 'paid') {
      const payload = { paid: false, status: order.status };
      if (order.status === 'preview_ready') payload.previewUrl = await signedUrl(order.preview_path, 60 * 60);
      return res.json(payload);
    }
    const downloadUrl = await signedUrl(order.original_path, 60 * 15);
    return res.json({ paid: true, downloadUrl });
  } catch (e) {
    console.error('status error', e);
    return res.status(500).json({ paid: false });
  }
});

function safeEqualHex(a, b) {
  try {
    const aa = Buffer.from(String(a || '').trim().toLowerCase(), 'hex');
    const bb = Buffer.from(String(b || '').trim().toLowerCase(), 'hex');
    return aa.length > 0 && aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch { return false; }
}

function verifyKiwifySignature(req) {
  const token = process.env.KIWIFY_WEBHOOK_TOKEN;
  const signature = String(req.query.signature || '');
  if (!token || !signature || !req.rawBody) return false;
  const expected = crypto.createHmac('sha1', token).update(req.rawBody).digest('hex');
  return safeEqualHex(signature, expected);
}

function deepFindKey(value, wanted, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  for (const [k, v] of Object.entries(value)) {
    if (wanted.includes(String(k).toLowerCase()) && typeof v === 'string' && v) return v;
    if (v && typeof v === 'object') {
      const found = deepFindKey(v, wanted, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function kiwifyOrderId(body) {
  // O site envia o UUID da prévia no parâmetro de rastreamento s1 do checkout.
  return deepFindKey(body, ['s1']);
}

function kiwifyPaid(body) {
  const status = String(
    body?.order_status || body?.status || body?.order?.order_status || body?.order?.status || ''
  ).toLowerCase();
  return ['paid', 'approved', 'approved_payment', 'compra_aprovada'].includes(status);
}

async function handleKiwifyWebhook(req, res) {
  try {
    if (!process.env.KIWIFY_WEBHOOK_TOKEN) {
      console.error('Kiwify: KIWIFY_WEBHOOK_TOKEN ausente');
      return res.status(503).json({ ok: false, error: 'webhook_not_configured' });
    }
    if (!verifyKiwifySignature(req)) {
      console.warn('Kiwify: assinatura inválida');
      return res.status(401).json({ ok: false, error: 'invalid_signature' });
    }

    // Testes da Kiwify devem receber 2xx mesmo quando não correspondem a uma prévia real.
    const orderId = kiwifyOrderId(req.body);
    const paid = kiwifyPaid(req.body);
    const kiwifyId = String(req.body?.order_id || req.body?.order?.order_id || req.body?.id || '');

    console.log('Kiwify webhook válido', JSON.stringify({ paid, orderId: orderId || null, kiwifyId: kiwifyId || null }));

    if (!paid || !orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return res.status(200).json({ ok: true, processed: false });
    }

    const order = await loadOrder(orderId);
    if (!order) return res.status(200).json({ ok: true, processed: false, reason: 'order_not_found' });

    // Idempotente: reenvios do mesmo webhook não liberam nada duas vezes.
    if (order.payment_status !== 'paid') {
      order.payment_status = 'paid';
      order.status = 'paid';
      order.paid_at = new Date().toISOString();
      order.kiwify_order_id = kiwifyId || null;
      await saveOrder(order);
    }

    return res.status(200).json({ ok: true, processed: true });
  } catch (e) {
    console.error('Kiwify webhook error', e);
    return res.status(500).json({ ok: false });
  }
}

// URL usada na Kiwify. Mantemos também a rota antiga como alias para compatibilidade.
app.post('/api/kiwify/webhook', handleKiwifyWebhook);
app.post('/api/kiwify-webhook', handleKiwifyWebhook);

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
if (require.main === module) app.listen(process.env.PORT || 3000);
module.exports = app;
