import crypto from 'crypto';

export function generateOrderNumber() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function generateJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64');
  
  return `${header}.${body}.${signature}`;
}

export async function sendDiscordWebhook({ type, userName, discordId, discordAvatar, email, productName, orderNumber, proofId, timestamp, subject, message, webhookUrl }) {
  try {
    if (!webhookUrl) {
      console.warn('[Discord] Webhook URL não configurada');
      return false;
    }

    let embed;
    
    if (type === 'order') {
      embed = {
        title: '🛒 Novo Pedido Realizado',
        color: 3654895,
        author: {
          name: userName,
          icon_url: discordAvatar,
        },
        fields: [
          { name: '👤 Usuário Discord', value: `${userName} (ID: ${discordId})`, inline: false },
          { name: '📧 Email', value: email, inline: false },
          { name: '🤖 Produto', value: productName, inline: false },
          { name: '📦 Número do Pedido', value: orderNumber, inline: true },
          { name: '🎟️ ID do Comprovante', value: proofId, inline: true },
          { name: '📅 Data e Hora', value: timestamp, inline: false },
        ],
        thumbnail: {
          url: discordAvatar,
        },
      };
    } else if (type === 'support') {
      embed = {
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
          { name: '📅 Data e Hora', value: timestamp, inline: false },
        ],
        thumbnail: {
          url: discordAvatar,
        },
      };
    }

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
