/**
 * API Backend Segura para Skymm com OAuth Discord
 * 
 * Este arquivo contém os endpoints que devem ser implementados no seu backend
 * Todas as variáveis sensíveis são lidas de process.env (Vercel)
 * 
 * Deploy: Vercel (Node.js/Express)
 */

import crypto from 'crypto';

// ============================================
// CONFIGURAÇÃO SEGURA (Variáveis de Ambiente)
// ============================================

const getConfig = () => ({
  // Variáveis de Ambiente da Vercel
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback',
  },
  payment: {
    pixKey: process.env.PIX_KEY,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  environment: process.env.NODE_ENV || 'production',
});

// ============================================
// VALIDAÇÕES
// ============================================

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function generateOrderNumber() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================
// OAUTH DISCORD
// ============================================

/**
 * GET /api/oauth/login
 * Redireciona o usuário para Discord OAuth
 */
export async function handleOAuthLogin(req, res) {
  try {
    const config = getConfig();

    if (!config.discord.clientId) {
      return res.status(500).json({ 
        error: 'Discord OAuth não configurado' 
      });
    }

    // Gerar state para segurança CSRF
    const state = generateState();
    
    // Armazenar state em cookie (você pode usar sessão também)
    res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

    // Construir URL de autorização do Discord
    const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
    discordAuthUrl.searchParams.append('client_id', config.discord.clientId);
    discordAuthUrl.searchParams.append('redirect_uri', config.discord.redirectUri);
    discordAuthUrl.searchParams.append('response_type', 'code');
    discordAuthUrl.searchParams.append('scope', 'identify email');
    discordAuthUrl.searchParams.append('state', state);

    res.json({ 
      authUrl: discordAuthUrl.toString(),
      message: 'Redirecione o usuário para esta URL'
    });
  } catch (error) {
    console.error('[OAuth] Erro ao gerar login URL:', error);
    res.status(500).json({ error: 'Erro ao iniciar login' });
  }
}

/**
 * GET /api/oauth/callback
 * Callback do Discord após autorização
 */
export async function handleOAuthCallback(req, res) {
  try {
    const { code, state } = req.query;
    const config = getConfig();

    if (!code || !state) {
      return res.status(400).json({ 
        error: 'Código ou state não fornecido' 
      });
    }

    // Validar state (CSRF protection)
    const cookieState = req.headers.cookie
      ?.split('; ')
      .find(row => row.startsWith('oauth_state='))
      ?.split('=')[1];

    if (cookieState !== state) {
      return res.status(400).json({ 
        error: 'State inválido - possível ataque CSRF' 
      });
    }

    // Trocar código por token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.discord.redirectUri,
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

    // Aqui você salvaria o usuário no banco de dados
    // const user = await saveOrUpdateUser({
    //   discordId: discordUser.id,
    //   discordUsername: discordUser.username,
    //   discordEmail: discordUser.email,
    //   discordAvatar: discordUser.avatar,
    // });

    // Gerar JWT token (você pode usar uma biblioteca como jsonwebtoken)
    const jwtToken = generateJWT({
      discordId: discordUser.id,
      username: discordUser.username,
      email: discordUser.email,
    }, config.jwt.secret);

    // Redirecionar para frontend com token
    const redirectUrl = new URL(`${config.discord.redirectUri.split('/api')[0]}/`);
    redirectUrl.searchParams.append('token', jwtToken);
    redirectUrl.searchParams.append('user', JSON.stringify({
      id: discordUser.id,
      username: discordUser.username,
      email: discordUser.email,
      avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
    }));

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[OAuth] Erro no callback:', error);
    res.status(500).json({ error: 'Erro ao processar callback' });
  }
}

/**
 * GET /api/oauth/logout
 * Faz logout do usuário
 */
