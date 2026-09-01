export interface Cliente {
  cliente_id: number;
  grp_id: number | null;
  cliente_nome: string;
  cliente_cnpj: string | null;
  cliente_cnpj_fat: string | null;
  cliente_cnpj_number: string | null;
  cliente_status: string;
  cliente_dat_bloqueio: string | null;
  cliente_dia_venc_consumo: number | null;
  cliente_dia_venc_carteira: number | null;
  cliente_cod_github: string | null;
  cliente_log: string | null;
  cliente_tip_vlr: string | null;
}

export interface GrupoEcon {
  grp_id: number;
  grp_nome: string;
}

export interface Url {
  url_id: number;
  cliente_id: number;
  url_path: string;
  server_id: number | null;
  produto_id: number | null;
  url_status: string | null;
  url_dt_status: string | null;
  url_exc: string | null;
  url_dt_exc: string | null;
  url_pasta_raiz: string | null;
  url_pasta_anexos: string | null;
  urb_bd: string | null;
  url_obs: string | null;
}

export interface Produto {
  produto_id: number;
  produto_area: string | null;
  produto_nome: string;
  produto_detalhe: string | null;
  produto_suite: string | null;
  produto_tip_apuracao: string | null;
  produto_sku: string | null;
  produto_franquia: string | null;
  produto_grupo: number | null;
  produto_preco: number | null;
  produto_recorrencia: string | null;
  produto_regra_apuracao: string | null;
}

export interface Servidor {
  server_id: number;
  server_nome: string;
  server_ambiente: string | null;
  server_finalidade: string | null;
  server_mysql: string | null;
  server_status: string | null;
  server_proc: string | null;
  server_conteudo: string | null;
  server_familia: string | null;
}

export interface ListUrlStatus {
  url_status: string;
}

export interface Fornecedor {
  fornecedor_id: number;
  fornecedor_area: string | null;
  fornecedor_nome: string;
  fornecedor_cnpj: string | null;
}

export interface Pessoa {
  pessoa_id: number;
  pessoa_nome: string;
  pessoa_status: string | null;
  pessoa_funcao: string | null;
  pessoa_grupo: string | null;
  pessoa_mail: string | null;
  pessoa_fone: string | null;
  pessoa_whatsapp: string | null;
  pessoa_diretor: number | null;
  pessoa_ger_exec: number | null;
  pessoa_ger: number | null;
  pessoa_lider: number | null;
  pessoa_squad: string | null;
  pessoa_billable: string | null;
}

export interface FornContrato {
  forn_cont_id: number;
  fornecedor_id: number;
  pessoa_id: number | null;
  forn_cont_num_contrato: string | null;
  forn_cont_tipo: string | null;
  forn_cont_nivel: string | null;
  forn_cont_aloc: string | null;
  forn_cont_qtd_prf: number | null;
  forn_cont_desc: string | null;
  forn_cont_tip_vlr: string | null;
  forn_cont_vlr_mes: number | null;
  forn_cont_dt_ini: string | null;
  forn_cont_dt_fim: string | null;
  forn_cont_ind_reaj: string | null;
  forn_cont_status: string | null;
}

export interface FornPagadoria {
  forn_pag_id: number;
  fornecedor_id: number;
  forn_pag_resp: string | null;
  forn_pag_tipo: string | null;
  forn_pag_tipo_detalhado: string | null;
  forn_pag_competencia: string | null;
  forn_pag_dat: string | null;
  forn_pag_nome_prf: string | null;
  forn_pag_qtd: number | null;
  forn_pag_vlr_unit: number | null;
  forn_pag_tot_bruto: number | null;
  forn_pag_tot_liq: number | null;
  forn_pag_vlr_pag_cliente_bruto: number | null;
  forn_pag_vlr_pag_cliente_liq: number | null;
  forn_pag_vlr_receita_bruta: number | null;
  forn_pag_vlr_receita_liq: number | null;
  forn_pag_obs: string | null;
}

