# Processo principal

- Separe acesso a dados em `database/repositories`, regras de negócio em `services` e comunicação em `ipc`. Reutilize os padrões e serviços existentes.
- Ao adicionar ou alterar uma operação IPC, mantenha alinhados o handler de domínio, seu registro em `ipc/handlers.ts` quando aplicável, a implementação e a interface `ElectronAPI` em `preload.ts`, e os tipos compartilhados. Use os padrões de tratamento de erros existentes, incluindo `safeHandle` onde apropriado.
- Preserve a segurança da fronteira Electron: exponha operações específicas pelo `contextBridge`, sem expor acesso genérico a IPC ou Node.js. Não registre credenciais ou dados sensíveis.
- Em alterações de banco, preserve dados existentes. Acrescente migrações versionadas ao fim da lista em `database/schema.ts`, sem reescrever migrações já executadas; considere bancos novos e existentes. Cubra mudanças de persistência e migração com testes apropriados.
- Textos do processo principal ficam em `i18n/locales/en` e `i18n/locales/pt-BR`; mantenha os dois idiomas coerentes.
