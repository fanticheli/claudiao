---
name: ui-review-checklist
description: Checklist completo para revisão de UI — hierarquia visual, acessibilidade, responsividade, estados interativos. Use antes de PR de frontend.
allowed-tools: Read, Grep, Glob, Bash, Edit
model: sonnet
---

# UI Review Checklist

Checklist estruturado para revisão de interfaces antes de PR/merge/deploy.
Inclui comandos de teste automatizado (axe, Lighthouse, Playwright) pra
validação objetiva.

## Quando ativar

- Revisando PR de frontend
- Fazendo QA visual de componentes
- Auditando acessibilidade
- Verificando responsividade
- Implementando componente novo do design system

---

## Checklist

### Hierarquia Visual

- [ ] Hierarquia clara — título > subtítulo > corpo, via tamanho/peso
- [ ] Espaçamento consistente em múltiplos de 4px ou 8px
- [ ] Tipografia com **no máximo 2-3 tamanhos** por tela
- [ ] Alinhamento consistente (grid ou flexbox, não inline hacks)
- [ ] Proximidade: elementos relacionados próximos, separados dos outros
- [ ] Densidade adequada ao contexto (dashboard denso OK, landing page arejada)

### Cores e Contraste

- [ ] Contraste WCAG AA: **4.5:1 texto normal**, **3:1 texto grande/UI**
- [ ] Contraste AAA onde crítico (input labels, mensagens de erro)
- [ ] Usa design tokens (CSS vars ou theme object), **sem cores hardcoded**
- [ ] Informação **não depende apenas de cor** — ícone + texto + cor
- [ ] Dark mode funcional (se aplicável) — todos os elementos, inclusive sombras
- [ ] Estados de erro/sucesso distinguíveis pra daltônicos (ícone + cor)

### Estados Interativos

- [ ] **Hover** em todos os elementos clicáveis
- [ ] **Focus ring visível** pra navegação por teclado — nunca `outline: none` sem substituto
- [ ] **Active/pressed** state
- [ ] **Disabled** state visual + atributo `disabled` ou `aria-disabled`
- [ ] **Loading** state em botões durante requests (spinner + texto ou skeleton)
- [ ] Cursor correto: `pointer` em clicáveis, `not-allowed` em disabled
- [ ] Transições **≤200ms** em micro-interações (senão parece lag)

### Estados de Conteúdo

- [ ] **Loading** — skeleton screens > spinners (reduz percepção de espera)
- [ ] **Empty state** — mensagem explicativa + CTA pra próxima ação
- [ ] **Error state** — mensagem clara + ação de recuperação (retry, contato)
- [ ] **Success state** — confirmação visual (toast, check, etc)
- [ ] **Partial success** — UI clara quando X de N itens deu certo

### Responsividade

- [ ] **Mobile 320px** sem scroll horizontal (testa em iPhone SE)
- [ ] **Tablet 768px** layout adapta (não é mobile esticado)
- [ ] **Desktop 1024px+** usa espaço disponível
- [ ] **Desktop 1920px+** não fica ridiculamente largo (max-width em containers)
- [ ] **Touch targets ≥44x44px** em mobile (Apple HIG / MD guideline)
- [ ] Gestos mobile funcionam (swipe em carousel, pull-to-refresh se aplicável)
- [ ] Orientação landscape em mobile não quebra

### Acessibilidade (A11y)

- [ ] **Semântica HTML** correta: `<button>` pra ações, `<a>` pra navegação
- [ ] Landmarks: `<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>`
- [ ] Headings em ordem sequencial: H1 → H2 → H3 (sem pular)
- [ ] `alt` em imagens: descritivo pra conteúdo, `alt=""` pra decorativas
- [ ] **Navegação completa por teclado**: Tab ordem lógica, Enter, Escape
- [ ] `aria-label` em botões só-ícone
- [ ] `aria-invalid` + `aria-describedby` em inputs com erro
- [ ] `aria-live="polite"` em regiões com conteúdo dinâmico (toast, erro)
- [ ] **Focus trap** em modals (não deixa focus escapar)
- [ ] `Escape` fecha modals e drawers
- [ ] Screen reader faz sentido (teste com VoiceOver/NVDA)
- [ ] `prefers-reduced-motion: reduce` respeitado em animações
- [ ] `prefers-color-scheme` respeitado pra dark/light

### Forms

- [ ] `<label for="x">` explicitamente associado ao input
- [ ] **Validação inline** (on blur), não apenas on submit
- [ ] Mensagens de erro **específicas**: "Formato: 000.000.000-00", não "inválido"
- [ ] `autocomplete` attributes corretos: `email`, `tel`, `street-address`, `postal-code`
- [ ] `type` correto: `email`, `tel`, `number`, `url`
- [ ] `inputmode` pra teclados mobile: `numeric`, `decimal`, `tel`, `email`
- [ ] **Tab order lógico** (top-to-bottom, left-to-right)
- [ ] Password field com toggle show/hide + `autocomplete="current-password"`
- [ ] **Prevent double-submit** — botão desabilita + loading durante request
- [ ] Autosave em forms longos (localStorage ou backend)
- [ ] `noValidate` no form + validação custom (mais consistente que nativa)

### Performance Visual

