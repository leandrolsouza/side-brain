# Changelog

Todas as mudanças notáveis do SideBrain serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.10.1] - 2026-11-10

### Corrigido
- A reconexão de servidores MCP preserva a conexão automática após reiniciar o aplicativo.
- Credenciais não são gravadas em texto puro quando o armazenamento seguro está indisponível; valores existentes são preservados.

### Alterado
- Argumentos e variáveis de ambiente MCP passam a ser protegidos pelo armazenamento seguro do sistema; configurações antigas são migradas quando possível.
- Registros de erro deixam de incluir argumentos IPC, respostas brutas dos provedores e rastreamentos de pilha, reduzindo a exposição de dados sensíveis.
- As telas de configurações e reuniões foram divididas em componentes e controladores menores.

## [0.10.0] - 2026-11-09

### Adicionado
- Aprovação de ações de agentes, configuração de permissões e persistência do histórico de conversas.
- Proteções para acesso ao banco e testes para migrações, backups e ferramentas de agentes.

### Corrigido
- Persistência do idioma ao iniciar o aplicativo e trocar de workspace.
- Verificação de atualizações na tela Sobre, incluindo a apresentação de erros de acesso.
- Origem das atualizações e geração do pacote ZIP necessário para atualização no macOS.

### Alterado
- A release executa a CI e valida a versão, os manifestos e os artefatos antes da publicação.
- Reexecuções de builds em rascunho reutilizam a release sem apagar versões já publicadas.

## [0.9.0] - 2026-07-26

### Adicionado
- **Logger estruturado** com `electron-log` — `createScopedLogger()` para logging contextualizado no main process com fallback seguro para testes e ambientes sem Electron
- **Tipos MCP compartilhados** — `src/shared/types/mcp.ts` com interfaces `MCPServerConfig`, `MCPServerStatus` e `MCPToolInfo`
- **Scripts de qualidade de código** — `lint`, `lint:fix`, `format`, `typecheck` e `check-i18n` adicionados ao `package.json`
- **Biome** como linter e formatter unificado (substitui configurações ad-hoc)

### Alterado
- **AI Provider refatorado para arquitetura de adapters** — cada provedor (Bedrock, OpenAI, Gemini, Grok, Local, OpenAI-compatible) agora tem seu próprio adapter em `src/main/services/ai-providers/`; `AIProvider` funciona como facade de roteamento
- **Agent Studio desmembrado em subcomponentes** — `AgentStudio.tsx` reorganizado com componentes dedicados em `src/renderer/components/agent-studio/`: `AgentCreator`, `AgentList`, `AgentRunner`, `ExecutionDetail`, `ExecutionLog`, `MCPSettings`, `TeamCreator`, `TeamDiscussion`, `TeamList`, `TemplateSelector`
- **CSS global dividido em módulos temáticos** — `global.css` refatorado como index de imports; estilos separados em ~20 arquivos (`theme.css`, `layout.css`, `components.css`, `dashboard.css`, `kanban.css`, `entries.css`, `chat.css`, `meeting.css`, `settings.css`, `capture.css`, `notifications.css`, `reports.css`, `digest.css`, `search.css`, `forms.css`, `errors.css`, `workspace.css`, `misc.css`)
- **Dependências reorganizadas** — libs de frontend (`react`, `react-dom`, `lucide-react`, `i18next`, `react-i18next`, `react-force-graph-2d`, `react-markdown`, `remark-gfm`) movidas para `devDependencies`; `better-sqlite3` atualizado para `^13.0.1`; `electron-log` adicionado como dependência de runtime; removido `npm-check-updates` e `@types/uuid`
- **CI de release melhorado** — workflow `release.yml` usa matrix multi-plataforma (Windows/macOS/Linux) com upload de assets via script; comentários sobre code signing adicionados

### Removido
- `ReviewInbox.tsx` — componente removido (funcionalidade de revisão integrada ao fluxo principal)

## [0.8.0] - 2025-07-14

### Adicionado
- **Entry Templates & Snippets** — sistema completo de templates estruturados e snippets de texto
- Formulários guiados com campos tipados (texto, textarea, seleção, data, menção) para captura estruturada
- 5 templates padrão: Decisão, 1:1, Bug Report, Brainstorm, Standup
- **AI Auto-fill** — campos opcionais marcados com `aiAutoFill` são preenchidos automaticamente pela IA com base nos campos já informados
- **Snippets de captura rápida** — atalhos de texto ativados por `/` no textarea (ex: `/dec`, `/bug`, `/1on1`)
- 7 snippets padrão cobrindo decisões, demandas, bugs, atualizações, bloqueios e ideias
- Menu autocomplete inline com navegação por teclado (↑↓ Enter Esc) e tracking de uso
- `TemplateFormModal` — formulário dinâmico renderizado a partir da definição do template
- `SnippetAutocomplete` — componente de sugestão inline com filtragem em tempo real
- `TemplateManager` — interface de gerenciamento (CRUD) para templates e snippets customizados
- Migração #15 com tabelas `structured_templates` e `capture_snippets` + seeding automático
- IPC handlers dedicados para operações de templates/snippets (13 canais novos)
- Suporte completo a i18n (pt-BR e en) para toda a feature
- CSS dedicado (`templates.css`) para os novos componentes

### Alterado
- `CaptureInput` expandido com row de "Formulários", snippet autocomplete, e integração com TemplateFormModal
- Preload atualizado com 15 novos métodos na ElectronAPI
- AI Service expandido com método `autoFillTemplateFields`

## [0.7.0] - 2025-07-12

### Adicionado
- **Agent Studio** — interface completa para criar, configurar e executar agentes de IA
- Runtime de agentes com execução autônoma e ciclo de vida gerenciado
- Gerenciador MCP (Model Context Protocol) para conectar agentes a ferramentas externas
- Sistema de equipes (Teams) para orquestrar múltiplos agentes em tarefas complexas
- Repositórios de dados para agentes e equipes (CRUD completo)
- Tool Registry com ferramentas internas do SideBrain acessíveis pelos agentes
- IPC handlers dedicados para agentes, equipes e MCP
- Tipos compartilhados (`src/shared/types/agents.ts`) para todo o domínio de agentes

### Alterado
- Grafo de conexões agora respeita o tema ativo (cores adaptativas para dark/light)
- Lista de entradas simplificada com melhor performance
- AI Provider expandido com suporte a streaming e tool calling para agentes

## [0.6.0] - 2025-07-11

### Adicionado
- Vector embeddings para busca semântica potenciada por IA
- Histórico de conversas persistente no Smart Chat
- Geração de narrativa por IA nos relatórios de produtividade
- Sistema de feedback de categorização para aprendizado few-shot
- Executor de ações no Smart Chat (criar tarefas, entradas, etc. via conversa)

### Alterado
- README traduzido para inglês

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
