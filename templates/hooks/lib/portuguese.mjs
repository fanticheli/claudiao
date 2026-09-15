const IDENTIFIER_WORDS = new Set(`
usuario cliente empresa candidato candidata recrutador recrutadora vaga entrevista pergunta resposta
avaliacao pontuacao nota teste triagem contratacao contratado curriculo mensagem conversa arquivo
dados dado relatorio pagamento cobranca preco produto servico tarefa agendamento horario inicio fim
novo antigo ativo inativo habilitado desabilitado configuracao parametro requisicao erro sucesso falha
resultado quantidade tamanho limite pagina tela botao janela chave codigo senha conta perfil permissao
acesso regra fluxo passo etapa motivo vinculo cadastro filtro busca pesquisa atual ultimo primeiro
proximo maior menor igual vazio verdadeiro falso nao nome sobrenome numero telefone celular endereco
cidade estado bairro pais idade nascimento genero sexo salario beneficio setor departamento filial
unidade gestor lider equipe projeto processo seletivo situacao historico registro lista valor soma
contagem porcentagem percentual dia mes ano semana hora minuto segundo prazo validade vencimento criado
atualizado removido excluido enviado recebido aprovado reprovado pendente concluido finalizado cancelado
agendado respondido lido visualizado tentativa fila lote trabalho emprego habilidade competencia
experiencia formacao idioma ingles portugues grupo campo tipo categoria opcao escolha selecionado
marcado texto titulo descricao conteudo imagem foto transcricao gravacao ligacao chamada notificacao
aviso evento convite pedido compra venda estoque frete entrega fornecedor parceiro contrato documento
assinatura anexo modelo plano assinante desconto imposto parcela saldo banco cartao boleto fatura
recibo comprovante orcamento custo receita despesa lucro indicador painel grafico tabela coluna linha
celula planilha exportacao importacao integracao sincronizacao conexao conector provedor origem destino
caminho rota servidor consulta retorno entrada saida carga
buscar obter pegar listar criar cadastrar salvar gravar atualizar editar alterar deletar excluir remover
apagar validar verificar checar conferir calcular gerar enviar receber processar carregar montar
converter formatar tratar retornar mostrar exibir abrir fechar iniciar finalizar encerrar cancelar
aprovar rejeitar reprovar confirmar notificar agendar importar exportar sincronizar preencher limpar
somar contar ordenar filtrar agrupar adicionar inserir incluir pesquisar transcrever avaliar pontuar
classificar ranquear contratar recrutar disparar definir possui pode deve esta estar fazer executar
rodar chamar aguardar esperar tentar reenviar responder perguntar entrevistar selecionar marcar
desmarcar habilitar desabilitar ativar desativar bloquear desbloquear liberar travar logar deslogar
autenticar autorizar redirecionar navegar renderizar esconder ocultar copiar colar baixar subir anexar
assinar pagar cobrar faturar emitir imprimir lancar registrar mapear transformar extrair parsear
normalizar padronizar construir instanciar inicializar configurar ajustar corrigir consertar melhorar
otimizar refatorar testar simular mockar
`.split(/\s+/).filter(Boolean));

const COMMIT_FUNCTION_WORDS = new Set(`
de da das dos que com sem para pelo pela pelos pelas ao aos uma nao quando tambem entao porque onde
como mais menos ja isso esse essa este esta num numa entre sobre antes depois agora ainda sempre nunca
cada toda todos todas seu sua seus suas pra pro vira fica
`.split(/\s+/).filter(Boolean));

const COMMIT_LEADING_VERBS = new Set(`
corrige adiciona ajusta cria atualiza implementa melhora altera refatora evita garante passa volta
deixa torna trata exibe mostra permite habilita desabilita libera bloqueia inclui exclui padroniza
normaliza sincroniza documenta testa cobre fecha abre sobe desliga liga migra renomeia escopa colapsa
encerra injeta eleva forca declara separa unifica simplifica otimiza reduz aumenta valida verifica
envia recebe processa carrega salva grava busca lista retorna aceita rejeita ignora preserva protege
ordena filtra agrupa calcula gera publica marca desmarca ativa desativa
corrigir adicionar ajustar criar atualizar implementar melhorar alterar refatorar remover
ajustes correcao correcoes melhoria melhorias implementacao
`.split(/\s+/).filter(Boolean));

const PORTUGUESE_SUFFIX = /^[a-z]{2,}(cao|coes)$/;
const SUFFIX_EXCEPTIONS = new Set(['cacao']);

export function normalize(word) {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function hasNonAscii(text) {
  return /[^\x00-\x7F]/.test(text);
}

export function splitIdentifier(name) {
  return name
    .split(/[^A-Za-z0-9À-ɏ]+/)
    .flatMap((part) =>
      part
        .replace(/([a-z0-9ß-ÿ])([A-ZÀ-Þ])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(' '),
    )
    .filter(Boolean)
    .map(normalize);
}

function singularForms(word) {
  const forms = [word];
  if (word.endsWith('oes')) forms.push(`${word.slice(0, -3)}ao`);
  if (word.endsWith('es')) forms.push(word.slice(0, -2));
  if (word.endsWith('s')) forms.push(word.slice(0, -1));
  return forms;
}

export function isPortugueseIdentifierWord(word) {
  if (word.length < 3) return false;
  if (singularForms(word).some((form) => IDENTIFIER_WORDS.has(form))) return true;
  return PORTUGUESE_SUFFIX.test(word) && !SUFFIX_EXCEPTIONS.has(word);
}

export function portugueseWordsInIdentifier(name) {
  return splitIdentifier(name).filter(isPortugueseIdentifierWord);
}

export function isPortugueseIdentifier(name) {
  return hasNonAscii(name) || portugueseWordsInIdentifier(name).length > 0;
}

function proseTokens(text) {
  return text
    .split(/\s+/)
    .map((token) => normalize(token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')))
    .filter(Boolean);
}

export function portugueseProseEvidence(text) {
  const evidence = [];
  const accented = text.match(/[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ]/g);
  if (accented) evidence.push(`acentos (${[...new Set(accented)].join('')})`);

  const tokens = proseTokens(text);
  const functionWords = tokens.filter((token) => COMMIT_FUNCTION_WORDS.has(token));
  if (functionWords.length >= 2) evidence.push(`palavras em português (${[...new Set(functionWords)].join(', ')})`);

  const verbs = tokens.filter((token) => COMMIT_LEADING_VERBS.has(token));
  if (verbs.length > 0) evidence.push(`verbos em português (${[...new Set(verbs)].join(', ')})`);

  return evidence;
}