- [ ] Imagens **otimizadas** (WebP/AVIF, srcset pra responsive)
- [ ] **Lazy loading** em imagens abaixo do fold: `loading="lazy"`
- [ ] Fonts com `font-display: swap` (evita FOIT)
- [ ] Preload de fonts críticas (`<link rel="preload" as="font">`)
- [ ] **Nenhum layout shift visível** (CLS <0.1) — altura reservada pra imagens/embeds
- [ ] Skeleton com **dimensões do conteúdo final** (não genéricas)
- [ ] Transições suaves (não abrutas) — use `transform`/`opacity`, evita `top/left`
- [ ] Bundle do JS crítico <200KB gzipped

### Internacionalização (i18n)

- [ ] Textos via i18n (não hardcoded) se app multi-idioma
- [ ] Datas/números formatados por locale (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
- [ ] **Pluralização** correta (não `items(s)`)
- [ ] Suporte a RTL se serve árabe/hebraico (`dir="rtl"`, CSS logical properties)
- [ ] Strings **expandem 40%** (alemão/francês) sem quebrar layout

### Dark Mode (se aplicável)

- [ ] Todas as cores usam tokens (`var(--color-bg)` em vez de `#fff`)
- [ ] Sombras adaptam ao dark mode (sombras pretas somem em fundo preto)
- [ ] Imagens têm versão dark se têm fundo branco
- [ ] `color-scheme: light dark` no CSS pra ajuste de scrollbars/forms nativos
- [ ] Preferência persistida (localStorage + `prefers-color-scheme` como default)

---

## Comandos de Validação Automatizada

```bash
# Lighthouse CI (perf, a11y, best practices, SEO)
npx lighthouse https://localhost:3000 --only-categories=accessibility,performance --output=html --output-path=./lh.html

# axe-core (a11y profunda, mais severa que Lighthouse)
npx @axe-core/cli https://localhost:3000 --tags wcag2a,wcag2aa

# Playwright com axe (integrado)
# npx playwright test --grep "a11y"
# (scripts devem usar @axe-core/playwright)

# pa11y (alternativa a axe)
npx pa11y https://localhost:3000

# Storybook a11y addon (componente por componente)
# npm run storybook
# aba "Accessibility" em cada story

# Chrome DevTools — Coverage, Rendering, Performance tabs
# Rendering > paint flashing: ver re-renders visuais
# Rendering > layout shift regions: ver CLS

# Responsive manual:
# - DevTools > Toggle device toolbar
# - Testar: iPhone SE (375px), iPhone 14 (390px), iPad (768px), Desktop (1440px)
```

---

## Componentes Complexos — Checklists Específicos

### Modal / Dialog
- [ ] `role="dialog"` ou `role="alertdialog"`
- [ ] `aria-labelledby` apontando pro título
- [ ] Focus vai pro primeiro elemento focável ao abrir
- [ ] Focus trap enquanto aberto
- [ ] Focus volta pro gatilho ao fechar
- [ ] `Escape` fecha
- [ ] Click fora fecha (ou não — decisão explícita do design)
- [ ] Scroll do body travado enquanto aberto
- [ ] Portal renderizado fora da árvore (evita z-index hell)

### Dropdown / Combobox
- [ ] `role="combobox"` + `aria-expanded`
- [ ] Setas navegam opções
- [ ] Enter seleciona
- [ ] Escape fecha
- [ ] Type-ahead pula pra opção começando com letra
- [ ] Posicionamento inteligente (flipa pra cima se não cabe embaixo)

### Tabela
- [ ] `<table>` semântico com `<thead>`, `<tbody>`
- [ ] `scope="col"` em th
- [ ] `<caption>` com título da tabela
- [ ] Linhas selecionáveis têm `aria-selected`
- [ ] Header sticky em scroll vertical longo
- [ ] Responsivo: cards em mobile, tabela em desktop (ou scroll horizontal)
- [ ] Empty state quando sem dados
- [ ] Loading state (skeleton rows, não spinner sozinho)

### Toast / Notification
- [ ] `role="status"` (não bloqueante) ou `role="alert"` (crítico)
- [ ] Auto-dismiss após 5-7s pra info, manual dismiss pra erro
- [ ] Pausa auto-dismiss no hover
- [ ] Botão de fechar acessível por teclado
- [ ] Máximo 3 toasts empilhados, resto enfileira

---

## Anti-patterns Instantâneos

| Anti-pattern | Problema | Fix |
|---|---|---|
| `<div onClick>` em vez de `<button>` | Sem keyboard, sem ARIA | `<button>` sempre |
| `outline: none` sem substituto | Keyboard user fica perdido | Custom focus ring |
| Placeholder como label | Some ao digitar, ruim pra screen reader | Label visível acima |
| `font-size` em px | Não respeita settings do user | `rem` ou `em` |
| Animação longa sem `prefers-reduced-motion` | Gatilho pra vestibular users | `@media (prefers-reduced-motion: reduce)` |
| `color: red` pra erro | Daltônico não distingue | Ícone + texto + cor |
| Hover-only disclosure | Não funciona em touch | Click/tap também revela |
| Botão "OK" / "Cancelar" sem contexto | Screen reader perde semântica | "Excluir usuário" / "Manter usuário" |
| `tabindex="1"` e outros positivos | Quebra ordem natural | Use só `0` (focável) e `-1` (programático) |
| Modal fullscreen em mobile que não dá pra fechar | Usuário fica trancado | Botão fechar grande + swipe down |
