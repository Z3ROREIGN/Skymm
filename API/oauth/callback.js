import { generateJWT } from '../_utils.js';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { code, state } = req.query;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-me';

    if (!code || !state) {
      return res.status(400).json({ error: 'Código ou state não fornecido' });
    }

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ error: 'Configuração OAuth incompleta' });
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
      const errorData = await tokenResponse.text();
      console.error('[OAuth Callback] Erro ao obter token:', errorData);
      throw new Error('Erro ao obter token do Discord');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Obter informações do usuário
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      console.error('[OAuth Callback] Erro ao obter usuário:', errorData);
      throw new Error('Erro ao obter informações do usuário');
    }

    const discordUser = await userResponse.json();

    // Gerar JWT token
    const jwtToken = generateJWT({
      discordId: discordUser.id,
      username: discordUser.username,
      email: discordUser.email,
      timestamp: Date.now(),
    }, jwtSecret);

    // Construir URL de redirecionamento para o frontend
    const frontendUrl = redirectUri.split('/api')[0];
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.append('token', jwtToken);
    redirectUrl.searchParams.append('user', JSON.stringify({
      id: discordUser.id,
      username: discordUser.username,
      email: discordUser.email,
      avatar: discordUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator) % 5}.png`,
    }));

    // Redirecionar para o frontend com os dados
    res.redirect(302, redirectUrl.toString());
  } catch (error) {
    console.error('[OAuth Callback] Erro:', error);
    
    // Redirecionar para o frontend com erro
    const frontendUrl = process.env.DISCORD_REDIRECT_URI?.split('/api')[0] || 'https://skymm.shop';
    const errorUrl = new URL(frontendUrl);
    errorUrl.searchParams.append('error', 'login_failed');
    errorUrl.searchParams.append('message', error.message);
    
    res.redirect(302, errorUrl.toString());
  }
}