export async function handleOAuthLogout(req, res) {
  try {
    // Limpar cookie de sessão
    res.setHeader('Set-Cookie', 'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    
    res.json({ 
      success: true,
      message: 'Logout realizado com sucesso'
    });
  } catch (error) {
    console.error('[OAuth] Erro ao fazer logout:', error);
    res.status(500).json({ error: 'Erro ao fazer logout' });
  }
}

/**
 * GET /api/auth/me
 * Retorna informações do usuário autenticado
 */
export async function handleGetMe(req, res) {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const token = authHeader.substring(7);
    const config = getConfig();

    // Verificar e decodificar JWT
    const user = verifyJWT(token, config.jwt.secret);
    
    if (!user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    res.json({ 
      user: {
        id: user.discordId,
        username: user.username,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('[Auth] Erro ao obter usuário:', error);
    res.status(401).json({ error: 'Não autenticado' });
  }
}

// ============================================
// ENDPOINTS DE PEDIDOS E SUPORTE
// ============================================

/**
 * GET /api/pix-key
 * Retorna a chave Pix de forma segura
 */
export async function handleGetPixKey(req, res) {
  try {
    const config = getConfig();
    
    if (!config.payment.pixKey) {
      return res.status(500).json({ 
        error: 'Chave Pix não configurada' 
      });
    }

    res.json({ 
      pixKey: config.payment.pixKey 
    });
  } catch (error) {
    console.error('[API] Erro ao buscar chave Pix:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * POST /api/create-order
 * Cria um novo pedido e envia notificação para Discord
 */
export async function handleCreateOrder(req, res) {
  try {
    const { productId, productName, email, userName, discordId, discordAvatar } = req.body;
    const config = getConfig();

    // Validações
    if (!productId || !productName || !email || !userName) {
      return res.status(400).json({ 
        error: 'Dados incompletos' 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        error: 'Email inválido' 
      });
    }

    // Gerar IDs únicos
    const orderNumber = generateOrderNumber();
    const proofId = generateOrderNumber();
    const timestamp = new Date().toLocaleString('pt-BR');

    // Aqui você salvaria no banco de dados
    // await saveOrderToDatabase({ productId, productName, email, orderNumber, proofId, timestamp, discordId });

    // Enviar notificação para Discord (seguro - webhook URL está em process.env)
    if (config.discord.webhookUrl) {
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
        webhookUrl: config.discord.webhookUrl,
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

/**
 * POST /api/submit-support
 * Cria um ticket de suporte e envia notificação para Discord
 */
export async function handleSubmitSupport(req, res) {
  try {
    const { email, subject, message, userName, discordId, discordAvatar } = req.body;
    const config = getConfig();

    // Validações
    if (!email || !subject || !message || !userName) {
      return res.status(400).json({ 
        error: 'Dados incompletos' 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        error: 'Email inválido' 
      });
    }

    if (subject.length > 255) {
      return res.status(400).json({ 
        error: 'Assunto muito longo' 
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({ 
        error: 'Mensagem muito longa' 
      });
    }

    const ticketId = generateOrderNumber();
    const timestamp = new Date().toLocaleString('pt-BR');

    // Aqui você salvaria no banco de dados
    // await saveSupportTicketToDatabase({ email, subject, message, ticketId, timestamp, discordId });

    // Enviar notificação para Discord (seguro - webhook URL está em process.env)
    if (config.discord.webhookUrl) {
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
        webhookUrl: config.discord.webhookUrl,
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

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Gera um JWT token
 */
function generateJWT(payload, secret) {
  // Implementação simplificada - use jsonwebtoken em produção
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64');
  
  return `${header}.${body}.${signature}`;
}

/**
 * Verifica e decodifica um JWT token
 */
function verifyJWT(token, secret) {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64');
    
    if (signature !== expectedSignature) {
      return null;
    }

    return JSON.parse(Buffer.from(body, 'base64').toString());
  } catch (error) {
    return null;
  }
}

/**
 * Envia notificação para Discord via webhook
 * A URL do webhook é lida de process.env.DISCORD_WEBHOOK_URL
 */
async function sendDiscordWebhook({ 
  type, 
  userName, 
  discordId, 
  discordAvatar,
  email, 
  productName, 
  orderNumber, 
  proofId, 
  subject, 
  message, 
  ticketId, 
  timestamp, 
  webhookUrl 
}) {
  try {
    if (!webhookUrl) {
      console.warn('[Discord] Webhook URL não configurada');
      return false;
    }

    let embed;

    if (type === 'order') {
      embed = {
        title: '🛒 Novo Pedido Realizado',
        color: 3654895, // Azul
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
        color: 16755226, // Laranja
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

// ============================================
// EXEMPLO: Express.js Setup
// ============================================

/*
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// OAuth Routes
app.get('/api/oauth/login', handleOAuthLogin);
app.get('/api/oauth/callback', handleOAuthCallback);
app.get('/api/oauth/logout', handleOAuthLogout);
app.get('/api/auth/me', handleGetMe);

// API Routes
app.get('/api/pix-key', handleGetPixKey);
app.post('/api/create-order', handleCreateOrder);
app.post('/api/submit-support', handleSubmitSupport);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📝 Variáveis de ambiente carregadas`);
});
*/

// ============================================
// VARIÁVEIS DE AMBIENTE NECESSÁRIAS NA VERCEL
// ============================================

/*
DISCORD_CLIENT_ID = seu_client_id
DISCORD_CLIENT_SECRET = seu_client_secret
DISCORD_REDIRECT_URI = https://seu-dominio.vercel.app/api/oauth/callback
DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
PIX_KEY = willianwca2011@gmail.com
DATABASE_URL = mysql://user:password@host:port/database
JWT_SECRET = sua_chave_secreta_super_segura
NODE_ENV = production
*/

export { 
  getConfig, 
  validateEmail, 
  generateOrderNumber, 
  generateState,
  sendDiscordWebhook,
  generateJWT,
  verifyJWT,
  handleOAuthLogin,
  handleOAuthCallback,
  handleOAuthLogout,
  handleGetMe,
};
