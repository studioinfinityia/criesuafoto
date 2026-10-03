const express=require('express');
const multer=require('multer');
const path=require('path');
const crypto=require('crypto');
const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024}});
app.use(express.json({limit:'2mb'}));
app.use(express.static(__dirname));

// MVP: as rotas estão prontas para receber OpenAI + Supabase na próxima etapa.
// REGRA DE SEGURANÇA: o navegador nunca deve receber o original sem marca-d'água antes do pagamento.
// A marca-d'água deve ser aplicada no servidor a uma cópia da imagem final; isso não consome tokens do GPT.
app.post('/api/generate',upload.single('image'),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({error:'Selecione uma foto.'});
    if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'A geração GPT Images ainda não foi conectada. O site e o fluxo já estão prontos; agora falta configurar a chave e o armazenamento privado.'});
    const orderId=crypto.randomUUID();
    // Próxima etapa: 1) gerar UMA imagem final com GPT Images; 2) salvar original em bucket privado;
    // 3) gerar uma cópia watermarked no servidor; 4) devolver SOMENTE a URL protegida da cópia.
    return res.status(501).json({error:'Chave detectada, mas falta concluir OpenAI + Supabase antes de liberar geração real para clientes.',orderId});
  }catch(e){res.status(500).json({error:'Erro ao criar a prévia.'});}
});

app.get('/api/order-status',async(req,res)=>{
  // Próxima etapa: consultar o pedido no Supabase. Só retornar downloadUrl assinada se payment_status === 'paid'.
  res.json({paid:false});
});

app.post('/api/kiwify-webhook',async(req,res)=>{
  // Próxima etapa: validar assinatura/evento da Kiwify e marcar o pedido como pago no Supabase.
  res.status(200).json({ok:true});
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
if(require.main===module)app.listen(process.env.PORT||3000);
module.exports=app;
