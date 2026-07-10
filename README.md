# SideBrain

<p align="center">
  <img src="assets/icon.png" alt="SideBrain" width="128" />
</p>

<p align="center">
  <strong>Seu segundo cérebro para organizar o trabalho.</strong>
</p>

Aplicativo desktop para organização de notas de trabalho com categorização automática por IA. Capture textos rápidos durante o dia e deixe a IA organizar em projetos, classificar por tipo e status, e reescrever para maior clareza.

## Funcionalidades

- **Captura Rápida** — Input de texto livre que é automaticamente categorizado em projetos, tipos de entrada e itens de ação
- **Projetos e Entradas** — Entradas organizadas por projeto com tipos customizáveis (informação, decisão, solicitação, ideia, bloqueio, atualização) e status de ação
- **Inbox de Revisão** — Sugestões da IA passam por workflow de revisão (auto-aprovado, pendente, aprovado, corrigido)
- **Kanban de Tarefas** — Tarefas derivadas das entradas com status (a fazer, em progresso, aguardando, concluído)
- **Resumo Diário (Digest)** — Resumo gerado por IA ao abrir o app com tarefas atrasadas, atividade do dia anterior e sugestões
- **Busca Global** — Ctrl+K para buscar em entradas, tarefas e projetos
- **Smart Chat** — Chat conversacional com contexto dos seus dados para perguntas sobre seu trabalho
- **Reuniões** — Modo de reunião para captura de notas com processamento por IA
- **Conexões** — Grafo visual de relações entre entradas e projetos
- **Relatórios** — Relatórios e insights sobre produtividade e atividade
- **Dashboard de Uso de IA** — Acompanhamento de consumo e custos da API de IA
- **Campos Customizáveis** — Tipos de entrada e status de ação personalizáveis
- **Auto-atualização** — Atualizações automáticas via GitHub Releases
- **Backup Automático** — Backups periódicos do banco de dados SQLite

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Electron 35 |
| Linguagem | TypeScript 5.8 (strict mode) |
| Frontend | React 19 + Vite 8 |
| Banco de Dados | better-sqlite3 (SQLite com WAL mode) |
| IA | Multi-provider (Bedrock, OpenAI, Gemini, Grok, LLM Local) |
| Ícones | lucide-react |
| Empacotamento | electron-builder |
| Testes | Vitest |

## Provedores de IA Suportados

| Provedor | Modelo Padrão |
|----------|---------------|
| AWS Bedrock | Claude Sonnet 4 |
| OpenAI | GPT-4.1 |
| Google Gemini | Gemini 3.5 Flash |
| Grok | Grok 4.3 |
| Local (OpenAI-compatível) | Configurável (ex: LM Studio) |

## Pré-requisitos

- Node.js 20+
- npm

## Instalação

```bash
git clone https://github.com/leandrolsouza/my-agent.git
cd my-agent
npm install
```

O `postinstall` executa `electron-rebuild` para compilar os módulos nativos (better-sqlite3).

## Desenvolvimento

```bash
npm run dev
```

Isso inicia em paralelo:
- Vite dev server (porta 5173) para o renderer
- TypeScript compiler em watch mode para o main process
- Electron apontando para o dev server

### Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Ambiente completo de desenvolvimento |
| `npm run build` | Build de produção (renderer + main) |
| `npm run build:renderer` | Build Vite do renderer |
| `npm run build:main` | Compilação TypeScript do main process |
| `npm run start` | Executa o app compilado |
| `npm test` | Executa testes com Vitest |
| `npm run test:watch` | Testes em watch mode |
| `npm run test:coverage` | Testes com cobertura |
| `npm run pack` | Empacota com electron-builder (sem distribuição) |
| `npm run dist` | Empacota para distribuição |

## Arquitetura

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # Entry point, criação de janela, shortcuts globais
│   ├── preload.ts           # Preload script (context bridge)
│   ├── database/
│   │   ├── schema.ts        # Schema SQLite, migrações, singleton do DB
│   │   └── repositories/    # Camada de acesso a dados (um arquivo por entidade)
│   ├── ipc/
│   │   └── handlers.ts      # Registro de handlers IPC (+ arquivos por domínio)
│   └── services/            # Lógica de negócio
├── renderer/                # React frontend (Vite-bundled)
│   ├── App.tsx              # Componente raiz, roteamento de views
│   ├── components/          # Componentes UI (um por arquivo)
│   └── styles/
│       └── global.css       # Estilos globais (tema inspirado no VS Code)
└── shared/
    └── types/               # Tipos de domínio compartilhados entre main e renderer
```

### Padrões Arquiteturais

- **Separação Main/Renderer** — Comunicação estrita via IPC. Sem acesso direto ao Node.js no renderer (`contextIsolation: true`, `nodeIntegration: false`)
- **Repository Pattern** — Acesso ao banco abstraído em classes por entidade
- **Service Layer** — Lógica de negócio em serviços que coordenam repositories e IA
- **IPC Handlers** — Handlers mapeiam canais IPC para métodos de serviços/repositories
- **Tipos Compartilhados** — Interfaces de domínio em `src/shared/types/`, consumidos por ambos os processos
- **Canais IPC** — Seguem o padrão `entidade:ação` (ex: `entry:create`, `task:getAll`)
- **IDs** — UUIDs para todas as entidades

## Build e Distribuição

O projeto usa `electron-builder` e GitHub Actions para CI/CD:

- **CI (Tests)** — Executa testes automaticamente em push/PR para main
- **Release** — Build automático para Windows (NSIS), macOS (DMG) e Linux (AppImage) ao criar uma tag `v*`
- **Auto-update** — `electron-updater` verifica novas versões via GitHub Releases

### Criar uma release

```bash
# Bump a versão no package.json, commit, e crie a tag
git tag v0.2.0
git push origin v0.2.0
```

O workflow de release cria builds para todas as plataformas e publica no GitHub Releases.

## Licença

Projeto privado.
