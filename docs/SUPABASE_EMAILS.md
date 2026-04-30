# Templates de E-mail do Supabase - Tá Na Mão

Copie os códigos abaixo e cole no painel do Supabase em **Authentication > Email > Templates**.

---

## 1. Confirmação de Cadastro (Confirm sign up)

**Subject (Assunto):** `Bem-vindo ao Tá Na Mão! Confirme seu e-mail`

**Código HTML:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <!-- Cabeçalho -->
    <div style="background-color: #10b981; padding: 30px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">Tá Na Mão</h1>
    </div>
    <!-- Corpo do E-mail -->
    <div style="padding: 30px;">
      <h2 style="color: #1f2937; margin-top: 0; font-size: 20px;">Falta pouco!</h2>
      <p style="color: #4b5563; line-height: 1.6; font-size: 15px;">Olá!</p>
      <p style="color: #4b5563; line-height: 1.6; font-size: 15px;">Ficamos muito felizes em ter você no <strong>Tá Na Mão</strong>. Para começar a usar o app e fazer seus pedidos, precisamos apenas que você confirme seu e-mail clicando no botão abaixo:</p>
      <div style="text-align: center; margin: 35px 0;">
        <a href="{{ .ConfirmationURL }}" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Confirmar Meu E-mail</a>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin-bottom: 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
        Se você não se cadastrou no Tá Na Mão, por favor, ignore este e-mail.
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Recuperação de Senha (Reset password)

**Subject (Assunto):** `Recuperação de Senha - Tá Na Mão`


> ⚠️ Para recuperação de senha, prefira `token_hash` (como no link acima) em vez de `{{ .ConfirmationURL }}` para evitar links com hash `#access_token=pkce_...` que podem abrir como inválidos em alguns navegadores/sessões.
**Código HTML:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <!-- Cabeçalho -->
    <div style="background-color: #10b981; padding: 30px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">Tá Na Mão</h1>
      <p style="color: #ecfdf5; margin: 5px 0 0 0; font-size: 14px;">O seu delivery rápido e fácil</p>
    </div>
    <!-- Corpo do E-mail -->
    <div style="padding: 30px;">
      <h2 style="color: #1f2937; margin-top: 0; font-size: 20px;">Recuperação de Senha</h2>
      <p style="color: #4b5563; line-height: 1.6; font-size: 15px;">Olá!</p>
      <p style="color: #4b5563; line-height: 1.6; font-size: 15px;">Recebemos um pedido para redefinir a senha da sua conta no <strong>Tá Na Mão</strong>. Clique no botão abaixo para criar uma nova senha:</p>
      <div style="text-align: center; margin: 35px 0;">
        <a href="https://www.tanamao.website/redefinir-senha?token_hash={{ .TokenHash }}&type=recovery" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Redefinir Minha Senha</a>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin-bottom: 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
        Se você não solicitou essa alteração ou lembrou da sua senha, pode ignorar este e-mail com segurança. Sua senha atual continuará funcionando.
      </p>
    </div>
  </div>
</body>
</html>
```
