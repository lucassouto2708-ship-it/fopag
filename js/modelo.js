/*
 * Transforma o resultado do leitor em uma hierarquia:
 *   Prefeitura (nível 1) → Secretaria (nível 2) → Setor/ação (nível 3) → Vínculo (nível 4)
 * e deixa os nomes do orçamento legíveis ("MANUT. DEPART. DE OBRAS" → "Departamento de Obras").
 */
(function (global) {
  "use strict";

  // Abreviações comuns nos nomes de lotação/orçamento (aplicadas sobre texto em MAIÚSCULAS).
  const ABREV = [
    [/\bSECRET\.?\s*MUNIC\.?\s*/g, "SECRETARIA MUNICIPAL "],
    [/\bSECRET\.?\s*MUN\.?\s*/g, "SECRETARIA MUNICIPAL "],
    [/\bSEC\.\s*MUN\.?\s*/g, "SECRETARIA MUNICIPAL "],
    [/\bSECRET\.\s*/g, "SECRETARIA "],
    [/\bMUNIC\.\s*/g, "MUNICIPAL "],
    [/\bADMINISTR\.|\bADMINST\.|\bADMINIST\.|\bADM\./g, "ADMINISTRAÇÃO"],
    [/\bMANUT\.|\bMANUTENCAO\b/g, "MANUTENÇÃO"],
    [/\bDEPART\.|\bDEPTO\.|\bDEP\./g, "DEPARTAMENTO"],
    [/\bASSIST\./g, "ASSISTÊNCIA"],
    [/\bEDUC\.?(?=\s|$)/g, "EDUCAÇÃO"],
    [/\bNAC\./g, "NACIONAL"],
    [/\bDES\.(?=\s)/g, "DESENVOLVIMENTO"],
    [/\bFUNDAM\./g, "FUNDAMENTAL"],
    [/\bPROF\./g, "PROFISSIONAIS"],
    [/\bAGRICULT\./g, "AGRICULTURA"],
    [/\bCULT\.,?/g, "CULTURA,"],
    [/\bTURIS\.?(?=\s|$)/g, "TURISMO"],
    [/\bDESP\b/g, "DESPORTO"],
    [/\bVIGIL\./g, "VIGILÂNCIA"],
    [/\bEPIDEMIOL\./g, "EPIDEMIOLÓGICA"],
    [/\bATIVID\.|\bATIV\./g, "ATIVIDADES"],
    [/\bREC\./g, "RECURSOS"],
    [/\bCOM\.(?=\s)/g, "COMUNITÁRIOS"],
    [/\bCONVIV\./g, "CONVIVÊNCIA"],
    [/\bSERV\./g, "SERVIÇOS"],
    [/\bCONTRAT\.?(?=\s)/g, "CONTRATADO"],
    [/\bTEMP\.(?=\s)/g, "TEMPO"],
    [/\bVENC\.?\s*E\s*VANT\.?/g, "VENCIMENTOS E VANTAGENS"],
    [/\bVENC\.?\s*VANT\.?/g, "VENCIMENTOS E VANTAGENS"],
    [/\bPES\b/g, "PESSOAL"],
    [/\bAMB\./g, "AMBIENTE"],
    [/\bMUN\./g, "MUNICIPAL"],
    // Abreviações sem ponto (comuns em outros municípios)
    [/\bMANUT\b\.?/g, "MANUTENÇÃO"],
    [/\bATIVIDAD\.|\bATIVID\b|\bATIVDADES\b|\bATIV\b/g, "ATIVIDADES"],
    [/\bPROGR?\b\.?/g, "PROGRAMA"],
    [/\bSERV\b/g, "SERVIÇO"],
    [/\bSEC\b\.?/g, "SECRETARIA"],
    [/\bMUNI\b\.?|\bMUN\b/g, "MUNICIPAL"],
    [/\bADMIN\b\.?/g, "ADMINISTRAÇÃO"],
    [/\bCONVI\b/g, "CONVIVÊNCIA"],
    [/\bFORT\b/g, "FORTALECIMENTO"],
    [/\bPROT\b/g, "PROTEÇÃO"],
    [/\bSOC\b/g, "SOCIAL"],
    [/\bNECES\s+ESP\b/g, "NECESSIDADES ESPECIAIS"],
    [/\bTRANSP\b/g, "TRANSPORTE"],
    [/\bCORREG\b\.?/g, "CORREGEDORIA"],
    [/\bUNID\b/g, "UNIDADES"],
    [/\bCOMUNT\b/g, "COMUNITÁRIO"],
    [/\bCONT\b/g, "CONTROLE"],
    [/\bFISCALIZ\b/g, "FISCALIZAÇÃO"],
    [/\bLICENCIAM\b/g, "LICENCIAMENTO"],
    [/\bDESENV\b\.?/g, "DESENVOLVIMENTO"],
    [/\bINFRA\s+ESTRUTURA\b/g, "INFRAESTRUTURA"],
    [/\bASSIT\b/g, "ASSISTÊNCIA"],
    [/\bHABI\b/g, "HABITAÇÃO"],
    [/\bTRANPOR\b/g, "TRANSPORTE"],
    [/\bM\s+(?=DE\b)/g, "MUNICIPAL "],
  ].map(([re, rep]) => [
    // "\b" do JavaScript não reconhece letras acentuadas: troca por limites que reconhecem.
    new RegExp(re.source.replace(/\\b(?=[A-Za-z(])/g, "(?<![A-Za-zÀ-ÿ])").replace(/\\b/g, "(?![A-Za-zÀ-ÿ])"), re.flags),
    rep,
  ]);

  // Acentos que o sistema costuma omitir.
  const ACENTOS = {
    SAUDE: "SAÚDE", EDUCACAO: "EDUCAÇÃO", ADMINISTRACAO: "ADMINISTRAÇÃO", ASSISTENCIA: "ASSISTÊNCIA",
    PUBLICA: "PÚBLICA", PUBLICO: "PÚBLICO", APLICACAO: "APLICAÇÃO", FAMILIA: "FAMÍLIA", AGRICOLA: "AGRÍCOLA",
    SERVICO: "SERVIÇO", SERVICOS: "SERVIÇOS", FUNCAO: "FUNÇÃO", CRIANCA: "CRIANÇA", SUBSIDIO: "SUBSÍDIO",
    PRE: "PRÉ", MUNICIPIO: "MUNICÍPIO", TECNICO: "TÉCNICO", PREVIDENCIA: "PREVIDÊNCIA", ESPORTES: "ESPORTES",
    CONVIVENCIA: "CONVIVÊNCIA", VIGILANCIA: "VIGILÂNCIA", EPIDEMIOLOGICA: "EPIDEMIOLÓGICA", COMUNITARIOS: "COMUNITÁRIOS",
    COMUNITARIO: "COMUNITÁRIO", POLITICOS: "POLÍTICOS", POLITICO: "POLÍTICO", ORGAO: "ÓRGÃO", PROPRIOS: "PRÓPRIOS",
    INFANCIA: "INFÂNCIA", HABITACAO: "HABITAÇÃO", INFORMATICA: "INFORMÁTICA", TRANSITO: "TRÂNSITO",
    GABINETE: "GABINETE", CAMARA: "CÂMARA", ODONTOLOGICO: "ODONTOLÓGICO", BASICA: "BÁSICA", BASICO: "BÁSICO",
    ATENCAO: "ATENÇÃO", PROTECAO: "PROTEÇÃO", GESTAO: "GESTÃO", ARRECADACAO: "ARRECADAÇÃO", TRIBUTACAO: "TRIBUTAÇÃO",
    LICITACAO: "LICITAÇÃO", LICITACOES: "LICITAÇÕES", COMUNICACAO: "COMUNICAÇÃO", CONSTRUCAO: "CONSTRUÇÃO",
    ILUMINACAO: "ILUMINAÇÃO", RODOVIARIO: "RODOVIÁRIO", HIDRICOS: "HÍDRICOS",
    FARMACIA: "FARMÁCIA", SECRETARIO: "SECRETÁRIO", MEDICO: "MÉDICO", CLINICO: "CLÍNICO", PSICOLOGO: "PSICÓLOGO",
    ODONTOLOGO: "ODONTÓLOGO", FARMACEUTICO: "FARMACÊUTICO", MECANICO: "MECÂNICO", MAQUINA: "MÁQUINA",
    MAQUINAS: "MÁQUINAS", OPERARIO: "OPERÁRIO", PEDAGOGICO: "PEDAGÓGICO", PEDAGOGICA: "PEDAGÓGICA",
    CONSULTORIO: "CONSULTÓRIO", DENTARIO: "DENTÁRIO", CIRURGIAO: "CIRURGIÃO", LABORATORIO: "LABORATÓRIO",
    MATEMATICA: "MATEMÁTICA", PORTUGUES: "PORTUGUÊS", HISTORIA: "HISTÓRIA", CIENCIAS: "CIÊNCIAS", INGLES: "INGLÊS",
    FISICA: "FÍSICA", FISICO: "FÍSICO", ELETRICA: "ELÉTRICA", HIDRAULICA: "HIDRÁULICA", PATRIMONIO: "PATRIMÔNIO",
    VETERINARIO: "VETERINÁRIO", AGRONOMO: "AGRÔNOMO", JURIDICO: "JURÍDICO", ESTAGIARIO: "ESTAGIÁRIO",
    LINGUA: "LÍNGUA", MUSICA: "MÚSICA", DIVISAO: "DIVISÃO", COORDENACAO: "COORDENAÇÃO", SUPERVISAO: "SUPERVISÃO",
    POLITICAS: "POLÍTICAS", TECNICA: "TÉCNICA", TECNICOS: "TÉCNICOS", EDUCACAO: "EDUCAÇÃO", EDUCAÇAO: "EDUCAÇÃO",
    ORGÃO: "ÓRGÃO", PREDIOS: "PRÉDIOS", VETERINARIA: "VETERINÁRIA", ODONTOLOGIA: "ODONTOLOGIA",
    ESCOLAR: "ESCOLAR", ENDEMIAS: "ENDEMIAS", AS: "AS", PRE: "PRÉ",
    FISCALIZAÇA: "FISCALIZAÇÃO", FISCALIZAÇÃ: "FISCALIZAÇÃO", SEÇAO: "SEÇÃO", FISCALIZAÇAO: "FISCALIZAÇÃO", VACINAÇAO: "VACINAÇÃO", MEDICAS: "MÉDICAS", ODONTOLOGICO: "ODONTOLÓGICO",
    FARMACEUTICAS: "FARMACÊUTICAS", MECANICA: "MECÂNICA", FUNERARIO: "FUNERÁRIO", CEMITERIO: "CEMITÉRIO",
    TRANSITO: "TRÂNSITO", PRAÇAS: "PRAÇAS", ECONOMICO: "ECONÔMICO", INFANCIA: "INFÂNCIA", DOENÇAS: "DOENÇAS",
  };

  const SIGLAS = new Set(["FUNDEB", "PSF", "PAB", "CRAS", "CREAS", "SCFV", "SUS", "ESF", "FNAS", "MDE", "ACS", "ACE", "PNAE", "PNATE", "SAMU", "CAPS", "UBS", "PETI", "IGD", "FMS", "FMAS", "RPPS", "INSS", "TI", "PACS", "PAIF", "SUAS", "CAD", "EJA", "APAE"]);
  const MINUSC = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "A", "O", "EM", "PARA", "COM", "POR", "NA", "NO", "AS", "OS", "À"]);

  function titulo(s) {
    return s
      .split(/(\s+|-|\/|\(|\))/)
      .map((w, i) => {
        if (!/[A-ZÀ-Ý]/i.test(w)) return w;
        const u = ACENTOS[w.toUpperCase()] || w.toUpperCase();
        if (SIGLAS.has(u)) return u;
        if (i > 0 && MINUSC.has(u)) return u.toLowerCase();
        return u.charAt(0) + u.slice(1).toLowerCase();
      })
      .join("");
  }

  /** Nome do orçamento → nome legível. */
  function limpar(nome) {
    let s = String(nome || "").toUpperCase().replace(/\s+/g, " ").trim();
    // Remove referência de ficha no fim: "- FICHA 49", "F 49", "FICHA 205", "- 198", " F"
    s = s.replace(/\s*[-–]?\s*\b(FICHA|FIC\.?|F)\s*\.?\s*\d+\s*$/g, "");
    s = s.replace(/\s*-\s*\d+\s*$/g, "").replace(/\s+F$/g, "").replace(/\s+F\d{2,4}$/g, "");
    for (const [re, rep] of ABREV) s = s.replace(re, rep);
    s = s.replace(/[A-ZÇÃÕÉÍÓÚÂÊÔ]+/g, (w) => ACENTOS[w] || w);
    s = s.replace(/\s*-\s*$/, "").replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/,(?=\S)/g, ", ").trim();
    return titulo(s);
  }

  /** Nome do setor (nível 3) sem o prefixo "Manutenção do/da", "Aplicação de recursos", etc. */
  function nomeSetor(nome) {
    let s = limpar(nome);
    s = s
      .replace(/^Manutenção\s+(?:(?:do|da|de|dos|das)\s+)?/i, "")
      .replace(/^Aplicação\s+(?:de\s+)?Recursos?\s+(?:(?:do|da|de|dos|das)\s+)?/i, "")
      .replace(/^Aplicação\s+(?:(?:do|da|de)\s+)?/i, "")
      .replace(/^Atividades?\s+(?:(?:do|da|de|dos|das)\s+)?(?:Programa\s+(?!Municipal))?/i, "")
      .replace(/^Serviço\s+do\s+/i, "Serviço de ")
      .trim();
    if (/^(da\s+|do\s+)?Secretaria(\s+Municipal)?$/i.test(s) || !s) s = "Gestão da Secretaria";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Nome curto da secretaria para os blocos ("Secretaria Municipal de Obras" → "Obras"). */
  function nomeSecretaria(nome) {
    const u = String(nome || "").toUpperCase();
    if (/FUNDEB|EDUC/.test(u)) return "Educação" + (/FUNDEB/.test(u) ? " (FUNDEB)" : "");
    if (/SAUDE|SAÚDE/.test(u)) return "Saúde";
    if (/ASSIST/.test(u)) return "Assistência Social";
    if (/GABINETE/.test(u)) return "Gabinete do Prefeito";
    let s = limpar(nome);
    s = s.replace(/^(Secretaria|Fundo)\s+(Municipal|Nacional)?\s*(de|da|do|das|dos)?\s*/i, "").trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Monta a hierarquia a partir do resultado do leitor. `edicoes` = {codigo: nome} vindos da tela. */
  function montar(lido, edicoes) {
    edicoes = edicoes || {};
    const N = lido.nomes;
    const secretarias = new Map(); // chave = nome da secretaria (unidades com o mesmo nome são juntadas)

    for (const s of lido.servidores) {
      const p = String(s.lotacao || "").split(".");
      // Se o 1º nível é o órgão (ex.: "002 - PREFEITURA MUNICIPAL"), a secretaria é o 2º nível;
      // senão (ex.: "009 - SECRETARIA M DE SAUDE"), a secretaria já é o 1º nível.
      const off = p.length >= 2 && ehOrgao(N[p[0]]) ? 1 : 0;
      const codSec = p.slice(0, off + 1).join(".");
      const codSet = p.length >= off + 2 ? p.slice(0, off + 2).join(".") : codSec;
      const codVin = p.length >= off + 3 ? p.slice(0, off + 3).join(".") : null;

      const nomeSec = edicoes[codSec] || nomeSecretaria(N[codSec] || codSec);
      const chaveSec = semAcento(nomeSec);
      if (!secretarias.has(chaveSec)) {
        secretarias.set(chaveSec, {
          codigo: codSec,
          codigos: [],
          original: N[codSec] || codSec,
          nome: nomeSec,
          setores: new Map(),
          servidores: [],
        });
      }
      const sec = secretarias.get(chaveSec);
      if (!sec.codigos.includes(codSec)) {
        sec.codigos.push(codSec);
        if (sec.codigos.length > 1) sec.original += " + " + (N[codSec] || codSec);
      }
      if (!sec.setores.has(codSet)) {
        sec.setores.set(codSet, {
          codigo: codSet,
          acao: codSet.split(".").pop(),
          original: N[codSet] || codSet,
          nome: edicoes[codSet] || nomeSetor(N[codSet] || codSet),
          servidores: [],
        });
      }
      const set = sec.setores.get(codSet);
      const vinculo = codVin ? limpar(N[codVin] || codVin) : titulo(s.situacao || "Sem vínculo informado");
      const item = Object.assign({}, s, {
        secretaria: sec.nome,
        setor: set.nome,
        vinculo,
        cargo: titulo(s.funcao || s.situacao || "Não informado"),
      });
      sec.servidores.push(item);
      set.servidores.push(item);
    }

    // Setores com o mesmo nome dentro da secretaria recebem o número da ação.
    const lista = [...secretarias.values()].map((sec) => {
      const setores = [...sec.setores.values()];
      const cont = {};
      setores.forEach((x) => (cont[x.nome] = (cont[x.nome] || 0) + 1));
      setores.forEach((x) => {
        if (cont[x.nome] > 1 && !edicoes[x.codigo]) x.nome = sec.codigos.length > 1 ? `${x.nome} (${x.codigo})` : `${x.nome} (ação ${x.acao})`;
        x.servidores.forEach((s) => (s.setor = x.nome));
        x.liquido = soma(x.servidores);
      });
      setores.sort((a, b) => b.servidores.length - a.servidores.length || a.codigo.localeCompare(b.codigo));
      return Object.assign(sec, { setores, liquido: soma(sec.servidores) });
    });
    lista.sort((a, b) => b.servidores.length - a.servidores.length || a.codigo.localeCompare(b.codigo));

    const raiz = Object.keys(N).find((k) => !k.includes(".") && ehOrgao(N[k]));
    const todos = lista.flatMap((s) => s.servidores);
    return {
      meta: lido.meta,
      orgao: edicoes._orgao || (raiz ? limpar(N[raiz]) : limpar(lido.meta.entidade || "Prefeitura Municipal")),
      municipio: edicoes._municipio || titulo(lido.meta.municipio || ""),
      referencia: titulo(lido.meta.referencia || ""),
      secretarias: lista,
      servidores: todos,
      total: todos.length,
      liquido: soma(todos),
      proventos: todos.reduce((a, s) => a + (s.proventos || 0), 0),
      conferencia: lido.conferencia,
    };
  }

  /** Nome de órgão/entidade (topo do organograma), e não de secretaria. */
  function ehOrgao(nome) {
    return /^(PREFEITURA|MUNIC[IÍ]PIO|C[AÂ]MARA|PODER\s+(EXECUTIVO|LEGISLATIVO)|ENTIDADE)\b/i.test(String(nome || "").trim());
  }
  function semAcento(s) {
    return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function soma(L) {
    return L.reduce((a, s) => a + (s.liquido || 0), 0);
  }

  function agrupar(L, f) {
    const m = new Map();
    for (const x of L) {
      const k = f(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0])));
  }

  global.FolhaModelo = { montar, limpar, nomeSetor, nomeSecretaria, titulo, agrupar, soma };
})(typeof window !== "undefined" ? window : globalThis);
