# Configuração do Serviço de E-mail HTML - Cropflow

## Problema

Os e-mails de bloqueio/rejeição estão sendo enviados como texto simples ao invés de HTML formatado.

## Solução

É necessário atualizar o Google Apps Script que processa os e-mails para suportar HTML.

## Passos para Configuração

### 1. Acessar o Google Apps Script

1. Acesse: https://script.google.com/
2. Abra o projeto existente usado pelo Cropflow (ou crie um novo)

### 2. Atualizar o Código

Substitua o código existente pelo código fornecido no arquivo `google-apps-script-email.js`

### 3. Pontos Importantes do Código

O código agora processa dois campos importantes:

- **`html`**: Contém o HTML formatado (PRIORITÁRIO)
- **`body`**: Usado como fallback ou texto plano

A função `GmailApp.sendEmail()` agora usa a opção `htmlBody` que renderiza o HTML corretamente.

### 4. Testar o Script

Antes de publicar, teste usando a função `testEmail()`:

1. No editor do Google Apps Script, altere o e-mail de teste:
   ```javascript
   to: 'seu-email@exemplo.com'
   ```

2. Execute a função `testEmail` no menu superior

3. Verifique se recebeu um e-mail HTML formatado

### 5. Publicar/Implantar

1. Clique em **Implantar** > **Nova implantação**
2. Selecione tipo: **Aplicativo da Web**
3. Configure:
   - **Executar como**: Sua conta
   - **Quem tem acesso**: Qualquer pessoa
4. Clique em **Implantar**
5. Copie a **URL do aplicativo da Web**

### 6. Atualizar no Sistema Cropflow

1. No sistema Cropflow, vá para **Configurações**
2. Atualize a **URL do Serviço de E-mail** com a nova URL copiada
3. Use o botão **Testar E-mail** para validar

## Estrutura do Payload

O frontend agora envia:

```javascript
{
  to: "email@exemplo.com",
  subject: "🚫 Bloqueio: Pedido 12345 - Cropflow",
  body: "<html>...</html>",  // HTML formatado
  html: "<html>...</html>",  // HTML formatado (duplicado para compatibilidade)
  action: "notification"
}
```

## Características do E-mail HTML

- Cabeçalho vermelho com ícone de alerta
- Banner "AÇÃO NECESSÁRIA"
- Dados do pedido organizados em blocos
- Motivo do bloqueio destacado em vermelho
- Seção de itens rejeitados (quando aplicável)
- Observações adicionais em caixa amarela
- Call-to-action para acessar o sistema
- Rodapé com informações de copyright

## Solução de Problemas

### E-mail ainda chega como texto

- Verifique se o código do Google Apps Script foi atualizado
- Confirme que a implantação foi feita corretamente
- Teste usando a função `testEmail()`

### Erro ao enviar

- Verifique as permissões do Google Apps Script
- Confirme que o Gmail está autorizado a enviar e-mails
- Verifique os logs no Google Apps Script

### HTML não renderiza

- Alguns clientes de e-mail podem ter restrições
- Gmail, Outlook e a maioria dos webmails devem funcionar
- Teste em diferentes clientes de e-mail
