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
    // Envolve cada folha numa moldura escalada para caber na largura da tela.
    folhas.forEach((f) => {
      const mold = document.createElement("div");
      mold.className = "moldura";
      f.replaceWith(mold);
      mold.appendChild(f);
    });
    box.classList.remove("medindo");
    escalar();
    ativarEdicao();
    window.scrollTo(0, rolagem);
  }

  function escalar() {
    const box = $("#folhas");
    const disp = box.clientWidth;
    box.querySelectorAll(".moldura").forEach((mold) => {
      const f = mold.firstElementChild;
      const w = f.offsetWidth, h = f.offsetHeight;
      const s = Math.min(1, disp / w);
      f.style.transform = `scale(${s})`;
      mold.style.width = `${w * s}px`;
      mold.style.height = `${h * s}px`;
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
    $("#painel").hidden = true;
    $("#acoes").hidden = true;
    $("#envio").hidden = false;
    window.scrollTo(0, 0);
  });
})();