export interface Anexo {
  anexo_id: number;
  cliente_id: number | null;
  fornecedor_id: number | null;
  anexo_nome: string | null;
  anexo_data: string | null;
  anexo_arquivo: string | null;
}

export interface Contato {
  contato_id: number;
  cliente_id: number;
  contato_nome: string;
  contato_mail: string | null;
  contato_fone: string | null;
  contato_status: string | null;
}

export interface Usuario {
  user_id: number;
  user_nome: string;
  user_mail: string;
  user_status: string | null;
  user_deve_trocar_senha: number;
  user_convite_expira_em: string | null;
}

export interface UsuarioPermissaoMenu {
  user_id: number;
  menu_key: string;
  perm_leitura: number;
  perm_insercao: number;
  perm_edicao: number;
  perm_exclusao: number;
}

export interface CartMes {
  cart_mes_id: number;
  cart_ano_mes: string;
  cart_vigencia_ativa: string | null;
}

export interface CartMesResumo {
  cart_mes_id: number;
  cart_ano_mes: string;
  cart_vigencia_ativa: string | null;
  total_carteira: number;
  total_consumo: number;
}

export interface Carteira {
  cart_id: number;
  cliente_id: number;
  cart_mes_id: number | null;
  cart_qtd: number | null;
  cart_vlr: number | null;
  cart_pdd: number | null;
  cart_sem_pdd: number | null;
  cart_fat: number | null;
  cart_qtd_mes: number | null;
  cart_emprestimos_mes: number | null;
  cart_ult_def: string | null;
  cart_data_base: string | null;
  cart_dat_extracao: string | null;
  cart_rds: string | null;
  cart_db: string | null;
  cart_prod: string | null;
  cart_url_plan_analitica: string | null;
}

export interface PrecosCliente {
  pc_id: number;
  cliente_id: number;
  produto_id: number;
  cart_mes_id: number | null;
  pc_dat_niver: string | null;
  pc_dat_ult_reajuste: string | null;
  pc_cod_index: string | null;
  pc_vlr_franquia: number | null;
  pc_vlr_unit: number | null;
  pc_fx1_lim: number | null;
  pc_fx2_lim: number | null;
  pc_fx3_lim: number | null;
  pc_fx4_lim: number | null;
  pc_fx5_lim: number | null;
  pc_fx1_vlr: number | null;
  pc_fx2_vlr: number | null;
  pc_fx3_vlr: number | null;
  pc_fx4_vlr: number | null;
  pc_fx5_vlr: number | null;
}

export interface IndiceEconomico {
  index_nome: string;
  index_ano: number;
  index_mes: number;
  index_vlr: number | null;
  index_cod: number | null;
}

// Saída da view indices_calculados (views.pg.sql): a linha de indices_economicos + a variação
// do mês (index_var_mes, já em fração: 0.0042 = 0,42%) e o acumulado móvel de 12 meses.
export interface IndiceCalculado extends IndiceEconomico {
  index_var_mes: number | null;
  index_acum_12m: number | null;
}

// Saída da view reajuste_eventos_detalhe (views.pg.sql): reajuste_eventos + nome de cliente/produto.
export interface ReajusteEventoDetalhe {
  reaj_id: number;
  pc_id: number;
  cliente_id: number;
  cliente_nome: string;
  cliente_cnpj: string | null;
  produto_id: number;
  produto_nome: string;
  produto_detalhe: string | null;
  reaj_data: string;
  reaj_index_nome: string;
  reaj_index_ano: number;
  reaj_index_mes: number;
  reaj_taxa_acum_12m: number;
  reaj_vlr_unit_ant: number | null;
  reaj_vlr_unit_novo: number | null;
  reaj_vlr_franquia_ant: number | null;
  reaj_vlr_franquia_novo: number | null;
  pc_dat_niver: string | null;
}

export interface ConsumoAna {
  consumo_id: number;
  cliente_id: number;
  produto_id: number;
  cart_mes_id: number | null;
  consumo_data: string;
  consumo_qtd: number | null;
  consumo_det: string | null;
  consumo_consit: string | null;
}

