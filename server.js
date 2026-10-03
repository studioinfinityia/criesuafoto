const express=require('express');const multer=require('multer');const path=require('path');const app=express();const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024}});
app.use(express.static(__dirname));
app.post('/generate',upload.single('image'),async(req,res)=>{try{if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'A chave OPENAI_API_KEY ainda não foi configurada.'});if(!req.file)return res.status(400).json({error:'Envie uma imagem.'});
// A integração final com GPT Images será ativada na etapa OpenAI. O endpoint já fica protegido no servidor, sem expor a chave no navegador.
return res.status(501).json({error:'Estrutura pronta. Falta conectar a chamada final do GPT Images e o armazenamento privado antes de publicar para clientes.'});}catch(e){res.status(500).json({error:'Erro ao processar a geração.'})}});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));if(require.main===module)app.listen(process.env.PORT||3000);module.exports=app;
