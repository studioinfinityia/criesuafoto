# Studio Infinity IA — experiência de compra em uma página

Projeto em pasta única, sem subpastas.

## Fluxo implementado na interface
1. Provas sociais / Instagram.
2. Escolha 1 foto (R$20) ou 2 fotos (R$25).
3. Opcionais: bolo temático +R$5; até 3 pessoas adicionais +R$5 cada.
4. Escolha de tema e galeria antes/depois.
5. Upload e geração da prévia.
6. Se gostar: checkout Kiwify. Se não: WhatsApp.
7. Após webhook de pagamento: liberação da mesma imagem original em alta qualidade.
8. Após download: agradecimento + CTA para Instagram.

## Segurança da prévia
Não é seguro carregar o original no navegador e apenas colocar uma imagem por cima com CSS: o original poderia ser extraído. O correto — e sem gastar tokens extras — é gerar UMA imagem com GPT Images, guardar o original de forma privada e criar no servidor uma cópia com a mesma marca-d'água para todas as prévias. A marca-d'água não usa GPT e não exige nova geração.

## Links já configurados
Instagram: https://www.instagram.com/studioinfinityia/
WhatsApp: https://wa.me/message/RERL7TJ3SJRBD1

## Próximas conexões
- Supabase: pedidos + storage privado.
- OpenAI GPT Images: geração única da imagem.
- Watermark no servidor.
- Kiwify: links de checkout + webhook.
- Prints/vídeo reais de depoimentos.
- Fotos reais de antes/depois por tema.
