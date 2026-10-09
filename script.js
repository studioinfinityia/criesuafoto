const cfg = window.STUDIO_CONFIG || {};
// Pedido/prévia é estado da sessão atual, não deve reaparecer ao fechar e abrir o site.
const legacyOrderId = localStorage.getItem('studio_order_id');
localStorage.removeItem('studio_order_id');
localStorage.removeItem('studio_waiting_payment');
const state = { gender:null, photos:1, basePrice:20, cake:false, extraPeople:0, theme:null, occasion:'mesversario', babyName:'', babyMonths:'', photoNotes:'', minimalist:false, orderId:sessionStorage.getItem('studio_order_id')||null };
const deviceId = localStorage.getItem('studio_device_id') || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
localStorage.setItem('studio_device_id', deviceId);

// ---- Modo de teste privado Studio Infinity IA ----
// Abra uma única vez no aparelho autorizado:
// https://studioinfinityia.github.io/criesuafoto/#studio-test=SEU_SEGREDO
(function initPrivateTestMode(){
  const prefix = '#studio-test=';
  if (location.hash.startsWith(prefix)) {
    const secret = decodeURIComponent(location.hash.slice(prefix.length)).trim();
    if (secret) {
      localStorage.setItem('studio_test_device_secret', secret);
      localStorage.removeItem('studio_preview_used');
      history.replaceState(null, '', location.pathname + location.search);
      alert('Modo de teste ativado neste iPhone. Você pode gerar novas prévias para testes.');
    }
  }
})();


