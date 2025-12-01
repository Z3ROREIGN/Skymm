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
    const pixKey = process.env.PIX_KEY;
    
    if (!pixKey) {
      return res.status(500).json({ 
        error: 'Chave Pix não configurada. Configure a variável PIX_KEY.' 
      });
    }

    res.status(200).json({ 
      pixKey: pixKey 
    });
  } catch (error) {
    console.error('[API] Erro ao buscar chave Pix:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
