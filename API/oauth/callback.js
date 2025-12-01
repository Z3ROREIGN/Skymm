import crypto from 'crypto';

function generateJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64');
  
  return `${header}.${body}.${signature}`;
}

export default async function handler(req, res) {
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
      }
