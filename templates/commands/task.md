---
description: Abre uma tarefa com escopo, arquivos, padrão e critério de pronto
argument-hint: "<objetivo>"
---

Tarefa: $ARGUMENTS

Antes de editar qualquer arquivo, responda em até 5 linhas:
1. Objetivo em uma frase.
2. Arquivos que pretende tocar (caminhos reais, confirmados com busca).
3. Padrão existente que vai copiar (arquivo de referência).
4. Critério de pronto: quais comandos de teste, typecheck e lint vão passar, e qual evidência você vai mostrar.
5. O que fica FORA do escopo.

Se faltar alguma dessas informações e ela não puder ser descoberta no código, faça uma única pergunta. Não faça commit, merge, deploy nem escrita em ambiente remoto sem eu pedir.
