export default function handler(req, res) {
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
}
