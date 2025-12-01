function generateOrderNumber() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function sendDiscordWebhook({ type, userName, discordId, discordAvatar, email, productName, orderNumber, proofId, timestamp, webhookUrl }) {
  try {
    if (!webhookUrl) {
      console.warn('[Discord] Webhook URL não configurada');
      return false;
    }

    const embed = {
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
    const { productId, productName, email, userName, discordId, discordAvatar } = req.body;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!productId || !productName || !email || !userName) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const orderNumber = generateOrderNumber();
    const proofId = generateOrderNumber();
    const timestamp = new Date().toLocaleString('pt-BR');

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
    }

    res.json({
      success: true,
      orderNumber,
      proofId,
      timestamp,
      message: 'Pedido criado com sucesso',
    });
  } catch (error) {
    console.error('[API] Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro ao criar pedido' });
  }
}
