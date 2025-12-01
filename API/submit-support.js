function generateTicketId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function sendDiscordWebhook({ userName, discordId, discordAvatar, email, subject, message, ticketId, timestamp, webhookUrl }) {
  try {
    if (!webhookUrl) {
      console.warn('[Discord] Webhook URL não configurada');
      return false;
    }

    const embed = {
      title: '🆘 Nova Solicitação de Suporte',
      color: 16755226,
      author: {
        name: userName,
        icon_url: discordAvatar,
      },
      fields: [
        { name: '👤 Usuário Discord', value: `${userName} (ID: ${discordId})`, inline: false },
        { name: '📧 Email', value: email, inline: false },
        { name: '📝 Assunto', value: subject, inline: false },
        { name: '💬 Mensagem', value: message.substring(0, 1024), inline: false },
        { name: '🎫 ID do Ticket', value: ticketId, inline: true },
        { name: '📅 Data e Hora', value: timestamp, inline: false },
      ],
      thumbnail: {
        url: discordAvatar,
      },
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      console.error('[Discord] Erro ao enviar webhook:', response.statusText);
      return false;
    }

    console.log('[Discord] Webhook enviado com sucesso');
    return true;
  } catch (error) {
    console.error('[Discord] Erro ao enviar webhook:', error);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email, subject, message, userName, discordId, discordAvatar } = req.body;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!email || !subject || !message || !userName) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    if (subject.length > 255) {
      return res.status(400).json({ error: 'Assunto muito longo' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Mensagem muito longa' });
    }

    const ticketId = generateTicketId();
    const timestamp = new Date().toLocaleString('pt-BR');

    if (webhookUrl) {
      await sendDiscordWebhook({
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
    }

    res.json({
      success: true,
      ticketId,
      message: 'Solicitação de suporte enviada com sucesso',
    });
  } catch (error) {
    console.error('[API] Erro ao enviar suporte:', error);
    res.status(500).json({ error: 'Erro ao enviar suporte' });
  }
}