// Saída real de views.sql:precos_cliente_mes_atual -- NÃO estende PrecosCliente:
// a view só repassa pc_id/cliente_id/produto_id/cart_mes_id da tabela original,
// o resto (franquia, valores, vigência) vem sob nomes pc_mes_atu_* diferentes
// (ex.: pc_vlr_franquia da tabela virou pc_mes_atu_vlr_franquia aqui).
export interface PrecosClienteMesAtual {
  pc_id: number;
  cliente_id: number;
  produto_id: number;
  cart_mes_id: number | null;
  pc_vigencia_ativa: string;
  pc_mes_atu_vlr_franquia: number | null;
  pc_mes_atu_qtd_consumo: number;
  pc_mes_atu_vlr_exced: number | null;
  pc_mes_atu_vlr_final_liq: number | null;
  pc_mes_atu_vlr_final_brt: number | null;
  pc_mes_atu_vlr_liq_consumo: number | null;
  pc_alerta_preco: string;
}

export interface Faturamento {
  fat_id: number;
  cart_mes_id: number | null;
  cliente_id: number;
  fat_dat_venc: string | null;
  fat_cod_venc_protheus: string | null;
  fat_num_nfe: string | null;
  fat_num_rps: string | null;
  fat_obs: string | null;
}

// Saída de views.sql:faturamento_detalhe -- repassa Faturamento (f.*) + colunas de clientes/soma.
export interface FaturamentoDetalhe extends Faturamento {
  cliente_cnpj: string | null;
  cliente_cnpj_fat: string | null;
  fat_vlr_liq: number;
  fat_vlr_brt: number;
}

export interface Portfolio {
  port_id: number;
  cliente_id: number;
  port_tipo: string | null;
  port_nome: string | null;
  port_pm: string | null;
  port_diretorio: string | null;
  port_status: string | null;
  port_pdf: number | null;
}

// Saída de views.sql:portfolios_progresso -- repassa Portfolio (p.*) + datas/percentuais agregados de crono.
export interface PortfolioProgresso extends Portfolio {
  port_inicio: string | null;
  port_fim: string | null;
  port_perc_atual: number;
  port_perc_estim: number;
}

export interface Crono {
  crono_id: number;
  port_id: number;
  crono_grupo: number | null;
  crono_topico: number | null;
  crono_grp_tpc: string | null;
  crono_tipo: string | null; // 'A' = agregadora (grupo), 'T' = tarefa
  crono_atividade: string | null;
  crono_inicio: string | null;
  crono_fim: string | null;
  crono_replan: string | null;
  crono_esforco: string | null;
  crono_perc_atual: number | null;
  crono_hh_orc: number | null;
  crono_hh_real: number | null;
  crono_status: string | null;
  resp_id: number | null;
  crono_demanda_1: string | null;
  crono_demanda_2: string | null;
  crono_demanda_3: string | null;
  crono_relat: number | null;
}

// Saída de views.sql:crono_calculado -- repassa Crono (cr.*) + datas/percentuais calculados
// (agregados quando crono_tipo='A', ou calculados ao vivo pela data de hoje quando 'T').
export interface CronoCalculado extends Crono {
  crono_perc_esperado_t: number | null;
  crono_inicio_calc: string | null;
  crono_fim_calc: string | null;
  crono_perc_atual_calc: number;
  crono_perc_esperado: number;
}

export interface ParametrosGerais {
  param_id: number;
  param_logo_escuro_url: string | null;
  param_logo_claro_url: string | null;
}

export interface Proposta {
  proposta_id: number;
  cliente_id: number;
  proposta_chamado: number | null;
  proposta_demanda: number | null;
  proposta_nome: string | null;
  proposta_desc: string | null;
  proposta_hh: number | null;
  proposta_vlr: number | null;
  proposta_status: string | null;
  proposta_anexo: string | null;
}

export interface ListRespCrono {
  resp_id: number;
  resp_nome: string;
}
