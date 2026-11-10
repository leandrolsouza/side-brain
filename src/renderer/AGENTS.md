# Interface

- Componentes React ficam em `components`, estilos em `styles` e tipos compartilhados em `../shared/types`. Siga as convenções visuais e de acessibilidade dos componentes existentes.
- Acesse funcionalidades do processo principal por `window.electronAPI`; não importe módulos Node.js ou Electron diretamente na interface. Mudanças no contrato também exigem atualização do preload e, quando necessário, dos mocks dos testes.
- Adicione textos visíveis e rótulos acessíveis aos arquivos correspondentes de `locales/en` e `locales/pt-BR`, usando i18next. Ao criar um namespace, atualize `i18n/resources.ts` e a configuração em `i18n/index.ts`.
- Para alterações de comportamento, execute os testes relevantes em `tests/renderer`; para mudanças de traduções, inclua os testes de i18n.
