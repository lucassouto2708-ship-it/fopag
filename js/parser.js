/*
 * Leitor do TXT da folha de pagamento ("ORDEM - LOTAÇÃO / ALFABÉTICA").
 *
 * Estrutura esperada do arquivo:
 *   LOTAÇÃO:    002                    - PREFEITURA MUNICIPAL DE SARDOA
 *               002.001                - SECRET. MUNIC. DE ADMINISTR. E GOVERNO
 *               002.001.204            - MANUT. DEPART. DE ADMINISTRACAO
 *               002.001.204.00043      - CONTRATO - F 49
 *   160201  /1  NOME DO SERVIDOR   NIVEL  -FUNÇÃO   ADMISSÃO  SITUAÇÃO
 *                100   P   VENCIMENTO   200,00   2.293,72
 *                                    TOTAL....:   2.293,72   182,11   2.111,61
 *            T O T A L  F U N C I O N A R I O S ...:      1
 *            T O T A L  L O T A C A O .............:   2.293,72   182,11   2.111,61
 *   ...
 *   TOTAL GERAL FUNCIONARIOS ...........:   469
 *   TOTAL GERAL DA FOLHA DE PAGAMENTO ..:   1.485.240,66   142.675,01   1.342.565,65
 */
(function (global) {
  "use strict";

  const NUM = "-?[\\d.]+,\\d{2}";
  const num = (s) => parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  const cents = (v) => Math.round(v * 100);

  /** Decodifica o arquivo. O sistema gera ISO-8859-1; se vier em UTF-8, também funciona. */
  function decode(buffer) {
    const bytes = new Uint8Array(buffer);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (e) {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }

  function parse(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const meta = {};
    const nomes = {}; // código da lotação -> nome
    const servidores = [];
    const totaisLotacao = {}; // código -> {funcionarios, proventos, descontos, liquido}
    let geral = null;
    let lotacao = null;
    let atual = null;
    let folha = 0;
    let m;

    for (const l of lines) {
      if ((m = l.match(/FOLHA:\s*(\d+)/))) folha = +m[1];
      if (!meta.municipio && (m = l.match(/MUNIC[IÍ]PIO:\s*(.+?)(\s{2,}|$)/))) meta.municipio = m[1].trim();
      if (!meta.uf && (m = l.match(/\bUF:\s*(.+?)(\s{2,}|$)/))) meta.uf = m[1].trim();
      if (!meta.referencia && (m = l.match(/REFER[EÊ]NCIA:\s*(\S+)/))) meta.referencia = m[1].trim();
      if (!meta.entidade && (m = l.match(/ENTIDADE:\s*(.+?)(\s{2,}|$)/))) meta.entidade = m[1].trim();
      if (!meta.calculo && (m = l.match(/TIPO C[AÁ]LCULO:\s*(.+?)\s*$/))) meta.calculo = m[1].trim();

      // Linha de servidor: "   160201  /1  NOME..."
      if ((m = l.match(/^\s{1,6}(\d{4,8})\s+\/(\d?)\s/))) {
        const d = l.match(/(\d\d\/\d\d\/\d{4})\s+(.*\S)\s*$/);
        const ini = m.index + m[0].length;
        const fimFuncao = d ? d.index : l.length;
        const corpo = l.slice(ini, fimFuncao);
        // Nome ocupa 33 colunas a partir da coluna 15; depois nível/padrão e "-FUNÇÃO".
        const nomeFim = Math.max(0, 48 - ini);
        const nome = corpo.slice(0, nomeFim).trim();
        const resto = corpo.slice(nomeFim);
        const hifen = resto.indexOf("-");
        atual = {
          matricula: m[1] + (m[2] ? "/" + m[2] : ""),
          nome,
          nivel: (hifen >= 0 ? resto.slice(0, hifen) : resto).trim(),
          funcao: (hifen >= 0 ? resto.slice(hifen + 1) : "").trim(),
          admissao: d ? d[1] : "",
          situacao: d ? d[2].trim() : "",
          lotacao,
          folha,
          proventos: null,
          descontos: null,
          liquido: null,
        };
        servidores.push(atual);
        continue;
      }

      // Total do servidor
      if ((m = l.match(new RegExp("TOTAL\\.{2,}:\\s*(" + NUM + ")\\s+(" + NUM + ")\\s+(" + NUM + ")")))) {
        if (atual && atual.liquido === null) {
          atual.proventos = num(m[1]);
          atual.descontos = num(m[2]);
          atual.liquido = num(m[3]);
        }
        continue;
      }

      if ((m = l.match(/T\s?O\s?T\s?A\s?L\s+F\s?U\s?N\s?C\s?I\s?O\s?N\s?A\s?R\s?I\s?O\s?S[ .]*:\s*(\d+)/))) {
        (totaisLotacao[lotacao] = totaisLotacao[lotacao] || {}).funcionarios = +m[1];
        continue;
      }
      if ((m = l.match(new RegExp("T\\s?O\\s?T\\s?A\\s?L\\s+L\\s?O\\s?T\\s?A\\s?C\\s?A\\s?O[ .]*:\\s*(" + NUM + ")\\s+(" + NUM + ")\\s+(" + NUM + ")")))) {
        const t = (totaisLotacao[lotacao] = totaisLotacao[lotacao] || {});
        t.proventos = num(m[1]);
        t.descontos = num(m[2]);
        t.liquido = num(m[3]);
        continue;
      }
      if ((m = l.match(/TOTAL GERAL FUNCION[AÁ]RIOS[ .]*:\s*(\d+)/))) {
        (geral = geral || {}).funcionarios = +m[1];
        continue;
      }
      if ((m = l.match(new RegExp("TOTAL GERAL DA FOLHA[^:]*:\\s*(" + NUM + ")\\s+(" + NUM + ")\\s+(" + NUM + ")")))) {
        geral = geral || {};
        geral.proventos = num(m[1]);
        geral.descontos = num(m[2]);
        geral.liquido = num(m[3]);
        continue;
      }

      // Níveis da lotação: "   LOTAÇÃO:    002   - NOME" ou "               002.001   - NOME"
      if ((m = l.match(/^(?:\s*LOTA[CÇ][AÃ]O:)?\s+(\d{2,4}(?:\.\d+)*)\s+-\s+(.*\S)\s*$/))) {
        nomes[m[1]] = m[2];
        lotacao = m[1];
        continue;
      }
    }

    if (!servidores.length) {
      throw new Error(
        "Não encontrei servidores neste arquivo. Confira se é o TXT da folha em ordem de lotação (o mesmo layout do sistema que gera \"F O L H A  D E  P A G A M E N T O\")."
      );
    }

    return { meta, nomes, servidores, totaisLotacao, geral, conferencia: conferir(servidores, totaisLotacao, geral) };
  }

  /** Compara o que foi lido com os totais impressos no próprio relatório. */
  function conferir(servidores, totaisLotacao, geral) {
    const porLot = {};
    for (const s of servidores) (porLot[s.lotacao] = porLot[s.lotacao] || []).push(s);
    const diferencas = [];
    for (const [cod, t] of Object.entries(totaisLotacao)) {
      const L = porLot[cod] || [];
      const liq = L.reduce((a, s) => a + (s.liquido || 0), 0);
      const okN = t.funcionarios === undefined || t.funcionarios === L.length;
      const okL = t.liquido === undefined || cents(t.liquido) === cents(liq);
      if (!okN || !okL) diferencas.push({ lotacao: cod, esperado: t, lido: { funcionarios: L.length, liquido: liq } });
    }
    const semTotal = servidores.filter((s) => s.liquido === null);
    const lido = {
      funcionarios: servidores.length,
      proventos: servidores.reduce((a, s) => a + (s.proventos || 0), 0),
      descontos: servidores.reduce((a, s) => a + (s.descontos || 0), 0),
      liquido: servidores.reduce((a, s) => a + (s.liquido || 0), 0),
    };
    let geralOk = null;
    if (geral) {
      geralOk =
        (geral.funcionarios === undefined || geral.funcionarios === lido.funcionarios) &&
        (geral.liquido === undefined || cents(geral.liquido) === cents(lido.liquido));
    }
    return {
      lotacoesConferidas: Object.keys(totaisLotacao).length,
      diferencas,
      semTotal,
      lido,
      geral,
      geralOk,
      ok: diferencas.length === 0 && semTotal.length === 0 && geralOk !== false,
    };
  }

  global.FolhaParser = { parse, decode, num };
})(typeof window !== "undefined" ? window : globalThis);
