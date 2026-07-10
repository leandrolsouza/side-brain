# Changelog

Todas as mudanças notáveis do SideBrain serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
