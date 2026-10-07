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
  frozen: 'Create a magical winter-princess inspired baby milestone portrait in icy blue, white and silver with snowflakes and elegant frozen scenery, without reproducing copyrighted characters or logos. Preserve the baby identity, face, facial features, skin tone, hair, expression and proportions exactly. Photorealistic premium studio photography.',
  'branca-de-neve': 'Create a princess-inspired baby milestone portrait with classic fairytale colors, soft blue, yellow and red styling, apples, flowers and a delicate storybook atmosphere, without reproducing copyrighted character artwork or logos. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and premium baby photography.',
  'galinha-pintadinha': 'Create a cheerful blue-chicken-inspired baby milestone portrait with clean primary colors, playful bird and flower details, and a premium cozy setup. Do not reproduce copyrighted character artwork or logos exactly. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  'sitio-do-picapau-amarelo': 'Create a playful classic Brazilian storybook-inspired baby milestone portrait with warm yellow and red tones, a rag-doll style companion, handcrafted details and a nostalgic countryside-literature atmosphere. Do not reproduce copyrighted character artwork or logos exactly. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic and natural.',
  ovelhinha: 'Create a delicate sheep-themed baby milestone portrait with soft cream, blush and beige tones, plush lamb details, cozy textures and an elegant premium newborn setup. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  'monstros-sa': 'Create a fun friendly-monsters inspired baby milestone portrait with soft pink, lilac, teal and blue tones, child-friendly monster props and a playful premium setup, without reproducing copyrighted logos or exact character artwork. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  'masha-urso': 'Create a playful forest-friend inspired girl birthday portrait with warm wood textures, pink accents, floral details and a friendly large-bear atmosphere, without reproducing copyrighted character artwork or logos exactly. Preserve 100% of the child face, identity, expression, skin tone and hair. Photorealistic, natural proportions and premium photography.',
  'chapeuzinho-vermelho': 'Create a classic red-hood fairytale inspired girl birthday portrait with red and white styling, woodland details, flowers, a basket and a cozy storybook atmosphere, without reproducing copyrighted character artwork exactly. Preserve 100% of the child face, identity, expression, skin tone and hair. Photorealistic and natural.',
  moana: 'Create a tropical ocean-adventure inspired girl birthday portrait with warm red, coral, cream and natural wood tones, island foliage, tropical flowers, canoe and ocean-inspired details, without reproducing copyrighted character artwork or logos exactly. Preserve 100% of the child face, identity, expression, skin tone and hair. Photorealistic, natural proportions and premium photography.',
  barbie: 'Create a glamorous pink fashion-doll inspired girl birthday portrait with elegant pink lighting, castle-inspired decor, flowers, sparkles and a premium princess-fashion atmosphere, without reproducing copyrighted logos or exact character artwork. Preserve 100% of the child face, identity, expression, skin tone and hair. Photorealistic and natural.',
  'vasco-menina': 'Create a delicate girls baby milestone portrait inspired by a black-and-white Brazilian football club aesthetic, with black, white and soft pink accents, football props and tasteful club-inspired symbols without exact trademark replication. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and premium baby photography.',
  'nossa-senhora-dos-milagres': 'Create a delicate Catholic faith-inspired baby milestone portrait themed around Nossa Senhora dos Milagres, with white, cream, soft blue and subtle gold details, flowers, devotional props and an elegant premium setup. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  'ursinho-pooh': 'Create a warm honey-bear inspired baby milestone portrait with soft cream, honey yellow and warm brown tones, plush bear and tiger companions, a honey pot prop, wooden milestone sign and a cozy storybook atmosphere. Avoid exact trademark logos. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  'flamengo-menino': 'Create a premium baby milestone portrait inspired by a red-and-black football club aesthetic, with a red-and-black striped outfit, football props and a celebratory sports setup. Avoid exact trademark replication where possible. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  'jesus-menino': 'Create a delicate Christian faith-inspired baby milestone portrait themed around Jesus, with soft cream, beige and warm brown tones, a Bible, subtle cross details, gentle greenery and an elegant devotional setup. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  bolofofos: 'Create a cheerful colorful baby milestone portrait inspired by a cute musical cartoon ensemble, using lilac, purple, blue, yellow and pink, with original friendly animal-like plush characters and a playful premium setup. Do not reproduce copyrighted character artwork or logos exactly. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  cinderela: 'Create an elegant fairytale-princess inspired baby milestone portrait with soft powder blue, white and gold details, a delicate blue dress, crown motifs, a glass-slipper-inspired prop and dreamy royal styling, without reproducing copyrighted character artwork exactly. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic and natural.',
  abelhinha: 'Create a cheerful bee-themed baby milestone portrait with yellow, black and white accents, plush bees, tiny daisies, honeycomb-inspired details and a clean premium setup. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  moranguinho: 'Create a sweet strawberry-themed baby milestone portrait with red, white and soft green colors, plush strawberries, tiny white flowers and an elegant cozy setup. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  minions: 'Create a playful yellow-and-blue helper-creature inspired baby milestone portrait with original goggle-wearing plush characters, cheerful yellow and blue decor and a clean child-friendly setup. Do not reproduce copyrighted character artwork or logos exactly. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic and natural.',
  'super-mario': 'Create a colorful classic platform-videogame inspired baby milestone portrait with red, blue, green and yellow styling, original plumber-adventure-inspired plush props, stars, pipes, mushrooms and question-block-like shapes, without reproducing copyrighted logos or exact character artwork. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  fazendinha: 'Create a premium farm-themed baby milestone portrait with warm beige, brown, olive green and rustic red accents, tasteful plush farm animals, subtle barn and fence details, and natural textures. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic baby photography.',
  chaves: 'Create a playful neighborhood-comedy inspired baby milestone portrait with warm beige, green, red and orange accents, a small barrel prop and simple nostalgic courtyard-inspired details. Keep the composition child-friendly and tasteful. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic and natural.',
  '3-palavrinhas': 'Create a cheerful children-music inspired baby milestone portrait with a clean colorful setup, playful musical notes, soft primary colors and a few friendly toy-like props. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic, natural and premium baby photography.',
  eleicao: 'Create a playful Brazilian election-themed baby milestone portrait using green, yellow, blue and white, with tasteful campaign-style props such as a small sign, sash, ballot-box-inspired prop and personalized name and age details. Keep it humorous, family-friendly and nonpartisan. Preserve 100% of the baby face, identity, expression, skin tone and hair. Photorealistic and natural.',
  sonic: 'Create a high-energy blue speed-adventure inspired child birthday portrait with blue, yellow and green accents, ring motifs, dynamic game-inspired scenery and a premium birthday setup. Preserve 100% of the child face, identity, expression, skin tone and hair. Photorealistic, natural proportions and realistic photography.'
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
  // Usa a arte oficial enviada pelo Studio Infinity IA como marca-d'água.
  // watermark-preview.png deve ficar na mesma pasta do server.js no deploy.
  const width = 800, height = 1000;

  const base = await sharp(imageBuffer)
    .resize({ width, height, fit: 'cover' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const watermarkPath = path.join(__dirname, 'watermark-preview.png');
  const watermark = await sharp(watermarkPath)
    .resize({ width, height, fit: 'fill' })
    .png()
    .toBuffer();

  return sharp(base)
    .composite([{ input: watermark, blend: 'over' }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

function buildPrompt(body) {
  const base = THEME_PROMPTS[body.theme];
  if (!base) throw new Error('Tema não disponível para geração automática.');

  const name = String(body.babyName || '').trim().slice(0, 40);
  const months = Math.max(1, Math.min(36, Number(body.babyMonths || 0)));
  const notes = String(body.photoNotes || '').trim().slice(0, 500);
  const minimalist = String(body.minimalist || '').toLowerCase() === 'true';

  const additions = [];
  if (body.cake === '1') {
    additions.push(`Inclua um bolo temático bonito, delicado e bem integrado ao cenário, coerente com o tema escolhido. O bolo deve trazer de forma legível o nome "${name}" e a idade "${months} ${months === 1 ? 'mês' : 'meses'}", ou somente a idade quando isso resultar em composição visual mais natural. Todo texto deve estar em português do Brasil.`);
  }

  const people = Math.max(0, Math.min(3, Number(body.extraPeople || 0)));
  if (people) additions.push(`A composição pode incluir até ${people} pessoa(s) adicional(is), mas nunca invente a identidade de uma pessoa real sem foto de referência.`);
  if (notes) additions.push(`Preferências específicas da cliente: ${notes}. Siga-as quando forem compatíveis com uma fotografia natural e segura.`);

  const styleBlock = minimalist
    ? `ESTILO SELECIONADO: MINIMALISTA.
- Gere uma foto realmente mais minimalista, com cenário mais limpo, menos elementos decorativos, composição mais leve, organizada e elegante.
- Reduza a quantidade de objetos e enfeites. Evite cenário poluído, carregado ou excessivamente decorado.
- Mantenha maior destaque no bebê, principalmente no rosto, com o tema aparecendo de forma delicada e sutil.
- O resultado deve lembrar ensaios minimalistas de mesversário: fundo macio e limpo, poucos elementos temáticos, visual delicado, natural e premium.`
    : `ESTILO SELECIONADO: TEMÁTICO TRADICIONAL.
- Gere uma composição temática bonita, harmoniosa e realista, com elementos decorativos compatíveis com o tema.
- O cenário pode ter mais elementos do que a versão minimalista, mas sem exagero e sempre mantendo o bebê como foco principal.`;

  return `EDITE a fotografia enviada e transforme-a em um ensaio fotográfico profissional de mesversário. ${base}

REGRAS OBRIGATÓRIAS:
- Preserve 100% o rosto do bebê, mantendo com máxima fidelidade a identidade facial, traços, expressão, tom de pele, cabelo e aparência natural.
- Gere uma foto ultrarrealista, delicada, natural e com acabamento premium, sem aparência artificial de IA.
- Composição vertical EXATAMENTE em proporção 4:5.
- Mantenha uma certa distância entre a câmera e o bebê. Evite enquadramento muito fechado ou close excessivo no rosto.
- Prefira um enquadramento mais aberto e natural, mostrando melhor o bebê no cenário e permitindo ver mais do corpo e da composição temática.
- O bebê não deve parecer colado na câmera; a imagem deve ter aparência de ensaio fotográfico bem enquadrado, com respiro visual ao redor do bebê.
- ${styleBlock}
- REGRA DE IDADE E DESENVOLVIMENTO: adapte corpo, tamanho, estatura, proporções e postura para parecerem naturalmente compatíveis com ${months} ${months === 1 ? 'mês' : 'meses'}, sem envelhecer artificialmente o bebê e sem fazê-lo parecer uma criança maior.
- Para 1 ou 2 meses: o bebê deve aparecer SEMPRE DEITADO, com corpo pequeno e delicado e pose natural para essa fase. Nunca sentado ou sustentando sozinho uma postura incompatível com a idade.
- Para 3 ou 4 meses: o bebê pode aparecer DEITADO ou ENCOSTADINHO/COM APOIO, sempre de forma natural e compatível com a idade. Não o mostre sentado sozinho.
- A partir de 5 meses: o bebê pode aparecer DEITADO, ENCOSTADO ou SENTADO, desde que a pose seja natural e plausível para a idade informada.
- Se uma preferência da cliente, tema ou cenário pedir uma pose incompatível com a idade, esta REGRA DE IDADE tem prioridade.
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
  fd.append('quality', 'medium');
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


function isAuthorizedTestDevice(req) {
  const configuredSecret = String(process.env.TEST_DEVICE_SECRET || '').trim();
  const suppliedSecret = String(req.body.testDeviceSecret || '').trim();
  if (!configuredSecret || !suppliedSecret) return false;

  const a = crypto.createHash('sha256').update(suppliedSecret).digest();
  const b = crypto.createHash('sha256').update(configuredSecret).digest();
  return crypto.timingSafeEqual(a, b);
}

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
    const testDevice = isAuthorizedTestDevice(req);

    // Compra de R$ 25+ libera a próxima geração incluída no pedido.
    // O direito é validado no servidor e não depende do navegador.
    const entitlementId = String(req.body.paidEntitlementOrderId || '');
    if (/^[0-9a-f-]{36}$/i.test(entitlementId)) {
      const paidOrder = await loadOrder(entitlementId);
      if (paidOrder && paidOrder.payment_status === 'paid' && Number(paidOrder.total || 0) >= 25) {
        const allowed = Math.max(1, Number(paidOrder.photos || 1));
        const used = Math.max(1, Number(paidOrder.generated_count || 1));
        if (used < allowed) {
          const next = used + 1;
          const prompt = buildPrompt(req.body);
          const generated = await callOpenAIEdit(req.file, prompt);
          const paidPath = `orders/${entitlementId}/original-${next}.jpg`;
          await storageUpload(paidPath, generated.buffer, 'image/jpeg');
          paidOrder.generated_count = next;
          paidOrder.status = 'paid';
          paidOrder.last_generated_at = new Date().toISOString();
          if (!Array.isArray(paidOrder.extra_original_paths)) paidOrder.extra_original_paths = [];
          paidOrder.extra_original_paths.push(paidPath);
          await saveOrder(paidOrder);
          const downloadUrl = await signedUrl(paidPath, 60 * 15);
          return res.json({
            orderId: entitlementId,
            paid: true,
            downloadUrl,
            generatedCount: next,
            allowedGenerations: allowed,
            remainingGenerations: Math.max(0, allowed - next)
          });
        }
      }
    }

    const existing = testDevice ? null : await storageGet(markerPath);
    if (existing) return res.status(429).json({ error: 'A prévia gratuita deste dispositivo já foi utilizada. Após uma compra de R$ 25 ou mais, uma nova geração é liberada automaticamente.' });

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
      preview_path: previewPath,
      generated_count: 0
    };
    await saveOrder(order);

    const prompt = buildPrompt(req.body);
    const generated = await callOpenAIEdit(req.file, prompt);
    await storageUpload(originalPath, generated.buffer, 'image/jpeg');
    const previewBuffer = await createWatermarkedPreview(generated.buffer);
    await storageUpload(previewPath, previewBuffer, 'image/jpeg');

    order.status = 'preview_ready';
    order.generated_count = 1;
    order.generated_at = new Date().toISOString();
    if (generated.usage) order.openai_usage = generated.usage;
    await saveOrder(order);
    if (!testDevice) {
      await storageUpload(markerPath, Buffer.from(JSON.stringify({ order_id: orderId, created_at: order.created_at })), 'application/json', true);
    }

    const previewUrl = await signedUrl(previewPath, 60 * 60);
    return res.json({ orderId, previewUrl, testDevice });
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
    const allowedGenerations = Math.max(1, Number(order.photos || 1));
    const generatedCount = Math.max(1, Number(order.generated_count || 1));
    return res.json({
      paid: true,
      downloadUrl,
      generatedCount,
      allowedGenerations,
      remainingGenerations: Math.max(0, allowedGenerations - generatedCount)
    });
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
