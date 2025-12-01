import crypto from 'crypto';
import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(express.static('.'));

// Helpers
function generateOrderNumber() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function generateJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64');
  
  return `${header}.${body}.${signature}`;
}

async function sendDiscordWebhook({ type, userName, discordId, discordAvatar, email, productName, orderNumber, proofId, timestamp, subject, message, webhookUrl }) {
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

// Rotas
app.get('/api/oauth/login', (req, res) => {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({ 
        error: 'Discord OAuth não configurado' 
      });
    }

    const state = Math.random().toString(36).substring(7);
    
    res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

    const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
    discordAuthUrl.searchParams.append('client_id', clientId);
    discordAuthUrl.searchParams.append('redirect_uri', redirectUri);
    discordAuthUrl.searchParams.append('response_type', 'code');
    discordAuthUrl.searchParams.append('scope', 'identify email');
    discordAuthUrl.searchParams.append('state', state);

    res.json({ 
      authUrl: discordAuthUrl.toString(),
      message: 'Redirecione o usuário para esta URL'
    });
  } catch (error) {
    console.error('[OAuth] Erro:', error);
    res.status(500).json({ error: 'Erro ao iniciar login' });
  }
});

app.get('/api/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    const jwtSecret = process.env.JWT_SECRET;

    if (!code || !state) {
      return res.status(400).json({ error: 'Código ou state não fornecido' });
    }

    // Trocar código por token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Erro ao obter token do Discord');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Obter informações do usuário
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      throw new Error('Erro ao obter informações do usuário');
    }

    const discordUser = await userResponse.json();

    // Gerar JWT token
    const jwtToken = generateJWT({
      discordId: discordUser.id,
      username: discordUser.username,
      email: discordUser.email,
    }, jwtSecret);

    // Redirecionar para frontend com dados
    const frontendUrl = redirectUri.split('/api')[0];
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.append('token', jwtToken);
    redirectUrl.searchParams.append('user', JSON.stringify({
      id: discordUser.id,
      username: discordUser.username,
      email: discordUser.email,
      avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
    }));

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[OAuth Callback] Erro:', error);
    res.status(500).json({ error: 'Erro ao processar callback' });
  }
});

app.get('/api/pix-key', (req, res) => {
  try {
    const pixKey = process.env.PIX_KEY;
    
    if (!pixKey) {
      return res.status(500).json({ 
        error: 'Chave Pix não configurada' 
      });
    }

    res.json({ 
      pixKey: pixKey 
    });
  } catch (error) {
    console.error('[API] Erro ao buscar chave Pix:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/create-order', async (req, res) => {
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
});

app.post('/api/submit-support', async (req, res) => {
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

    const ticketId = generateOrderNumber();
    const timestamp = new Date().toLocaleString('pt-BR');

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
});

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile('./index.html', { root: '.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Rodando na porta ${PORT}`);
});

export default app;
