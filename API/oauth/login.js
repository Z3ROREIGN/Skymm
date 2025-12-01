export default function handler(req, res) {
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
}
