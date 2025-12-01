import { generateOrderNumber, validateEmail, sendDiscordWebhook } from './_utils.js';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { productId, productName, email, userName, discordId, discordAvatar } = req.body;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    // Validações
    if (!productId || !productName || !email || !userName) {
      return res.status(400).json({ error: 'Dados incompletos. Todos os campos são obrigatórios.' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // Gerar dados do pedido
    const orderNumber = generateOrderNumber();
    const proofId = generateOrderNumber();
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Enviar para Discord se webhook estiver configurado
    if (webhookUrl) {
      await sendDiscordWebhook({
        type: 'order',
        userName,
        discordId,
        discordAvatar,
        email,
        productName,
        orderNumber,
        proofId,
        timestamp,
        webhookUrl,
      });
    } else {
      console.warn('[Create Order] Webhook do Discord não configurado');
    }

    res.status(200).json({
      success: true,
      orderNumber,
      proofId,
      timestamp,
      message: 'Pedido criado com sucesso',
    });
  } catch (error) {
    console.error('[API] Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro ao criar pedido: ' + error.message });
  }
}
