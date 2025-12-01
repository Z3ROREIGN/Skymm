# Skymm - Plataforma de Bots Discord

Sistema completo de vendas de bots Discord com autenticação OAuth, pagamento via PIX e notificações automáticas.

## 🚀 Estrutura do Projeto

```
skymm-fixed/
├── api/                      # Funções serverless (backend)
│   ├── oauth/
│   │   ├── login.js         # Iniciar login com Discord
│   │   └── callback.js      # Callback OAuth do Discord
│   ├── _utils.js            # Utilitários compartilhados
│   ├── pix-key.js           # Obter chave PIX
│   ├── create-order.js      # Criar pedido
│   └── submit-support.js    # Enviar suporte
├── index.html               # Frontend (SPA)
├── config.json              # Configuração dos produtos
├── vercel.json              # Configuração do Vercel
├── package.json             # Dependências do projeto
├── .gitignore               # Arquivos ignorados pelo Git
└── .env.example             # Exemplo de variáveis de ambiente
```

## 📋 Pré-requisitos

1. **Conta no Vercel** (gratuita): https://vercel.com
2. **Aplicação Discord OAuth**:
   - Acesse: https://discord.com/developers/applications
   - Crie uma nova aplicação
   - Vá em "OAuth2" e adicione a redirect URI: `https://seu-dominio.vercel.app/api/oauth/callback`
   - Copie o Client ID e Client Secret

3. **Webhook do Discord** (opcional):
   - No seu servidor Discord, vá em Configurações do Canal > Integrações > Webhooks
   - Crie um novo webhook e copie a URL

## 🔧 Configuração

### 1. Deploy no Vercel

#### Opção A: Via Interface Web (Recomendado)

1. Acesse https://vercel.com e faça login
2. Clique em "Add New Project"
3. Importe seu repositório Git ou faça upload do projeto
4. Configure as variáveis de ambiente (veja abaixo)
5. Clique em "Deploy"

#### Opção B: Via CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Fazer login
vercel login

# Deploy
cd skymm-fixed
vercel --prod
```

### 2. Configurar Variáveis de Ambiente no Vercel

No painel do Vercel, vá em **Settings > Environment Variables** e adicione:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DISCORD_CLIENT_ID` | ID da aplicação Discord | `1234567890123456789` |
| `DISCORD_CLIENT_SECRET` | Secret da aplicação Discord | `abc123def456ghi789` |
| `DISCORD_REDIRECT_URI` | URL de callback | `https://skymm.shop/api/oauth/callback` |
| `JWT_SECRET` | Chave secreta para JWT | `minha-chave-super-secreta-123` |
| `PIX_KEY` | Sua chave PIX | `seu@email.com` ou CPF/CNPJ |
| `DISCORD_WEBHOOK_URL` | Webhook para notificações (opcional) | `https://discord.com/api/webhooks/...` |

**⚠️ IMPORTANTE:** 
- Marque todas as variáveis para os ambientes: **Production**, **Preview** e **Development**
- Após adicionar as variáveis, faça um novo deploy para aplicar as mudanças

### 3. Configurar Produtos

Edite o arquivo `config.json` para personalizar seus produtos:

```json
{
  "products": [
    {
      "id": "bot-vendas",
      "name": "Bot de Vendas",
      "description": "Bot automático para gerenciar vendas no Discord",
      "price": "5.00",
      "features": [
        "Gerenciamento de produtos",
        "Sistema de pagamento PIX",
        "Notificações automáticas",
        "Suporte 24/7"
      ],
      "icon": "🤖",
      "badge": "Vendas"
    }
  ],
  "pixKey": "Será carregado do backend"
}
```

## 🧪 Testar Localmente

```bash
# Instalar dependências
npm install

# Criar arquivo .env com suas variáveis
cp .env.example .env
# Edite o .env com seus dados reais

# Iniciar servidor de desenvolvimento
npm run dev

# Acesse http://localhost:3000
```

## 🔒 Segurança

✅ **Implementado:**
- Variáveis sensíveis no backend (não expostas ao frontend)
- CORS configurado corretamente
- Validação de dados em todas as rotas
- JWT para autenticação
- CSRF protection com state no OAuth

## 🐛 Solução de Problemas

### Erro: "Discord OAuth não configurado"
- Verifique se as variáveis `DISCORD_CLIENT_ID` e `DISCORD_REDIRECT_URI` estão configuradas no Vercel
- Certifique-se de que a redirect URI no Discord Developer Portal corresponde exatamente à variável

### Erro: "Chave Pix não configurada"
- Configure a variável `PIX_KEY` no Vercel
- Faça um novo deploy após adicionar a variável

### Login não funciona
1. Verifique se a redirect URI está correta no Discord Developer Portal
2. Confirme que todas as variáveis de ambiente estão configuradas
3. Veja os logs no Vercel: Dashboard > Deployments > [seu deploy] > Functions

### Webhook não envia notificações
- Verifique se a variável `DISCORD_WEBHOOK_URL` está configurada
- Teste o webhook manualmente enviando uma requisição POST
- Verifique as permissões do webhook no Discord

## 📊 Monitoramento

Acesse o painel do Vercel para ver:
- Logs em tempo real
- Métricas de performance
- Erros e exceções
- Uso de recursos

## 🔄 Atualizações

Para atualizar o projeto:

```bash
# Fazer alterações no código
git add .
git commit -m "Descrição das mudanças"
git push

# O Vercel fará deploy automático
```

Ou use a CLI:

```bash
vercel --prod
```

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs no Vercel
2. Consulte a documentação do Discord: https://discord.com/developers/docs
3. Revise as configurações de variáveis de ambiente

## 📝 Licença

MIT License - Livre para uso pessoal e comercial.

---

**Desenvolvido para Vercel Serverless** ⚡
