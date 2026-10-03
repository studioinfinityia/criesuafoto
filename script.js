const cfg = window.STUDIO_CONFIG || {};
const state = { gender:null, photos:1, basePrice:20, cake:false, extraPeople:0, theme:null, orderId:localStorage.getItem('studio_order_id')||null };

// ---- Meta Pixel: funil Studio Infinity IA ----
const metaTrack=(event,params={},standard=false)=>{
  try{if(typeof window.fbq==='function') window.fbq(standard?'track':'trackCustom',event,params);}catch(e){}
};
const trackingContext=()=>({
  gender:state.gender||'nao_selecionado',
  package_photos:state.photos,
  value:total(),
  currency:'BRL',
  theme_id:state.theme?.id||'',
  theme_name:state.theme?.name||'',
  cake:state.cake?1:0,
  extra_people:state.extraPeople
});

// Delegated tracking keeps working as new themes are added.
document.addEventListener('click',(e)=>{
  const gender=e.target.closest('.gender-option');
  if(gender) setTimeout(()=>metaTrack('GenderSelected',trackingContext()),0);
  const pack=e.target.closest('.package');
  if(pack) setTimeout(()=>metaTrack('PackageSelected',trackingContext()),0);
  const wa=e.target.closest('[data-whatsapp]');
  if(wa) metaTrack('WhatsAppClick',{...trackingContext(),placement:wa.id||wa.className||'site'});
});

