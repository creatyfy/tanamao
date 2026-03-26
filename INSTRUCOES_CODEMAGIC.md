# Publicação iOS com Codemagic

O arquivo `codemagic.yaml` foi criado na raiz do seu projeto. Ele está configurado para:
1. Instalar as dependências do Node.js (Yarn)
2. Fazer o build do projeto Vite/React
3. Adicionar a plataforma iOS do Capacitor (caso ainda não exista no repositório)
4. Sincronizar os arquivos web com o projeto iOS
5. Instalar as dependências do CocoaPods
6. Assinar o app com seus certificados da Apple
7. Gerar o arquivo `.ipa`
8. Enviar automaticamente para o TestFlight / App Store Connect

## Como usar:

1. **Faça o commit do arquivo `codemagic.yaml`** para o seu repositório GitHub:
   ```bash
   git add codemagic.yaml
   git commit -m "Adiciona configuração do Codemagic para build iOS"
   git push
   ```

2. **Acesse o [Codemagic](https://codemagic.io/)** e faça login com seu GitHub.

3. **Adicione o aplicativo**:
   - Clique em "Add application"
   - Selecione seu repositório `creatyfy/tanamao`
   - Selecione o tipo de projeto como "Capacitor" ou "Other" (o Codemagic vai ler o `.yaml` automaticamente)

4. **Configure a integração com a Apple**:
   - No Codemagic, vá em **Teams > Personal Account > Integrations**
   - Conecte sua conta do **App Store Connect** (você precisará criar uma chave de API no App Store Connect em *Users and Access > Keys*)

5. **Inicie o Build**:
   - Volte para o seu app no Codemagic
   - Clique em "Start new build"
   - Selecione o workflow "iOS Release Build"

> **Nota sobre a pasta `ios`**: O script está configurado para rodar `npx cap add ios` automaticamente caso a pasta não exista no seu repositório. Isso é útil se você não commita a pasta `ios` no Git. Se você já tiver a pasta `ios` commitada, ele apenas fará o `sync`.
