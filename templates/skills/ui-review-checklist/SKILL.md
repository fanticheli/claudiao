---
name: ui-review-checklist
description: Checklist completo para revisão de UI — hierarquia visual, acessibilidade, responsividade, estados interativos. Use antes de PR de frontend.
allowed-tools: Read, Grep, Glob, Bash, Edit
model: sonnet
---

# UI Review Checklist

Checklist estruturado para revisão de interfaces antes de merge/deploy.

## Quando ativar

Ative quando o usuário estiver:
- Revisando PR de frontend
- Fazendo QA visual de componentes
- Auditando acessibilidade
- Verificando responsividade

## Checklist

### Hierarquia Visual
- [ ] Hierarquia clara (títulos, subtítulos, corpo)
- [ ] Espaçamento consistente (múltiplos de 4px ou 8px)
- [ ] Tipografia com no máximo 2-3 tamanhos por tela
- [ ] Alinhamento consistente (grid/flexbox)

### Cores e Contraste
- [ ] Contraste texto/fundo passa WCAG AA (4.5:1 para texto, 3:1 para UI)
- [ ] Usa design tokens (sem cores hardcoded)
- [ ] Dark mode funciona (se aplicável)
- [ ] Informação não depende apenas de cor (use ícones/texto também)

### Estados Interativos
- [ ] Hover em elementos clicáveis
- [ ] Focus ring visível para navegação por teclado
- [ ] Active/pressed state
- [ ] Disabled state (visual + funcional)
- [ ] Loading state em botões durante requests
- [ ] Cursor correto (pointer, not-allowed, etc.)

### Estados de Conteúdo
- [ ] Loading (skeleton screens > spinners)
- [ ] Empty state (mensagem + CTA)
- [ ] Error state (mensagem clara + ação de recuperação)
- [ ] Success state (feedback de confirmação)

### Responsividade
- [ ] Mobile (320px) — sem scroll horizontal
- [ ] Tablet (768px)
- [ ] Desktop (1024px+)
- [ ] Touch targets mínimo 44x44px em mobile

### Acessibilidade
- [ ] Semântica HTML correta (button, nav, main, article)
- [ ] ARIA labels em elementos interativos
- [ ] Alt text em imagens
- [ ] Navegação completa por teclado (Tab, Enter, Escape)
- [ ] Screen reader faz sentido (teste com VoiceOver/NVDA)
- [ ] `prefers-reduced-motion` respeitado em animações

### Forms
- [ ] Labels associados a inputs
- [ ] Validação inline (não apenas on submit)
- [ ] Mensagens de erro específicas (não "campo inválido")
- [ ] Autocomplete attributes corretos
- [ ] Tab order lógico

### Performance Visual
- [ ] Imagens otimizadas (WebP/AVIF, lazy loading)
- [ ] Fonts com `font-display: swap`
- [ ] Nenhum layout shift visível (CLS)
- [ ] Transições suaves (não abrutas)
