# Testes

- Os testes do processo principal usam Vitest em Node.js (`vitest.config.main.ts`); os da interface usam jsdom e Testing Library (`vitest.config.renderer.ts`). Coloque novos testes próximos dos testes existentes da mesma área.
- Para persistência, use o banco SQLite em memória e os mocks de Electron de `tests/main/setup.ts`; não use o banco real do usuário. Isole dados e restaure mocks entre testes conforme os padrões existentes.
- Os testes da interface inicializam i18n em pt-BR e fornecem um mock de `window.electronAPI` em `tests/renderer/setup.ts`. Atualize-o quando o contrato compartilhado exigir novos métodos.
- Rode `npm test` para o processo principal, `npm run test:renderer` para a interface ou `npm run test:all` para ambos. Para um teste específico, use a configuração Vitest correspondente; o módulo nativo precisa estar compilado para Node.js nos testes do processo principal.
