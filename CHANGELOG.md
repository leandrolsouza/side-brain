# Changelog

Todas as mudanças notáveis do SideBrain serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.5.0] - 2025-07-11

### Adicionado
- Suporte multi-idioma com i18next e react-i18next
- Idiomas disponíveis: Português (BR), English, Español
- Seletor de idioma nas configurações
- Toda a interface traduzida via chaves i18n

## [0.4.3] - 2025-07-11

### Adicionado
- Opção "Usar existente" no diálogo de alterar local da database — quando a pasta de destino já contém um arquivo `.db`, o usuário pode optar por usar esse banco diretamente (sem mover nem criar novo)
- IPC `database:checkExists` para verificar se já existe um banco no caminho selecionado
- Suporte a `secondAlternativeLabel` / `onSecondAlternative` no ConfirmModal para diálogos com 3 ações

## [0.4.1] - 2025-07-10

### Segurança
- API keys (OpenAI, Gemini, Grok, Bedrock, Local) agora são criptografadas no banco usando `safeStorage` do Electron (DPAPI no Windows, Keychain no macOS)
- Migração automática converte chaves plain-text existentes para formato criptografado na primeira execução
- Adicionado `sandbox: true` explícito nas webPreferences da janela principal
- Handler `will-navigate` bloqueia navegação inesperada no renderer (prevenção de XSS)
- Handler `setWindowOpenHandler` controla abertura de novas janelas — links externos abrem no browser do sistema

### Alterado
- Chamadas HTTP do AI Provider migradas de `global.fetch` para `net.fetch` do Electron (suporte a proxy corporativo e stack de rede do Chromium)
- Notificações nativas agora usam `id` (deduplicação), `groupId` (agrupamento visual) e `groupTitle` (header de grupo no Windows) — features do Electron 43
- Novo método `dismissByType()` no NotificationService para limpar notificações entregues quando o usuário resolve a causa

### Adicionado
- Serviço `safe-storage-service.ts` para encrypt/decrypt transparente de credenciais
- Notificações agrupadas por categoria: Tarefas, Reuniões, IA, Insights

## [0.4.0] - 2025-07-10

### Alterado
- Atualização do Electron 35 → 43 e dependências principais (React 19.2, TypeScript 7.0, Vite 8.1, better-sqlite3 12.11, uuid 14)
- Script `dev` e `start` agora executam `electron-rebuild` automaticamente antes de iniciar
- Script `postinstall` inclui `npx install-electron` para garantir binário correto
- Novo script `rebuild:electron` dedicado ao rebuild de módulos nativos

### Corrigido
- Relatórios de atividade por dia da semana agora usam `localtime` no SQLite para respeitar o fuso horário do usuário
- Tela "Sobre" exibe versão correta do Electron (43)

## [0.3.9] - 2025-07-10

### Corrigido
- `ERR_FAILED (-2)` ao carregar em produção — atributo `crossorigin` nos scripts/CSS causava falha no protocolo `file://` dentro do asar
- Plugin Vite `removeCrossOrigin` remove o atributo no build para garantir compatibilidade com Electron em qualquer cenário
- Desabilitado module preload polyfill (desnecessário em Electron)

## [0.3.8] - 2025-07-10

### Adicionado
- Pesquisa e ordenação na lista de entradas de um projeto (por data, tipo, status)
- Reuniões agora podem marcar tasks como resolvidas durante a análise da ata
- Suporte a `resolvedTasks` no fluxo de processamento de reunião

### Corrigido
- Versão exibida no app mostrava 35.0.0 (Electron) em vez da versão real do app
- Scroll da lista de entradas não funcionava quando havia muitas entradas

## [0.3.7] - 2025-07-10

### Corrigido
- Import de base no onboarding voltava para tela inicial — agora grava `onboardingCompleted` na base restaurada antes de recarregar

## [0.3.6] - 2025-07-10

### Adicionado
- Caminho de "usuário existente" no onboarding: importar base .db de outra máquina
- Tela de boas-vindas agora oferece duas opções: "Começar do zero" ou "Já uso o SideBrain"
- Componente OnboardingImport com feedback de sucesso/erro e dica de como exportar

## [0.3.5] - 2025-07-10