document.querySelector('#cake')?.addEventListener('change',()=>setTimeout(()=>metaTrack('AddonChanged',{...trackingContext(),addon:'bolo_tematico'}),0));
document.querySelector('#plusPerson')?.addEventListener('click',()=>setTimeout(()=>metaTrack('AddonChanged',{...trackingContext(),addon:'pessoa_adicional'}),0));
document.querySelector('#minusPerson')?.addEventListener('click',()=>setTimeout(()=>metaTrack('AddonChanged',{...trackingContext(),addon:'pessoa_adicional'}),0));
document.querySelector('#photo')?.addEventListener('change',()=>{if(photo.files[0])metaTrack('PhotoUploaded',{...trackingContext(),file_type:photo.files[0].type});});
const themes = [
  {id:'familia',name:'Foto de Família',tag:'Família',gender:'all',cover:'familia-depois.jpeg',desc:'Transforme uma foto simples em um retrato de família com acabamento profissional de estúdio.',examples:[['familia-antes.jpeg','familia-depois.jpeg']]},
  {id:'aniversario',name:'Aniversário',tag:'Aniversário',gender:'menino',cover:'aniversario-depois.jpeg',desc:'Ensaio de aniversário personalizado com nome, idade e o tema favorito.',examples:[['aniversario-antes.jpeg','aniversario-depois.jpeg']]},
  {id:'hulk',name:'Hulk',tag:'Mesversário',gender:'menino',cover:'hulk-depois.jpeg',desc:'Um mesversário divertido inspirado no herói verde, com cenário personalizado.',examples:[['hulk-antes.jpeg','hulk-depois.jpeg']]},
  {id:'bezerrinho',name:'Bezerrinho',tag:'Mesversário',gender:'menino',cover:'bezerrinho-depois.jpeg',desc:'Ensaio delicado de bezerrinho em tons neutros, com plaquinha personalizada.',examples:[['bezerrinho-antes.jpeg','bezerrinho-depois.jpeg']]},
  {id:'velozes',name:'Velozes e Furiosos',tag:'Mesversário',gender:'menino',cover:'velozes-depois.jpeg',desc:'Ensaio inspirado em velocidade e automobilismo, personalizado para o bebê.',examples:[['velozes-antes.jpeg','velozes-depois.jpeg']]},
  {id:'toy-story',name:'Toy Story',tag:'Mesversário',gender:'menino',cover:'toystory-depois.jpeg',desc:'Cenário divertido inspirado no universo de brinquedos, com elementos personalizados.',examples:[['toystory-antes.jpeg','toystory-depois.jpeg']]},
  {id:'pequeno-principe',name:'Pequeno Príncipe',tag:'Mesversário',gender:'menino',cover:'principe-depois.jpeg',desc:'Um ensaio delicado em azul-marinho e dourado, com atmosfera encantadora.',examples:[['principe-antes.jpeg','principe-depois.jpeg']]},
  {id:'goku',name:'Goku',tag:'Aniversário',gender:'menino',cover:'goku-depois.jpeg',desc:'Ensaio vibrante inspirado em artes marciais e aventura, com cenário personalizado.',examples:[['goku-antes.jpeg','goku-depois.jpeg']]},
  {id:'safari',name:'Safari',tag:'Mesversário',gender:'menino',cover:'safari-depois.jpeg',desc:'Cenário acolhedor com animais, folhagens e tons naturais.',examples:[['safari-antes.jpeg','safari-depois.jpeg']]},
  {id:'sao-francisco',name:'São Francisco',tag:'Mesversário',gender:'menina',cover:'francisco-depois.jpeg',desc:'Ensaio delicado em tons terrosos, com flores e elementos de fé.',examples:[['francisco-antes.jpeg','francisco-depois.jpeg']]},
  {id:'cerejinha',name:'Cerejinha',tag:'Mesversário',gender:'menina',cover:'cereja-depois.jpeg',desc:'Cenário doce em vermelho e branco, com cerejas e detalhes personalizados.',examples:[['cereja-antes.jpeg','cereja-depois.jpeg']]},
  {id:'pequena-sereia',name:'Pequena Sereia',tag:'Mesversário',gender:'menina',cover:'sereia-depois.jpeg',desc:'Um ensaio encantador inspirado no fundo do mar, com cores suaves e personagens temáticos.',examples:[['sereia-antes.jpeg','sereia-depois.jpeg']]},
  {id:'bezerrinha',name:'Bezerrinha Rosa',tag:'Mesversário',gender:'menina',cover:'bezerrinha-depois.jpeg',desc:'Tema de bezerrinha em rosa, preto e branco com cenário fofo e personalizado.',examples:[['bezerrinha-antes.jpeg','bezerrinha-depois.jpeg']]},
  {id:'frozen',name:'Frozen',tag:'Mesversário',gender:'menina',cover:'frozen-depois.jpeg',desc:'Ensaio delicado inspirado no universo Frozen, em azul e branco.',examples:[['frozen-antes.jpeg','frozen-depois.jpeg']]},
  {id:'outros',name:'Outros temas',tag:'Personalizado',gender:'all',cover:null,desc:'Não encontrou o tema? Escolha esta opção e fale conosco para criar algo especial.',examples:[]}
];
document.querySelectorAll('[data-instagram]').forEach(a=>a.href=cfg.instagram); document.querySelectorAll('[data-whatsapp]').forEach(a=>a.href=cfg.whatsapp);
const money=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:0}); const total=()=>state.basePrice+(state.cake?5:0)+state.extraPeople*5;
function updateSummary(){const bits=[`${state.photos} ${state.photos===1?'foto':'fotos'}`];if(state.cake)bits.push('bolo temático');if(state.extraPeople)bits.push(`+${state.extraPeople} ${state.extraPeople===1?'pessoa':'pessoas'}`);document.querySelector('#summaryText').textContent=bits.join(' • ');document.querySelector('#totalPrice').textContent=money(total());document.querySelector('#chosenTotal').textContent=money(total());document.querySelector('#buyPrice').textContent=money(total());}
function renderThemes(){const grid=document.querySelector('#themeGrid');grid.innerHTML='';if(!state.gender){grid.innerHTML='<div class="theme-empty">Escolha <b>Menino</b> ou <b>Menina</b> acima para liberar os temas.</div>';return;}themes.filter(t=>t.gender==='all'||t.gender===state.gender).forEach(t=>{const b=document.createElement('button');b.className='theme-card';b.innerHTML=`<div class="theme-cover" ${t.cover?`style="background-image:linear-gradient(0deg,rgba(5,8,23,.92),rgba(5,8,23,.05) 70%),url('${t.cover}')"`:''}><span>${t.tag}</span><b>${t.name}</b></div><p>${t.desc}</p><strong>Ver antes e depois →</strong>`;b.onclick=()=>openTheme(t);grid.appendChild(b);});}
document.querySelectorAll('.gender-option').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.gender-option').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');state.gender=btn.dataset.gender;state.theme=null;document.querySelector('#chosenThemeLabel').textContent='Escolha um tema acima';document.querySelector('#temas').classList.remove('locked-section');setGuide('theme');document.querySelector('#genderNote').textContent=`Perfeito. Agora escolha um dos temas para ${state.gender}.`;renderThemes();document.querySelector('#temas').scrollIntoView({behavior:'smooth'});});
document.querySelectorAll('.package').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.package').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');state.photos=+btn.dataset.package;state.basePrice=+btn.dataset.price;updateSummary();setGuide('to-preview');});
document.querySelector('#cake').onchange=e=>{state.cake=e.target.checked;updateSummary();};document.querySelector('#minusPerson').onclick=()=>{state.extraPeople=Math.max(0,state.extraPeople-1);document.querySelector('#extraPeople').textContent=state.extraPeople;updateSummary();};document.querySelector('#plusPerson').onclick=()=>{state.extraPeople=Math.min(3,state.extraPeople+1);document.querySelector('#extraPeople').textContent=state.extraPeople;updateSummary();};document.querySelector('#toThemes').onclick=()=>{if(!state.theme)return alert('Escolha primeiro um tema.');setGuide('upload');document.querySelector('#gerar').scrollIntoView({behavior:'smooth'});};
function openTheme(t){state.theme=t;metaTrack('ThemeViewed',{...trackingContext(),theme_id:t.id,theme_name:t.name,theme_tag:t.tag});document.querySelector('#themeBadge').textContent=t.tag.toUpperCase();document.querySelector('#themeName').textContent=t.name;document.querySelector('#themeDescription').textContent=t.desc;document.querySelector('#beforeAfter').innerHTML=t.examples.length?t.examples.map((pair,n)=>`<article class="ba-example"><div class="ba-grid"><figure class="ba-photo"><span>ANTES</span><img src="${pair[0]}" alt="Foto original" loading="lazy"></figure><figure class="ba-photo after"><span>DEPOIS</span><img src="${pair[1]}" alt="Resultado Studio Infinity IA" loading="lazy"></figure></div><small class="ba-caption">Foto enviada → resultado Studio Infinity IA</small></article>`).join(''):`<div class="no-example">Quer um tema diferente? Selecione esta opção e fale com a gente no WhatsApp.</div>`;document.querySelector('#themeDetail').classList.remove('hidden');setGuide('choose-theme');document.querySelector('#themeDetail').scrollIntoView({behavior:'smooth',block:'start'});}
document.querySelector('#closeTheme').onclick=()=>document.querySelector('#themeDetail').classList.add('hidden');document.querySelector('#chooseTheme').onclick=()=>{metaTrack('ThemeSelected',trackingContext());document.querySelector('#chosenThemeLabel').textContent=state.theme.name;document.querySelector('#precos').classList.remove('locked-section');setGuide('package');document.querySelector('#themeDetail').classList.add('hidden');document.querySelector('#precos').scrollIntoView({behavior:'smooth'});};
const photo=document.querySelector('#photo');photo.onchange=()=>{document.querySelector('#fileName').textContent=photo.files[0]?photo.files[0].name:'';document.querySelector('#generate').disabled=!(photo.files[0]&&state.theme);if(photo.files[0]&&state.theme)setGuide('generate');};
document.querySelector('#generate').onclick=async()=>{if(!state.theme||!photo.files[0])return;if(localStorage.getItem('studio_preview_used')==='1'&&!state.orderId){alert('A prévia gratuita deste dispositivo já foi utilizada. Para ajustes ou um novo tema, fale conosco no WhatsApp.');return;}metaTrack('PreviewStarted',trackingContext());const btn=document.querySelector('#generate');btn.disabled=true;btn.textContent='CRIANDO SUA PRÉVIA...';try{const fd=new FormData();fd.append('image',photo.files[0]);fd.append('gender',state.gender);fd.append('theme',state.theme.id);fd.append('themeName',state.theme.name);fd.append('photos',state.photos);fd.append('cake',state.cake?'1':'0');fd.append('extraPeople',state.extraPeople);fd.append('total',total());const r=await fetch(cfg.apiEndpoint,{method:'POST',body:fd});const j=await r.json();if(!r.ok)throw new Error(j.error||'Não foi possível gerar a prévia.');state.orderId=j.orderId;localStorage.setItem('studio_order_id',state.orderId);localStorage.setItem('studio_preview_used','1');document.querySelector('#previewImage').src=j.previewUrl;document.querySelector('#previewArea').classList.remove('hidden');metaTrack('PreviewGenerated',trackingContext());setGuide('checkout');document.querySelector('#previewArea').scrollIntoView({behavior:'smooth'});}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='GERAR PRÉVIA • PAGUE SÓ SE GOSTAR';}};
document.querySelector('#buyButton').onclick=()=>{if(!state.orderId)return alert('Gere sua prévia primeiro.');const finalTotal=total();const checkout=cfg.kiwify?.byTotal?.[finalTotal];if(!checkout)return alert(`Ainda não há checkout configurado para ${money(finalTotal)}. Fale conosco no WhatsApp para concluir seu pedido.`);metaTrack('InitiateCheckout',trackingContext(),true);metaTrack('KiwifyRedirect',trackingContext());localStorage.setItem('studio_waiting_payment','1');window.location.href=checkout;};
async function checkPayment(){if(!state.orderId)return;try{const r=await fetch(`${cfg.orderStatusEndpoint}?orderId=${encodeURIComponent(state.orderId)}`);if(!r.ok)return;const j=await r.json();if(j.paid&&j.downloadUrl){document.querySelector('#previewArea').classList.add('hidden');document.querySelector('#paidArea').classList.remove('hidden');const a=document.querySelector('#downloadButton');a.href=j.downloadUrl;a.onclick=()=>setTimeout(()=>{document.querySelector('#paidArea').classList.add('hidden');document.querySelector('#thanksArea').classList.remove('hidden');},500);}}catch{}}
function setGuide(step){
  document.querySelectorAll('.funnel-glow').forEach(el=>el.classList.remove('funnel-glow'));
  let el=null;
  if(step==='gender') el=document.querySelector('#genderGrid');
  if(step==='theme') el=document.querySelector('#themeGrid');
  if(step==='choose-theme') el=document.querySelector('#chooseTheme');
  if(step==='package') el=document.querySelector('.package.featured');
  if(step==='to-preview') el=document.querySelector('#toThemes');
  if(step==='upload') el=document.querySelector('.upload-box');
  if(step==='generate') el=document.querySelector('#generate');
  if(step==='checkout') el=document.querySelector('#buyButton');
  if(el) el.classList.add('funnel-glow');
}
if(localStorage.getItem('studio_waiting_payment')==='1'||state.orderId){checkPayment();setInterval(checkPayment,8000);}renderThemes();updateSummary();setGuide(state.gender?'theme':'gender');