async function prepareUploadImage(file){
  // Mantém o upload abaixo do limite das funções serverless sem destruir a qualidade usada como referência.
  if(file.size <= 2.8*1024*1024 && file.type === 'image/jpeg') return file;
  const bmp = await createImageBitmap(file);
  const maxEdge = 2200;
  const scale = Math.min(1, maxEdge/Math.max(bmp.width,bmp.height));
  const canvas=document.createElement('canvas'); canvas.width=Math.round(bmp.width*scale); canvas.height=Math.round(bmp.height*scale);
  canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height); bmp.close?.();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível preparar a foto.')),'image/jpeg',0.9));
  return new File([blob],'foto-cliente.jpg',{type:'image/jpeg'});
}


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
  {id:'pequeno-principe',name:'Pequeno Príncipe',tag:'Mesversário',gender:'menino',cover:'pequeno-principe-depois.jpeg',desc:'Um ensaio delicado em azul-marinho e dourado, com estrelas, planeta e atmosfera encantadora.',examples:[['pequeno-principe-antes.jpeg','pequeno-principe-depois.jpeg']]},

  {id:'minions',name:'Minions',tag:'Mesversário',gender:'menino',cover:'minions-depois.jpeg',desc:'Ensaio divertido em amarelo e azul, com personagens fofos e cenário alegre inspirado em ajudantes atrapalhados.',examples:[['minions-antes.jpeg','minions-depois.jpeg']]},
  {id:'super-mario',name:'Super Mario',tag:'Mesversário',gender:'menino',cover:'super-mario-depois.jpeg',desc:'Ensaio colorido inspirado em videogame clássico, com vermelho, azul, estrelas, blocos e cogumelos.',examples:[['super-mario-antes.jpeg','super-mario-depois.jpeg']]},
  {id:'goku',name:'Goku',tag:'Aniversário',gender:'menino',cover:'goku-depois.jpeg',desc:'Ensaio vibrante inspirado em artes marciais e aventura, com cenário personalizado.',examples:[['goku-antes.jpeg','goku-depois.jpeg']]},
  {id:'safari',name:'Safari',tag:'Mesversário',gender:'menino',cover:'safari-depois.jpeg',desc:'Cenário acolhedor com animais, folhagens e tons naturais.',examples:[['safari-antes.jpeg','safari-depois.jpeg']]},
  {id:'fazendinha',name:'Fazendinha',tag:'Mesversário',gender:'menino',cover:'fazendinha-depois.jpeg',desc:'Ensaio de fazendinha com tons terrosos, bichinhos e detalhes rústicos personalizados.',examples:[['fazendinha-antes.jpeg','fazendinha-depois.jpeg']]},
  {id:'chaves',name:'Chaves',tag:'Mesversário',gender:'menino',cover:'chaves-depois.jpeg',desc:'Cenário divertido inspirado em vila e barril, com visual nostálgico e personalizado.',examples:[['chaves-antes.jpeg','chaves-depois.jpeg']]},
  {id:'3-palavrinhas',name:'3 Palavrinhas',tag:'Mesversário',gender:'menino',cover:'3-palavrinhas-depois.jpeg',desc:'Ensaio alegre e colorido com música, letras e elementos infantis personalizados.',examples:[['3-palavrinhas-antes.jpeg','3-palavrinhas-depois.jpeg']]},
  {id:'eleicao',name:'Eleição',tag:'Mesversário',gender:'menino',cover:'eleicao-depois.jpeg',desc:'Tema divertido de eleição brasileira, com nome, idade e elementos personalizados.',examples:[['eleicao-antes.jpeg','eleicao-depois.jpeg']]},
  {id:'sonic',name:'Sonic',tag:'Aniversário',gender:'menino',cover:'sonic-depois.jpeg',desc:'Ensaio vibrante em azul, amarelo e verde, inspirado em velocidade e videogame.',examples:[['sonic-antes.jpeg','sonic-depois.jpeg']]},
  {id:'flamengo-menino',name:'Flamengo',tag:'Mesversário',gender:'menino',cover:'flamengo-menino-depois.jpeg',desc:'Ensaio esportivo em vermelho e preto, com bola, bandeira e clima de torcedor mirim.',examples:[['flamengo-menino-antes.jpeg','flamengo-menino-depois.jpeg']]},
  {id:'jesus-menino',name:'Jesus',tag:'Mesversário',gender:'menino',cover:'jesus-menino-depois.jpeg',desc:'Ensaio delicado de fé em tons claros, com Bíblia, elementos cristãos e cenário acolhedor.',examples:[['jesus-menino-antes.jpeg','jesus-menino-depois.jpeg']]},
  {id:'sao-francisco',name:'São Francisco',tag:'Mesversário',gender:'menina',cover:'francisco-depois.jpeg',desc:'Ensaio delicado em tons terrosos, com flores e elementos de fé.',examples:[['francisco-antes.jpeg','francisco-depois.jpeg']]},
  {id:'cerejinha',name:'Cerejinha',tag:'Mesversário',gender:'menina',cover:'cereja-depois.jpeg',desc:'Cenário doce em vermelho e branco, com cerejas e detalhes personalizados.',examples:[['cereja-antes.jpeg','cereja-depois.jpeg']]},
  {id:'pequena-sereia',name:'Pequena Sereia',tag:'Mesversário',gender:'menina',cover:'sereia-depois.jpeg',desc:'Um ensaio encantador inspirado no fundo do mar, com cores suaves e personagens temáticos.',examples:[['sereia-antes.jpeg','sereia-depois.jpeg']]},
  {id:'bezerrinha',name:'Bezerrinha Rosa',tag:'Mesversário',gender:'menina',cover:'bezerrinha-depois.jpeg',desc:'Tema de bezerrinha em rosa, preto e branco com cenário fofo e personalizado.',examples:[['bezerrinha-antes.jpeg','bezerrinha-depois.jpeg']]},
  {id:'frozen',name:'Frozen',tag:'Mesversário',gender:'menina',cover:'frozen-depois.jpeg',desc:'Ensaio delicado inspirado no universo Frozen, em azul e branco.',examples:[['frozen-antes.jpeg','frozen-depois.jpeg']]},
  {id:'branca-de-neve',name:'Branca de Neve',tag:'Mesversário',gender:'menina',cover:'branca-de-neve-depois.jpg',desc:'Tema clássico da Branca de Neve com vestido temático, maçã e elementos delicados.',examples:[['branca-de-neve-antes.jpg','branca-de-neve-depois.jpg']]},

  {id:'bolofofos',name:'Bolofofos',tag:'Mesversário',gender:'menina',cover:'bolofofos-depois.jpg',desc:'Tema colorido e divertido inspirado no desenho Bolofofos, com personagens fofos e cenário lilás personalizado.',examples:[['bolofofos-antes.jpg','bolofofos-depois.jpg']]},
  {id:'cinderela',name:'Cinderela',tag:'Mesversário',gender:'menina',cover:'cinderela-depois.jpg',desc:'Ensaio encantador inspirado em Cinderela, com vestido azul, laços delicados e detalhes de princesa.',examples:[['cinderela-antes.jpg','cinderela-depois.jpg']]},
  {id:'abelhinha',name:'Abelhinha',tag:'Mesversário',gender:'menina',cover:'abelhinha-depois.jpg',desc:'Tema alegre de abelhinha em amarelo e preto, com plaquinha personalizada e elementos delicados.',examples:[['abelhinha-antes.jpg','abelhinha-depois.jpg']]},
  {id:'moranguinho',name:'Moranguinho',tag:'Mesversário',gender:'menina',cover:'moranguinho-depois.jpg',desc:'Ensaio doce inspirado em moranguinhos, com vestido vermelho, detalhes de morango e cenário fofo.',examples:[['moranguinho-antes.jpg','moranguinho-depois.jpg']]},
  {id:'galinha-pintadinha',name:'Galinha Pintadinha',tag:'Mesversário',gender:'menina',cover:'galinha-pintadinha-depois.jpeg',desc:'Ensaio alegre e colorido com azul, amarelo e vermelho, inspirado no universo infantil da Galinha Pintadinha.',examples:[['galinha-pintadinha-antes.jpeg','galinha-pintadinha-depois.jpeg']]},
  {id:'sitio-do-picapau-amarelo',name:'Sítio do Picapau Amarelo',tag:'Mesversário',gender:'menina',cover:'sitio-do-picapau-amarelo-depois.jpeg',desc:'Tema lúdico e nostálgico com cores quentes, boneca de pano e elementos clássicos do sítio.',examples:[['sitio-do-picapau-amarelo-antes.jpeg','sitio-do-picapau-amarelo-depois.jpeg']]},
  {id:'ovelhinha',name:'Ovelhinha',tag:'Mesversário',gender:'menina',cover:'ovelhinha-depois.jpeg',desc:'Ensaio delicado em tons suaves com ovelhinha, texturas aconchegantes e composição clean.',examples:[['ovelhinha-antes.jpeg','ovelhinha-depois.jpeg']]},
  {id:'monstros-sa',name:'Monstros S.A.',tag:'Mesversário',gender:'menina',cover:'monstros-sa-depois.jpeg',desc:'Ensaio divertido em tons pastel, inspirado em monstrinhos amigáveis e na personagem Boo.',examples:[['monstros-sa-antes.jpeg','monstros-sa-depois.jpeg']]},
  {id:'masha-urso',name:'Masha e o Urso',tag:'Aniversário',gender:'menina',cover:'masha-urso-depois.jpeg',desc:'Ensaio alegre em rosa e tons amadeirados, inspirado em floresta, amizade e aventura infantil.',examples:[['masha-urso-antes.jpeg','masha-urso-depois.jpeg']]},
  {id:'chapeuzinho-vermelho',name:'Chapeuzinho Vermelho',tag:'Aniversário',gender:'menina',cover:'chapeuzinho-vermelho-depois.jpeg',desc:'Ensaio delicado em vermelho e branco, com floresta, cesta e clima clássico de conto infantil.',examples:[['chapeuzinho-vermelho-antes.jpeg','chapeuzinho-vermelho-depois.jpeg']]},
  {id:'moana',name:'Moana',tag:'Aniversário',gender:'menina',cover:'moana-depois.jpeg',desc:'Ensaio tropical inspirado no oceano, com tons quentes, flores, madeira e atmosfera de aventura.',examples:[['moana-antes.jpeg','moana-depois.jpeg']]},
  {id:'barbie',name:'Barbie',tag:'Aniversário',gender:'menina',cover:'barbie-depois.jpeg',desc:'Ensaio glamouroso em tons de rosa, com brilho, castelo e cenário elegante de princesa moderna.',examples:[['barbie-antes.jpeg','barbie-depois.jpeg']]},
  {id:'vasco-menina',name:'Vasco',tag:'Mesversário',gender:'menina',cover:'vasco-menina-depois.jpeg',desc:'Ensaio de mesversário em preto, branco e detalhes delicados, inspirado no time Vasco.',examples:[['vasco-menina-antes.jpeg','vasco-menina-depois.jpeg']]},
  {id:'nossa-senhora-dos-milagres',name:'Nossa Senhora dos Milagres',tag:'Mesversário',gender:'menina',cover:'nossa-senhora-dos-milagres-depois.jpeg',desc:'Ensaio delicado de fé em branco, azul e dourado, com flores, elementos religiosos e cenário elegante.',examples:[['nossa-senhora-dos-milagres-antes.jpeg','nossa-senhora-dos-milagres-depois.jpeg']]},
  {id:'ursinho-pooh',name:'Ursinho Pooh',tag:'Mesversário',gender:'menino',cover:'ursinho-pooh-depois.jpeg',desc:'Ensaio acolhedor em tons de mel e bege, com ursinho, tigre, pote de mel e clima lúdico.',examples:[['ursinho-pooh-antes.jpeg','ursinho-pooh-depois.jpeg']]},
  {id:'advogado',name:'Advogado',tag:'Mesversário',gender:'menino',cover:'advogado-depois.jpg',desc:'Tema elegante de advogado, com terninho, maleta e elementos jurídicos personalizados para o bebê.',examples:[['advogado-antes.jpg','advogado-depois.jpg']]},
  {id:'dentista',name:'Dentista',tag:'Mesversário',gender:'menino',cover:'dentista-depois.jpg',desc:'Tema delicado de dentista com jaleco, acessórios odontológicos e plaquinha personalizada.',examples:[['dentista-antes.jpg','dentista-depois.jpg']]},
  {id:'palmeiras',name:'Palmeiras',tag:'Mesversário',gender:'menino',cover:'palmeiras-depois.jpg',desc:'Tema do Palmeiras com uniforme verde, bola, mascote e detalhes personalizados do time.',examples:[['palmeiras-antes.jpg','palmeiras-depois.jpg']]},
  {id:'marinheira',name:'Marinheira',tag:'Mesversário',gender:'menina',cover:'marinheira-depois.jpeg',desc:'Ensaio náutico delicado em azul-marinho, branco e vermelho, com âncora, barquinho, cordas e plaquinha personalizada.',examples:[['marinheira-antes.jpeg','marinheira-depois.jpeg']]},
  {id:'outros',name:'Outros temas',tag:'Personalizado',gender:'all',cover:null,desc:'Não encontrou o tema? Escolha esta opção e fale conosco para criar algo especial.',examples:[]}
];
document.querySelectorAll('[data-instagram]').forEach(a=>a.href=cfg.instagram); document.querySelectorAll('[data-whatsapp]').forEach(a=>a.href=cfg.whatsapp);
const money=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:0}); const total=()=>state.basePrice+(state.cake?5:0)+state.extraPeople*5;
function updateSummary(){const bits=[`${state.photos} ${state.photos===1?'foto':'fotos'}`];if(state.cake)bits.push('bolo temático');if(state.extraPeople)bits.push(`+${state.extraPeople} ${state.extraPeople===1?'pessoa':'pessoas'}`);document.querySelector('#summaryText').textContent=bits.join(' • ');document.querySelector('#totalPrice').textContent=money(total());document.querySelector('#chosenTotal').textContent=money(total());document.querySelector('#buyPrice').textContent=money(total());}
function renderThemes(){const grid=document.querySelector('#themeGrid');grid.innerHTML='';if(!state.gender){grid.innerHTML='<div class="theme-empty">Escolha <b>Menino</b> ou <b>Menina</b> acima para liberar os temas.</div>';return;}themes.filter(t=>t.gender==='all'||t.gender===state.gender).forEach(t=>{const b=document.createElement('button');b.className='theme-card';b.innerHTML=`<div class="theme-cover" ${t.cover?`style="background-image:linear-gradient(0deg,rgba(5,8,23,.92),rgba(5,8,23,.05) 70%),url('${t.cover}')"`:''}><span>${t.tag}</span><b>${t.name}</b></div><p>${t.desc}</p><strong>Ver antes e depois →</strong>`;b.onclick=()=>openTheme(t);grid.appendChild(b);});}
document.querySelectorAll('.gender-option').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.gender-option').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');state.gender=btn.dataset.gender;state.theme=null;document.querySelector('#chosenThemeLabel').textContent='Escolha um tema acima';document.querySelector('#temas').classList.remove('locked-section');document.querySelector('#personalizar').classList.add('locked-section');document.querySelector('#precos').classList.add('locked-section');setGuide('theme');document.querySelector('#genderNote').textContent=`Perfeito. Agora escolha um dos temas para ${state.gender}.`;renderThemes();document.querySelector('#temas').scrollIntoView({behavior:'smooth'});});
document.querySelectorAll('.package').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.package').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');state.photos=+btn.dataset.package;state.basePrice=+btn.dataset.price;updateSummary();setGuide('to-preview');});
document.querySelector('#cake').onchange=e=>{state.cake=e.target.checked;updateSummary();};document.querySelector('#minusPerson').onclick=()=>{state.extraPeople=Math.max(0,state.extraPeople-1);document.querySelector('#extraPeople').textContent=state.extraPeople;updateSummary();};document.querySelector('#plusPerson').onclick=()=>{state.extraPeople=Math.min(3,state.extraPeople+1);document.querySelector('#extraPeople').textContent=state.extraPeople;updateSummary();};document.querySelector('#toThemes').onclick=()=>{if(!state.theme)return alert('Escolha primeiro um tema.');setGuide('upload');document.querySelector('#gerar').scrollIntoView({behavior:'smooth'});};
function openTheme(t){state.theme=t;metaTrack('ThemeViewed',{...trackingContext(),theme_id:t.id,theme_name:t.name,theme_tag:t.tag});document.querySelector('#themeBadge').textContent=t.tag.toUpperCase();document.querySelector('#themeName').textContent=t.name;document.querySelector('#themeDescription').textContent=t.desc;document.querySelector('#beforeAfter').innerHTML=t.examples.length?t.examples.map(pair=>`<article class="ba-example"><div class="ba-grid"><figure class="ba-photo"><span>ANTES</span><img src="${pair[0]}" alt="Foto original" loading="lazy"></figure><figure class="ba-photo after"><span>DEPOIS</span><img src="${pair[1]}" alt="Resultado Studio Infinity IA" loading="lazy"></figure></div><small class="ba-caption">Foto enviada → resultado Studio Infinity IA</small></article>`).join(''):`<div class="no-example">Quer um tema diferente? Selecione esta opção e fale com a gente no WhatsApp.</div>`;document.querySelector('#themeDetail').classList.remove('hidden');setGuide('choose-theme');document.querySelector('#themeDetail').scrollIntoView({behavior:'smooth',block:'start'});}
document.querySelector('#closeTheme').onclick=()=>document.querySelector('#themeDetail').classList.add('hidden');
document.querySelector('#chooseTheme').onclick=()=>{if(state.theme?.id==='outros'){window.open(cfg.whatsapp,'_blank');return;}metaTrack('ThemeSelected',trackingContext());document.querySelector('#chosenThemeLabel').textContent=state.theme.name;document.querySelector('#personalizar').classList.remove('locked-section');document.querySelector('#themeDetail').classList.add('hidden');setGuide('personalize');document.querySelector('#personalizar').scrollIntoView({behavior:'smooth'});};
const babyName=document.querySelector('#babyName'), babyMonths=document.querySelector('#babyMonths'), photoNotes=document.querySelector('#photoNotes'), minimalist=document.querySelector('#minimalist'), confirmPersonalization=document.querySelector('#confirmPersonalization');
const ageLabel=document.querySelector('#ageLabel');
const occasionButtons=[...document.querySelectorAll('.occasion-option')];
function applyOccasion(type){state.occasion=type==='aniversario'?'aniversario':'mesversario';occasionButtons.forEach(btn=>{const active=btn.dataset.occasion===state.occasion;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',active?'true':'false');});if(state.occasion==='mesversario'){ageLabel.textContent='Quantos meses está fazendo?';babyMonths.min='1';babyMonths.max='11';babyMonths.placeholder='Ex.: 3';}else{ageLabel.textContent='Quantos anos está fazendo?';babyMonths.min='1';babyMonths.max='99';babyMonths.placeholder='Ex.: 2';}babyMonths.value='';state.babyMonths='';validatePersonalization();}
occasionButtons.forEach(btn=>btn.addEventListener('click',()=>applyOccasion(btn.dataset.occasion)));
function validatePersonalization(){state.babyName=babyName.value.trim();state.babyMonths=babyMonths.value;state.photoNotes=photoNotes.value.trim();const age=Number(state.babyMonths);const validAge=state.occasion==='mesversario'?(age>=1&&age<=11):(age>=1&&age<=99);confirmPersonalization.disabled=!(state.babyName&&validAge);}
[babyName,babyMonths,photoNotes].forEach(el=>el.addEventListener('input',validatePersonalization));minimalist?.addEventListener('change',()=>{state.minimalist=!!minimalist.checked;});
confirmPersonalization.onclick=()=>{validatePersonalization();if(confirmPersonalization.disabled)return;document.querySelector('#precos').classList.remove('locked-section');setGuide('package');document.querySelector('#precos').scrollIntoView({behavior:'smooth'});};
const photo=document.querySelector('#photo');photo.onchange=()=>{document.querySelector('#fileName').textContent=photo.files[0]?photo.files[0].name:'';document.querySelector('#generate').disabled=!(photo.files[0]&&state.theme&&state.babyName&&state.babyMonths);if(photo.files[0])setGuide('generate');};
let progressTimer=null;
function startProgress(){const box=document.querySelector('#generationProgress'),bar=document.querySelector('#generationBar'),pct=document.querySelector('#generationPercent'),stage=document.querySelector('#generationStage');box.classList.remove('hidden');let n=4;const render=()=>{bar.style.width=`${n}%`;pct.textContent=`${n}%`;stage.textContent=n<22?'Enviando e preparando sua foto...':n<55?'Criando seu ensaio com IA...':n<82?'Refinando rosto, cenário e detalhes...':'Finalizando sua prévia protegida...';};render();progressTimer=setInterval(()=>{n=Math.min(92,n+(n<55?4:n<80?2:1));render();},1800);}
function finishProgress(){clearInterval(progressTimer);document.querySelector('#generationBar').style.width='100%';document.querySelector('#generationPercent').textContent='100%';document.querySelector('#generationStage').textContent='Prévia pronta!';setTimeout(()=>document.querySelector('#generationProgress').classList.add('hidden'),900);}
function stopProgress(){clearInterval(progressTimer);document.querySelector('#generationProgress').classList.add('hidden');}
function showPreview(url){if(!url)return;const img=document.querySelector('#previewImage');img.src=url;img.oncontextmenu=e=>e.preventDefault();img.ondragstart=e=>e.preventDefault();document.querySelector('#previewArea').classList.remove('hidden');setGuide('checkout');document.querySelector('#previewArea').scrollIntoView({behavior:'smooth'});}
document.querySelector('#previewCard').addEventListener('contextmenu',e=>e.preventDefault());
document.querySelector('#generate').onclick=async()=>{validatePersonalization();if(!state.theme||!photo.files[0]||!state.babyName||!state.babyMonths)return alert('Preencha o nome, selecione Mesversário ou Aniversário, informe a idade e selecione a foto.');const testDeviceSecret=localStorage.getItem('studio_test_device_secret');if(localStorage.getItem('studio_preview_used')==='1'&&!state.orderId&&!testDeviceSecret){alert('A prévia gratuita deste dispositivo já foi utilizada. Para ajustes ou um novo tema, fale conosco no WhatsApp.');return;}metaTrack('PreviewStarted',trackingContext());const btn=document.querySelector('#generate');btn.disabled=true;btn.textContent='CRIANDO SUA PRÉVIA...';if(testDeviceSecret){state.orderId=crypto.randomUUID();sessionStorage.setItem('studio_order_id',state.orderId);}else if(!state.orderId){state.orderId=crypto.randomUUID();sessionStorage.setItem('studio_order_id',state.orderId);}startProgress();try{const uploadImage=await prepareUploadImage(photo.files[0]);const fd=new FormData();fd.append('image',uploadImage);fd.append('orderId',state.orderId);fd.append('deviceId',deviceId);if(testDeviceSecret)fd.append('testDeviceSecret',testDeviceSecret);fd.append('gender',state.gender);fd.append('theme',state.theme.id);fd.append('themeName',state.theme.name);fd.append('occasion',state.occasion);fd.append('babyName',state.babyName);fd.append('babyMonths',state.babyMonths);fd.append('photoNotes',state.photoNotes);fd.append('minimalist',state.minimalist?'true':'false');fd.append('photos',state.photos);fd.append('cake',state.cake?'1':'0');fd.append('extraPeople',state.extraPeople);fd.append('total',total());const paidEntitlementOrderId=localStorage.getItem('studio_paid_entitlement_order_id');if(paidEntitlementOrderId)fd.append('paidEntitlementOrderId',paidEntitlementOrderId);const r=await fetch(cfg.apiEndpoint,{method:'POST',body:fd});const j=await r.json();if(!r.ok)throw new Error(j.error||'Não foi possível gerar a prévia.');
if(j.paid&&j.downloadUrl){
  finishProgress();
  document.querySelector('#previewArea').classList.add('hidden');
  document.querySelector('#paidArea').classList.remove('hidden');
  const a=document.querySelector('#downloadButton');a.href=j.downloadUrl;
  const remaining=document.querySelector('#remainingPhotos');
  if(remaining)remaining.textContent=j.remainingGenerations>0?`Você ainda tem ${j.remainingGenerations} foto(s) liberada(s) neste pedido.`:'Todas as fotos deste pedido já foram geradas.';
  const again=document.querySelector('#generateNextPaid');
  if(again)again.classList.toggle('hidden',!(j.remainingGenerations>0));
  if(!(j.remainingGenerations>0))localStorage.removeItem('studio_paid_entitlement_order_id');
  document.querySelector('#paidArea').scrollIntoView({behavior:'smooth'});
}else{
  if(!j.testDevice)localStorage.setItem('studio_preview_used','1');finishProgress();showPreview(j.previewUrl);metaTrack('PreviewGenerated',trackingContext());
}}catch(e){stopProgress();alert(e.message)}finally{btn.disabled=false;btn.textContent='GERAR PRÉVIA • PAGUE SÓ SE GOSTAR';}};
document.querySelector('#buyButton').onclick=()=>{if(!state.orderId)return alert('Gere sua prévia primeiro.');const finalTotal=total();const checkout=cfg.kiwify?.byTotal?.[finalTotal];if(!checkout)return alert(`Ainda não há checkout configurado para ${money(finalTotal)}. Fale conosco no WhatsApp para concluir seu pedido.`);metaTrack('InitiateCheckout',trackingContext(),true);metaTrack('KiwifyRedirect',trackingContext());sessionStorage.setItem('studio_waiting_payment','1');const checkoutUrl=new URL(checkout);checkoutUrl.searchParams.set('s1',state.orderId);window.location.href=checkoutUrl.toString();};
async function checkPayment(){
  if(!state.orderId)return;
  try{
    const r=await fetch(`${cfg.orderStatusEndpoint}?orderId=${encodeURIComponent(state.orderId)}`);
    if(!r.ok)return;
    const j=await r.json();
    if(j.paid&&j.downloadUrl){
      localStorage.removeItem('studio_preview_used');
      if(j.remainingGenerations>0)localStorage.setItem('studio_paid_entitlement_order_id',state.orderId);
      else localStorage.removeItem('studio_paid_entitlement_order_id');
      sessionStorage.removeItem('studio_waiting_payment');
      document.querySelector('#previewArea').classList.add('hidden');
      document.querySelector('#paidArea').classList.remove('hidden');
      const a=document.querySelector('#downloadButton');a.href=j.downloadUrl;
      const remaining=document.querySelector('#remainingPhotos');
      if(remaining)remaining.textContent=j.remainingGenerations>0?`Você ainda tem ${j.remainingGenerations} foto(s) liberada(s) neste pedido.`:'Sua foto está liberada em alta qualidade e sem marca-d’água.';
      const again=document.querySelector('#generateNextPaid');
      if(again)again.classList.toggle('hidden',!(j.remainingGenerations>0));
      document.querySelector('#paidArea').scrollIntoView({behavior:'smooth'});
    }else if(j.status==='preview_ready'&&j.previewUrl){
      localStorage.setItem('studio_preview_used','1');showPreview(j.previewUrl);
    }
  }catch{}
}
document.querySelector('#generateNextPaid')?.addEventListener('click',()=>{
  // Reabre o fluxo para a próxima foto já paga, sem novo checkout.
  state.orderId=null;
  sessionStorage.removeItem('studio_order_id');
  document.querySelector('#paidArea').classList.add('hidden');
  document.querySelector('#previewArea').classList.add('hidden');
  photo.value=''; document.querySelector('#fileName').textContent='';
  document.querySelector('#generate').disabled=true;
  window.scrollTo({top:0,behavior:'smooth'});
  setGuide('gender');
});

function setGuide(step){document.querySelectorAll('.funnel-glow').forEach(el=>el.classList.remove('funnel-glow'));document.querySelectorAll('.funnel-stage').forEach(el=>el.classList.remove('funnel-stage'));let el=null;if(step==='gender'){document.querySelector('#genderGrid')?.classList.add('funnel-stage');return;}if(step==='theme'){document.querySelector('#themeGrid')?.classList.add('funnel-stage');return;}if(step==='choose-theme')el=document.querySelector('#chooseTheme');if(step==='personalize')el=document.querySelector('#confirmPersonalization');if(step==='package')el=document.querySelector('.package.featured');if(step==='to-preview')el=document.querySelector('#toThemes');if(step==='upload')el=document.querySelector('.upload-box');if(step==='generate')el=document.querySelector('#generate');if(step==='checkout')el=document.querySelector('#buyButton');if(el)el.classList.add('funnel-glow');}
// Só recupera/exibe o pedido anterior quando o cliente realmente voltou do checkout.
// Abrir ou atualizar o site normalmente nunca deve puxar a prévia antiga para a tela.
const waitingPayment = sessionStorage.getItem('studio_waiting_payment') === '1';
if(state.orderId && waitingPayment){
  checkPayment();
  setInterval(checkPayment,8000);
}
document.querySelector('#previewArea')?.classList.add('hidden');
document.querySelector('#paidArea')?.classList.add('hidden');
document.querySelector('#thanksArea')?.classList.add('hidden');
renderThemes();updateSummary();setGuide(state.gender?'theme':'gender');
