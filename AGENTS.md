# Orientações para agentes

## Projeto

- SideBrain é um aplicativo Electron com TypeScript, React, Vite e SQLite (`better-sqlite3`). `src/main` contém o processo principal, `src/renderer` a interface e `src/shared/types` os contratos compartilhados.
- Mantenha a separação entre processos: a interface acessa recursos do Electron pelo preload e por IPC, sem acesso direto a Node.js. Consulte as instruções específicas em `src/main/AGENTS.md` e `src/renderer/AGENTS.md`.
- Siga os padrões existentes e a configuração do Biome: indentação de dois espaços, aspas simples e sem ponto e vírgula em JavaScript/TypeScript. Não altere arquivos gerados em `dist` ou dependências em `node_modules`.

## Verificação

- Execute verificações proporcionais à alteração: `npm run typecheck`, `npm run lint`, `npm test` para o processo principal e `npm run test:renderer` para a interface. `npm run build` verifica a compilação completa.
- `npm test` recompila `better-sqlite3` para Node.js; `npm run dev` e `npm start` o recompilam para Electron. Uma troca de ambiente pode exigir a recompilação correspondente.
- A CI usa Node.js 24. `npm run check-i18n` chama um script que recebe o caminho de um arquivo TSX via JSON na entrada padrão; sem essa entrada ele não valida todos os arquivos nem a paridade entre idiomas. Use também os testes de i18n para alterações de traduções.
- Para instruções de testes e isolamento, consulte `tests/AGENTS.md`.
