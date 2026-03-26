# Guia Passo a Passo: Publicando seu App iOS com Codemagic

O Codemagic é uma plataforma que vai pegar o código do seu GitHub, transformar em um aplicativo iOS (arquivo `.ipa`) e enviar direto para a Apple (TestFlight/App Store). Como você não tem um Mac para fazer isso manualmente, o Codemagic aluga um "Mac virtual" por alguns minutos para fazer esse trabalho para você.

Aqui está exatamente o que você precisa fazer, clique a clique:

## Passo 1: Preparar a Apple (App Store Connect)

Antes do Codemagic fazer a mágica, ele precisa de "permissão" da Apple para enviar o app em seu nome.

1. Acesse o [App Store Connect](https://appstoreconnect.apple.com/) e faça login com sua conta de desenvolvedor Apple.
2. Vá em **Usuários e Acesso** (Users and Access).
3. Clique na aba **Chaves** (Keys) e depois em **App Store Connect API**.
4. Clique no botão **+** para criar uma nova chave.
5. Dê um nome (ex: "Codemagic") e dê o acesso de **Administrador** (Admin) ou **Gerenciador de Apps** (App Manager).
6. Clique em **Gerar** (Generate).
7. **MUITO IMPORTANTE:** Baixe o arquivo `.p8` que foi gerado. Você só pode baixar isso UMA VEZ. Guarde-o com segurança.
8. Anote também o **Issuer ID** (ID do Emissor) e o **Key ID** (ID da Chave) que aparecem nessa mesma tela.

## Passo 2: Preparar o GitHub

O Codemagic precisa saber o que fazer. O arquivo `codemagic.yaml` que eu gerei é a "receita de bolo" para ele.

1. Pegue o arquivo `codemagic.yaml` que eu te enviei na mensagem anterior.
2. Coloque ele na pasta principal (raiz) do seu projeto `tanamao`.
3. Envie para o GitHub:
   ```bash
   git add codemagic.yaml
   git commit -m "Adiciona configuração do Codemagic"
   git push
   ```

## Passo 3: Configurar o Codemagic

Agora vamos conectar tudo!

1. Acesse [codemagic.io](https://codemagic.io/) e faça login usando sua conta do **GitHub**.
2. No menu lateral esquerdo, vá em **Teams** > **Personal Account** > **Integrations**.
3. Procure por **App Store Connect** e clique em **Connect**.
4. Preencha os dados que você pegou no Passo 1:
   - **Issuer ID**
   - **Key ID**
   - **API Key** (Faça upload do arquivo `.p8` que você baixou)
5. Clique em **Save**.

## Passo 4: Adicionar seu App no Codemagic

1. Volte para a tela inicial do Codemagic (clique na logo no canto superior esquerdo).
2. Clique no botão azul **Add application**.
3. Selecione **GitHub** como provedor.
4. Encontre e selecione o seu repositório `creatyfy/tanamao`.
5. Selecione o tipo de projeto. Escolha **Other** ou **Capacitor** (não importa muito, pois o Codemagic vai ler o arquivo `.yaml` automaticamente).
6. Clique em **Finish: Add application**.

## Passo 5: Rodar a Mágica!

1. Na tela do seu app no Codemagic, você verá um botão azul escrito **Start new build**. Clique nele.
2. Vai abrir uma janelinha. Em "Workflow", certifique-se de que está selecionado **iOS Release Build** (esse é o nome que eu coloquei no arquivo `.yaml`).
3. Clique em **Start new build**.

**E pronto!** Agora é só esperar. O Codemagic vai:
- Ligar um Mac virtual
- Baixar seu código
- Instalar tudo
- Gerar o app iOS
- Assinar com seus certificados da Apple
- Enviar direto para o TestFlight

Isso deve levar de 10 a 20 minutos. Quando terminar, você receberá um e-mail da Apple dizendo que seu app está pronto para ser testado no TestFlight!