### Adicionado
- Fluxo de onboarding na primeira execução com 4 etapas guiadas:
  - Tela de boas-vindas com visão geral do app
  - Configuração do provedor de IA (Bedrock, OpenAI, Gemini, Grok, Local)
  - Criação do primeiro projeto
  - Dicas rápidas de atalhos (Ctrl+Shift+Space, Ctrl+K)
- Progress dots visuais indicando etapa atual
- Todas as etapas são opcionais (usuário pode pular)
- Flag `onboardingCompleted` nas settings para controlar exibição

## [0.3.4] - 2025-07-10

### Corrigido
- `ERR_FAILED (-2)` ao carregar — CSP via meta tag bloqueava scripts/CSS no protocol `file://` dentro do asar
- CSP agora é aplicado via response headers no main process (compatível com asar e file://)
- Removido plugin `devCspPlugin` do Vite (desnecessário com CSP via headers)

## [0.3.3] - 2025-07-10

### Corrigido
- `better-sqlite3` era compilado para Node.js no CI ao invés de Electron, causando crash ao abrir (`NODE_MODULE_VERSION mismatch`)
- Workflow de release agora usa `npm ci --ignore-scripts` para deixar o `electron-builder` fazer o rebuild nativo correto
- Removido `npm test` duplicado do release (CI workflow `test.yml` já cobre)

## [0.3.2] - 2025-07-10

### Corrigido
- App não aparecia em máquinas novas (janela nunca se tornava visível)
- Adicionado single instance lock para evitar múltiplas instâncias conflitantes
- Failsafe de exibição: janela aparece em até 10s mesmo se `ready-to-show` não disparar
- Erros de carregamento do HTML agora são logados e exibidos ao usuário
- Handler global de exceções não capturadas para diagnóstico

## [0.3.1] - 2025-07-10

### Corrigido
- App não abria em produção devido a `require` de `package.json` com caminho inválido no asar
- Voltado a usar `app.getVersion()` que funciona corretamente em builds empacotados

## [0.3.0] - 2025-07-10

### Adicionado
- README do projeto com documentação completa
- Logo e ícones do app para todas as plataformas (Windows, macOS, Linux)
- Pasta `assets/` para ícones de empacotamento e `src/renderer/assets/` para logo na UI
- Versão centralizada via IPC (`app:getVersion`) — About e StatusBar consomem dinamicamente
- Botão "Verificar atualizações" no modal Sobre
- Geração de instalador MSI além do NSIS (exe) para Windows
- CHANGELOG do projeto

### Corrigido
- Versão exibida no app agora lê do `package.json` do projeto (antes mostrava versão do Electron em dev)

### Alterado
- Configuração `buildResources` do electron-builder aponta para `assets/`
- Logo real substituiu o ícone genérico no modal Sobre

## [0.2.0] - 2025-07-08

### Adicionado
- Auto-atualização via `electron-updater` com GitHub Releases
- `UpdaterService` com eventos encaminhados ao renderer
- Componente `UpdateNotification` na status bar
- IPC handlers para operações de atualização
- Workflow de CI para testes (`test.yml`)
- Workflow de release multi-plataforma (`release.yml`)

### Corrigido
- Suite de testes com rebuild do `better-sqlite3` para Node.js

## [0.1.0] - 2025-07-01

### Adicionado
- Captura rápida com categorização automática por IA (Bedrock, OpenAI, Gemini, Grok, LLM Local)
- Organização por projetos com tipos de entrada e status de ação customizáveis
- Inbox de revisão para sugestões da IA
- Kanban de tarefas com datas de vencimento
- Resumo diário (Daily Digest) gerado por IA
- Busca global (Ctrl+K) em entradas, tarefas e projetos
- Smart Chat com contexto dos dados do usuário
- Modo reunião com processamento de ata por IA
- Grafo de conexões entre entradas
- Relatórios e insights de produtividade
- Dashboard de uso de IA com tracking de custos
- Campos customizáveis (tipos de entrada e status de ação)
- Sistema de notificações com central
- Central de erros com logging automático
- Exportação de projetos em Markdown
- Configurações de aparência (fonte, tema, densidade)
- Sistema de workspaces com troca rápida
- Backup automático periódico do banco de dados
- Templates de captura rápida
