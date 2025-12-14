/**
 * GOOGLE APPS SCRIPT - SERVIÇO DE E-MAIL CROPFLOW
 *
 * IMPORTANTE: Este código deve ser colado no Google Apps Script
 * em: https://script.google.com/
 *
 * Este script processa requisições POST do frontend e envia e-mails
 * formatados em HTML.
 */

function doPost(e) {
  try {
    // Parse do payload JSON
    const payload = JSON.parse(e.postData.contents);

    const to = payload.to;
    const subject = payload.subject || 'Notificação Cropflow';
    const htmlBody = payload.html || payload.body || '';
    const plainBody = payload.plainText || '';

    // Configuração do e-mail
    const emailConfig = {
      to: to,
      subject: subject,
      htmlBody: htmlBody
    };

    // Adiciona corpo em texto plano se fornecido (fallback)
    if (plainBody) {
      emailConfig.body = plainBody;
    }

    // Envia o e-mail via Gmail
    GmailApp.sendEmail(
      emailConfig.to,
      emailConfig.subject,
      plainBody || 'Por favor, habilite a visualização de HTML para ver este e-mail corretamente.',
      {
        htmlBody: emailConfig.htmlBody,
        name: 'Sistema Cropflow'
      }
    );

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'E-mail enviado com sucesso'
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Erro ao enviar e-mail: ' + error.toString());

    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Função para testes
function testEmail() {
  const testPayload = {
    to: 'seu-email@exemplo.com',
    subject: 'Teste de E-mail HTML - Cropflow',
    html: '<h1 style="color: red;">Teste de E-mail HTML</h1><p>Este é um teste do sistema Cropflow.</p>'
  };

  const mockEvent = {
    postData: {
      contents: JSON.stringify(testPayload)
    }
  };

  doPost(mockEvent);
}
