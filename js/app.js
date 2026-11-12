(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const { brl, int } = window.FolhaRelatorio;
  const estado = { lido: null, modelo: null, arquivo: "" };

  const drop = $("#drop"), input = $("#arquivo"), erro = $("#erro");

  /* ---------- Envio do arquivo ---------- */
  input.addEventListener("change", () => input.files[0] && abrir(input.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("arrastando"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("arrastando")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) abrir(f); });
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) abrir(f); });

  async function abrir(arquivo) {
    erro.hidden = true;
    drop.classList.add("processando");
    $("#drop-status").textContent = "Lendo " + arquivo.name + "…";
    try {
      const buf = await arquivo.arrayBuffer();
      const texto = window.FolhaParser.decode(buf);
      estado.lido = window.FolhaParser.parse(texto);
      estado.arquivo = arquivo.name;
      await (document.fonts ? document.fonts.ready : Promise.resolve());
      mostrar();
    } catch (e) {
      console.error(e);
      erro.textContent = e && e.message ? e.message : "Não consegui ler este arquivo.";
      erro.hidden = false;
    } finally {
      input.value = "";
      drop.classList.remove("processando");
      $("#drop-status").textContent = "";
    }
  }

  /* ---------- Nomes editados (salvos por município) ---------- */
  const chave = () => "fopag:nomes:" + ((estado.lido && estado.lido.meta.municipio) || "geral");
  function lerEdicoes() {
    try { return JSON.parse(localStorage.getItem(chave()) || "{}"); } catch (e) { return {}; }
  }
  function salvarEdicoes(ed) {
    try { localStorage.setItem(chave(), JSON.stringify(ed)); } catch (e) { /* navegador sem armazenamento: segue sem salvar */ }
  }

  /* ---------- Tela ---------- */
  function mostrar() {
    estado.modelo = window.FolhaModelo.montar(estado.lido, lerEdicoes());
    const m = estado.modelo, c = m.conferencia;

    $("#envio").hidden = true;
    $("#painel").hidden = false;
    $("#acoes").hidden = false;
    $("#area").hidden = false;

    $("#painel-titulo").textContent = "Relatório da folha" + (m.municipio ? " · " + m.municipio : "");
    const contexto = [m.orgao, m.referencia, m.meta.calculo].filter(Boolean).map(esc).join(" · ");
    $("#arquivo-nome").innerHTML = `<code>${esc(estado.arquivo)}</code>${contexto ? " · " + contexto : ""}`;

    $("#resumo").innerHTML = [
      ["Município", m.municipio || "—"],
      ["Referência", m.referencia || "—"],
      ["Funcionários", int(m.total)],
      ["Secretarias", int(m.secretarias.length)],
      ["Líquido", brl(m.liquido)],
    ].map(([k, v]) => `<div class="cartao"><span>${k}</span><strong>${v}</strong></div>`).join("");

    const conf = $("#conferencia");
    if (c.ok) {
      conf.className = "conferencia ok";
      conf.innerHTML = `<b>Conferido.</b> As ${c.lotacoesConferidas} lotações batem com os totais impressos no relatório${c.geral ? ` (total geral: ${int(c.geral.funcionarios)} funcionários e ${brl(c.geral.liquido)} líquido)` : ""}.`;
    } else {
      conf.className = "conferencia alerta";
      const itens = c.diferencas.slice(0, 8).map((d) =>
        `<li>Lotação ${d.lotacao}: relatório ${d.esperado.funcionarios ?? "?"} func. / ${d.esperado.liquido !== undefined ? brl(d.esperado.liquido) : "?"} · lido ${d.lido.funcionarios} func. / ${brl(d.lido.liquido)}</li>`).join("");
      conf.innerHTML = `<b>Atenção: o que foi lido não bate com os totais do relatório.</b> Confira o arquivo antes de usar os números.
        <ul>${itens}${c.semTotal.length ? `<li>${c.semTotal.length} servidor(es) sem a linha de TOTAL.</li>` : ""}${c.geralOk === false ? `<li>Total geral: relatório ${int(c.geral.funcionarios)} func. / ${brl(c.geral.liquido)} · lido ${int(c.lido.funcionarios)} func. / ${brl(c.lido.liquido)}</li>` : ""}</ul>`;
    }
    desenhar();
  }

  function desenhar() {
    const box = $("#folhas");
    const rolagem = window.scrollY;
    box.classList.add("medindo");
    const folhas = window.FolhaRelatorio.gerar(estado.modelo, box);
    // Envolve cada folha numa moldura escalada para caber na largura da tela,
    // com um rótulo (só na tela) e uma entrada no índice de páginas.
    const itens = [];
    folhas.forEach((f, i) => {
      const titulo = tituloFolha(f);
      const item = document.createElement("div");
      item.className = "folha-item";
      item.id = "folha-" + (i + 1);
      item.innerHTML = `<div class="rotulo"><span><b>Página ${i + 1}</b> de ${folhas.length}</span><span>${esc(titulo)}</span></div>`;
      const mold = document.createElement("div");
      mold.className = "moldura";
      f.replaceWith(item);
      mold.appendChild(f);
      item.appendChild(mold);
      itens.push({ id: item.id, titulo });
    });
    box.classList.remove("medindo");
    montarIndice(itens);
    escalar();
    ativarEdicao();
    window.scrollTo(0, rolagem);
  }

  function escalar() {
    const box = $("#folhas");
    const cs = getComputedStyle(box);
    const disp = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    box.querySelectorAll(".moldura").forEach((mold) => {
      const f = mold.firstElementChild;
      const w = f.offsetWidth, h = f.offsetHeight;
      const s = Math.min(1, disp / w);
      f.style.transform = `scale(${s})`;
      mold.style.width = `${w * s}px`;
      mold.style.height = `${h * s}px`;
    });
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function tituloFolha(f) {
    const h = f.querySelector(".rh h1");
    if (!h) return "";
    const c = h.cloneNode(true);
    c.querySelectorAll("small").forEach((s) => s.remove());
    return c.textContent.replace(/\s+/g, " ").trim();
  }

  /* Índice de páginas: navegação dentro do relatório e destaque da página visível. */
  let observador = null;
  function montarIndice(itens) {
    const nav = $("#indice");
    nav.innerHTML = `<h2>Páginas do relatório</h2><ol>${itens.map((x, i) =>
      `<li><a href="#${x.id}" data-alvo="${x.id}"><span>${i + 1}</span><span>${esc(x.titulo)}</span></a></li>`).join("")}</ol>`;
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const alvo = document.getElementById(a.dataset.alvo);
      if (alvo) alvo.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      marcar(a.dataset.alvo);
    }));
    if (observador) observador.disconnect();
    if ("IntersectionObserver" in window) {
      const visiveis = new Map();
      observador = new IntersectionObserver((entradas) => {
        entradas.forEach((en) => visiveis.set(en.target.id, en.intersectionRatio));
        let melhor = null, r = 0;
        visiveis.forEach((v, k) => { if (v > r) { r = v; melhor = k; } });
        if (melhor) marcar(melhor);
      }, { threshold: [0, .25, .5, .75, 1] });
      document.querySelectorAll(".folha-item").forEach((el) => observador.observe(el));
    }
    if (itens[0]) marcar(itens[0].id);
  }
  function marcar(id) {
    document.querySelectorAll("#indice a").forEach((a) => {
      if (a.dataset.alvo === id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => estado.modelo && escalar(), 120); });

  function ativarEdicao() {
    document.querySelectorAll("#folhas .ed").forEach((el) => {
      el.contentEditable = "true";
      el.spellcheck = false;
      const original = el.textContent;
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); el.blur(); }
        if (e.key === "Escape") { el.textContent = original; el.blur(); }
      });
      el.addEventListener("blur", () => {
        const novo = el.textContent.replace(/\s+/g, " ").trim();
        if (!novo || novo === original) { el.textContent = original; return; }
        const ed = lerEdicoes();
        ed[el.dataset.cod] = novo;
        salvarEdicoes(ed);
        estado.modelo = window.FolhaModelo.montar(estado.lido, ed);
        desenhar();
      });
    });
  }

  /* ---------- Tema claro/escuro ---------- */
  const btnTema = $("#btn-tema");
  const escuroSistema = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : { matches: false, addEventListener() {} };
  const temaAtual = () => document.documentElement.getAttribute("data-theme") || (escuroSistema.matches ? "dark" : "light");
  function atualizarBotaoTema() {
    const escuro = temaAtual() === "dark";
    btnTema.setAttribute("aria-pressed", String(escuro));
    btnTema.querySelector(".btn-tema-txt").textContent = escuro ? "Tema claro" : "Tema escuro";
    btnTema.title = escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro";
  }
  btnTema.addEventListener("click", () => {
    const novo = temaAtual() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    try { localStorage.setItem("fopag:tema", novo); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
    atualizarBotaoTema();
  });
  if (escuroSistema.addEventListener) escuroSistema.addEventListener("change", atualizarBotaoTema);
  atualizarBotaoTema();

  /* ---------- Botões ---------- */
  const nomeBase = () => {
    const m = estado.modelo;
    const limpo = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
    return `Organograma_Folha_${limpo(m.municipio) || "Municipio"}_${limpo(m.referencia).replace(/_/g, "-") || "ref"}`;
  };

  $("#btn-pdf").addEventListener("click", () => {
    const titulo = document.title;
    document.title = nomeBase(); // vira o nome sugerido do arquivo PDF
    const volta = () => { document.title = titulo; window.removeEventListener("afterprint", volta); };
    window.addEventListener("afterprint", volta);
    window.print();
    setTimeout(volta, 1500);
  });

  $("#btn-csv").addEventListener("click", () => {
    const m = estado.modelo;
    const cab = ["Secretaria", "Setor", "Código lotação", "Vínculo", "Matrícula", "Nome", "Função", "Situação", "Admissão", "Proventos", "Descontos", "Líquido", "Folha"];
    const n = (v) => (v === null || v === undefined ? "" : v.toFixed(2).replace(".", ","));
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = m.servidores.map((s) => [s.secretaria, s.setor, s.lotacao, s.vinculo, s.matricula, s.nome, s.cargo, s.situacao, s.admissao, n(s.proventos), n(s.descontos), n(s.liquido), s.folha]);
    const csv = "﻿" + [cab, ...linhas].map((l) => l.map(q).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeBase().replace("Organograma_", "Servidores_") + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  $("#btn-novo").addEventListener("click", () => {
    estado.lido = estado.modelo = null;
    $("#folhas").innerHTML = "";
    $("#indice").innerHTML = "";
    if (observador) observador.disconnect();
    $("#area").hidden = true;
    $("#painel").hidden = true;
    $("#acoes").hidden = true;
    $("#envio").hidden = false;
    window.scrollTo(0, 0);
  });
})();
