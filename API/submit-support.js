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
    const { email, subject, message, userName, discordId, discordAvatar } = req.body;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    // Validações
    if (!email || !subject || !message || !userName) {
      return res.status(400).json({ error: 'Dados incompletos. Todos os campos são obrigatórios.' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    if (subject.length > 255) {
      return res.status(400).json({ error: 'Assunto muito longo (máximo 255 caracteres)' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Mensagem muito longa (máximo 5000 caracteres)' });
    }

    // Gerar dados do ticket
    const ticketId = generateOrderNumber();
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
        type: 'support',
        userName,
        discordId,
        discordAvatar,
        email,
        subject,
        message,
        ticketId,
        timestamp,
        webhookUrl,
      });
    } else {
      console.warn('[Submit Support] Webhook do Discord não configurado');
    }

    res.status(200).json({
      success: true,
      ticketId,
      timestamp,
      message: 'Solicitação de suporte enviada com sucesso',
    });
  } catch (error) {
    console.error('[API] Erro ao enviar suporte:', error);
    res.status(500).json({ error: 'Erro ao enviar suporte: ' + error.message });
  }
}
