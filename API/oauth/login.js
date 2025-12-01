export default function handler(req, res) {
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
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({ 
        error: 'Discord OAuth não configurado. Verifique as variáveis de ambiente.' 
      });
    }

    const state = Math.random().toString(36).substring(7);
    
    // Configurar cookie de estado para validação CSRF
    res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

    const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
    discordAuthUrl.searchParams.append('client_id', clientId);
    discordAuthUrl.searchParams.append('redirect_uri', redirectUri);
    discordAuthUrl.searchParams.append('response_type', 'code');
    discordAuthUrl.searchParams.append('scope', 'identify email');
    discordAuthUrl.searchParams.append('state', state);

    res.status(200).json({ 
      authUrl: discordAuthUrl.toString(),
      message: 'Redirecione o usuário para esta URL'
    });
  } catch (error) {
    console.error('[OAuth Login] Erro:', error);
    res.status(500).json({ error: 'Erro ao iniciar login: ' + error.message });
  }
}
