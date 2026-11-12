/*
 * Gera as 4 folhas A3 do relatório (organograma, setores, panorama e peso por secretaria)
 * a partir do modelo montado em modelo.js.
 */
(function (global) {
  "use strict";

  const { agrupar, soma } = global.FolhaModelo;
  const PAGE_W = 1497; // A3 paisagem com margem de 12 mm, em px CSS (96 dpi)
  const PAGE_H = 1031;

  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (v) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
  const int = (v) => v.toLocaleString("pt-BR");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Rampa sequencial em um só tom (laranja claro → marrom), usada para "peso".
  const A = [253, 227, 212], B = [122, 36, 0];
  const cor = (t) => `rgb(${A.map((a, i) => Math.round(a + (B[i] - a) * Math.max(0, Math.min(1, t)))).join(",")})`;

  function cabecalho(m, titulo, sub) {
    return `<header class="rh"><h1>${esc(titulo)}<small>${sub}</small></h1>
      <div class="meta">${esc(m.orgao)}${m.meta.uf ? " · " + esc(m.meta.uf) : ""}<br>Folha de Pagamento · ${esc(m.referencia)}</div></header>`;
  }
  function rodape(m, n, total) {
    const c = m.conferencia;
    const conf = c.ok ? "Conferido: os totais lidos batem com os totais impressos no relatório." : "Atenção: há diferenças entre o lido e os totais do relatório (veja a tela da plataforma).";
    return `<footer class="rf"><span>Fonte: Folha de Pagamento ${esc(m.referencia)} (arquivo TXT, ordem de lotação). ${conf}</span><span>Página ${n} de ${total}</span></footer>`;
  }
  function folha(id) {
    const p = document.createElement("section");
    p.className = "sheet";
    p.id = id;
    return p;
  }

  /* ---------- 1. Organograma (uma ou mais folhas) ---------- */
  const MAX_COLS = 9;       // acima disso, as secretarias quebram em linhas
  const ESCALA_MIN = 0.72;  // abaixo disso, o restante vai para uma folha de continuação

  function colunaSecretaria(m, s) {
    let h = `<div class="col"><div class="box sec"><span class="ed" data-cod="${(s.codigos || [s.codigo]).join("|")}" title="${esc(s.original)}">${esc(s.nome)}</span>
      <span class="q">${int(s.servidores.length)} funcionários</span><i>${pct(s.servidores.length / m.total)} da folha</i></div><div class="units">`;
    for (const t of s.setores) {
      const vincs = agrupar(t.servidores, (x) => x.vinculo);
      h += `<div class="unit"><h3><span class="ed" data-cod="${t.codigo}" title="${esc(t.original)}">${esc(t.nome)}</span><b>${int(t.servidores.length)}</b></h3>
        <ul>${vincs.map(([v, L]) => `<li><span>${esc(v)}</span><b>${L.length}</b></li>`).join("")}</ul></div>`;
    }
    return h + `</div></div>`;
  }

  function cabecalhoOrg(m, continuacao) {
    const nSet = m.secretarias.reduce((a, s) => a + s.setores.length, 0);
    let h = cabecalho(m, `Organograma da Folha — \u0000MUN\u0000${continuacao ? " (continuação)" : ""}`,
      `${int(m.total)} funcionários · ${m.secretarias.length} secretarias · ${nSet} setores · líquido total ${brl(m.liquido)}`);
    return h.replace("\u0000MUN\u0000", continuacao ? esc(m.municipio) : `<span class="ed" data-cod="_municipio" title="Nome do município">${esc(m.municipio)}</span>`);
  }
  function raizOrg(m, continuacao) {
    return continuacao
      ? `<div class="box root cont">${esc(m.orgao)}<span class="q">continuação do organograma</span></div>`
      : `<div class="box root"><span class="ed" data-cod="_orgao" title="Nome do órgão">${esc(m.orgao)}</span><span class="q">${int(m.total)} funcionários</span></div>`;
  }

  function organograma(m, container) {
    const S = m.secretarias;
    // Poucas secretarias: uma linha só, centralizada (layout clássico).
    if (S.length <= MAX_COLS) {
      const p = folha("pg-organograma");
      p.innerHTML = cabecalhoOrg(m, false) + `<div class="fit"><div class="org">${raizOrg(m, false)}<div class="vl"></div>
        <div class="row">${S.map((s) => colunaSecretaria(m, s)).join("")}</div></div></div><footer class="rf"><span>&nbsp;</span></footer>`;
      container.appendChild(p);
      return [p];
    }
    // Muitas secretarias: linhas de até MAX_COLS colunas, ligadas por um tronco à esquerda.
    const nLinhas = Math.ceil(S.length / MAX_COLS);
    const porLinha = Math.ceil(S.length / nLinhas);
    const linhas = [];
    for (let i = 0; i < S.length; i += porLinha) linhas.push(S.slice(i, i + porLinha));
    const linhaHTML = (L) => `<div class="linha" style="--cols:${porLinha}"><div class="row">${L.map((s) => colunaSecretaria(m, s)).join("")}</div></div>`;

    const pages = [];
    let i = 0;
    while (i < linhas.length) {
      const cont = pages.length > 0;
      const p = folha("pg-organograma" + (cont ? "-" + (pages.length + 1) : ""));
      p.innerHTML = cabecalhoOrg(m, cont) + `<div class="fit"><div class="org multi">${raizOrg(m, cont)}<div class="vl"></div><div class="ramal"></div></div></div><footer class="rf"><span>&nbsp;</span></footer>`;
      container.appendChild(p);
      const fit = p.querySelector(".fit"), org = p.querySelector(".org");
      let n = 0;
      while (i < linhas.length) {
        org.insertAdjacentHTML("beforeend", linhaHTML(linhas[i]));
        if (n > 0 && org.scrollHeight * ESCALA_MIN > fit.clientHeight) { org.lastElementChild.remove(); break; }
        i++; n++;
      }
      pages.push(p);
    }
    return pages;
  }

  /* ---------- 2. Tabela de setores (pode ocupar mais de uma folha) ---------- */
  function linhasSetores(m) {
    const rows = [];
    for (const s of m.secretarias) {
      for (const t of s.setores) {
        const cargos = agrupar(t.servidores, (x) => x.cargo).map(([c, L]) => `${esc(c)} (${L.length})`).join(", ");
        const vincs = agrupar(t.servidores, (x) => x.vinculo).map(([c, L]) => `${esc(c)} (${L.length})`).join(", ");
        const fl = t.servidores.map((x) => x.folha).filter(Boolean);
        rows.push(`<tr><td>${esc(s.nome)}</td><td><b>${esc(t.nome)}</b><span class="mini">${esc(t.codigo)} · ${esc(t.original)}</span></td>
          <td>${cargos}</td><td>${vincs}</td><td class="r">${fl.length ? Math.min(...fl) + "–" + Math.max(...fl) : ""}</td>
          <td class="r"><b>${int(t.servidores.length)}</b></td><td class="r">${brl(t.liquido)}</td></tr>`);
      }
    }
    rows.push(`<tr class="tot"><td colspan="5">Total · ${m.secretarias.reduce((a, s) => a + s.setores.length, 0)} setores</td><td class="r">${int(m.total)}</td><td class="r">${brl(m.liquido)}</td></tr>`);
    return rows;
  }
  function tabelaSetores(m, container) {
    const thead = `<thead><tr><th>Secretaria</th><th>Setor <span class="mini">(código e nome original)</span></th><th>Cargos (servidores)</th><th>Vínculo (servidores)</th><th class="r">Folhas</th><th class="r">Func.</th><th class="r">Líquido</th></tr></thead>`;
    const rows = linhasSetores(m);
    const pages = [];
    let i = 0;
    while (i < rows.length) {
      const p = folha("pg-setores-" + (pages.length + 1));
      p.innerHTML = cabecalho(m, "Setores, cargos e vínculos" + (pages.length ? " (continuação)" : ""), "Setor = departamento/ação da lotação; vínculo = último nível da lotação") +
        `<div class="tbl"><table class="setores">${thead}<tbody></tbody></table></div><footer class="rf"><span>&nbsp;</span></footer>`;
      container.appendChild(p);
      const tb = p.querySelector("tbody");
      const area = p.querySelector(".tbl");
      let n = 0;
      while (i < rows.length) {
        tb.insertAdjacentHTML("beforeend", rows[i]);
        if (area.scrollHeight > area.clientHeight + 1 && n > 0) {
          tb.lastElementChild.remove();
          break;
        }
        i++; n++;
      }
      pages.push(p);
    }
    return pages;
  }

  /* ---------- 3. Panorama (mapa de áreas por secretaria) ---------- */
  function squarify(items, x, y, w, h, out) {
    if (!items.length) return;
    const total = items.reduce((a, i) => a + i.v, 0);
    if (items.length === 1) { out.push(Object.assign({}, items[0], { x, y, w, h })); return; }
    let row = [], rest = items.slice(), best = Infinity;
    const short = Math.min(w, h);
    const worst = (r) => {
      const s = r.reduce((a, i) => a + i.v, 0) / total * w * h;
      const a = r.map((i) => i.v / total * w * h);
      return Math.max(short * short * Math.max(...a) / (s * s), (s * s) / (short * short * Math.min(...a)));
    };
    while (rest.length) {
      const c = row.concat([rest[0]]), wr = worst(c);
      if (wr <= best || !row.length) { row = c; rest.shift(); best = wr; } else break;
    }
    const rs = row.reduce((a, i) => a + i.v, 0), frac = rs / total;
    if (w >= h) {
      const rw = w * frac; let yy = y;
      row.forEach((i) => { const hh = h * i.v / rs; out.push(Object.assign({}, i, { x, y: yy, w: rw, h: hh })); yy += hh; });
      squarify(rest, x + rw, y, w - rw, h, out);
    } else {
      const rh = h * frac; let xx = x;
      row.forEach((i) => { const ww = w * i.v / rs; out.push(Object.assign({}, i, { x: xx, y, w: ww, h: rh })); xx += ww; });
      squarify(rest, x, y + rh, w, h - rh, out);
    }
  }

  /** Até `k` secretarias; o restante vira um bloco "Demais secretarias" (só para gráficos). */
  function principais(m, k) {
    const S = m.secretarias;
    if (S.length <= k + 1) return S;
    const resto = S.slice(k - 1);
    const serv = resto.flatMap((s) => s.servidores);
    return S.slice(0, k - 1).concat([{ nome: `Demais ${resto.length} secretarias`, servidores: serv, liquido: soma(serv), demais: true }]);
  }

  function panorama(m) {
    const p = folha("pg-panorama");
    const S = principais(m, 16), max = Math.max(...S.map((s) => s.servidores.length));
    const d2 = m.secretarias.slice(0, 2), q2 = d2.reduce((a, s) => a + s.servidores.length, 0), l2 = d2.reduce((a, s) => a + s.liquido, 0);
    const q4 = m.secretarias.slice(0, 4).reduce((a, s) => a + s.servidores.length, 0);
    p.innerHTML = cabecalho(m, "Onde a folha pesa mais", "Panorama geral: cada bloco é uma secretaria, do tamanho do seu número de funcionários") +
      `<div class="pano"><div class="tm"></div><aside class="side">
        <div><h2>Escala de cor (funcionários)</h2><div class="scale">${[0, .2, .4, .6, .8, 1].map((t) => `<span style="background:${cor(.15 + .85 * t)}"></span>`).join("")}</div><div class="sl"><span>1</span><span>${max}</span></div></div>
        <div class="insight"><b>${d2.map((s) => esc(s.nome)).join("</b> e <b>")}</b> somam <b>${int(q2)}</b> dos ${int(m.total)} funcionários (<b>${pct(q2 / m.total)}</b>) e <b>${brl(l2)}</b> do líquido (<b>${pct(l2 / m.liquido)}</b>).${m.secretarias.length > 4 ? ` As 4 maiores secretarias concentram <b>${pct(q4 / m.total)}</b> da folha.` : ""}</div>
        <div><h2>Funcionários por secretaria</h2><div class="bars">${S.map((s) => `<span>${esc(s.nome)}</span><span class="t"><span style="width:${s.servidores.length / max * 100}%;background:${cor(.15 + .85 * Math.sqrt(s.servidores.length / max))}"></span></span><span class="num"><b>${int(s.servidores.length)}</b></span>`).join("")}</div></div>
      </aside></div>`;
    return p;
  }
  function desenharPanorama(p, m) {
    const tm = p.querySelector(".tm");
    const W = tm.clientWidth, H = tm.clientHeight, lista = principais(m, 16);
    const max = Math.max(...lista.map((s) => s.servidores.length));
    const out = [];
    squarify(lista.map((s) => ({ s, v: s.servidores.length })), 0, 0, W, H, out);
    for (const g of out) {
      const f = g.s.servidores.length, k = Math.sqrt(f / max), nm = g.s.nome;
      const d = document.createElement("div");
      d.className = "tile";
      d.style.cssText = `left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px;background:${cor(.15 + .85 * k)};color:${k > .35 ? "#fff" : "#3a1c0e"}`;
      const s = Math.min(g.w, g.h * 1.6), fit = Math.min(g.w * 1.6 / Math.max(8, nm.length), 40);
      if (s > 150) {
        d.innerHTML = `<div class="bn" style="font-size:${Math.max(12, Math.min(fit, s / 9))}px">${esc(nm)}</div>
          <div class="bv" style="font-size:${Math.max(26, Math.min(120, s / 3.6))}px">${int(f)}</div>
          <div class="bs" style="font-size:${Math.max(11, Math.min(20, s / 22))}px">funcionários · ${pct(f / m.total)} da folha<br>${brl(g.s.liquido)} líquido</div>`;
      } else if (s > 55) {
        d.innerHTML = `<div class="bn" style="font-size:${Math.min(12, fit)}px">${esc(nm)}</div><div class="bv" style="font-size:22px">${int(f)}</div>`;
      } else {
        d.innerHTML = `<div class="bv" style="font-size:12px">${int(f)}</div><div style="font-size:7px;line-height:1.05">${esc(nm)}</div>`;
      }
      d.title = `${nm}: ${f} funcionários`;
      tm.appendChild(d);
      // Se o texto não couber no bloco, usa a versão compacta (e, se ainda não couber, só o número).
      // (o conteúdo é alinhado embaixo, então o excesso sobe e não aparece em scrollHeight: mede os filhos)
      const altura = () => [...d.children].reduce((a, c) => a + c.getBoundingClientRect().height, 0) + 8;
      const util = () => d.clientHeight - parseFloat(getComputedStyle(d).paddingTop) - parseFloat(getComputedStyle(d).paddingBottom);
      if (altura() > util() || d.scrollWidth > d.clientWidth + 1) {
        d.innerHTML = `<div class="bn" style="font-size:${Math.min(12, fit)}px">${esc(nm)}</div><div class="bv" style="font-size:${Math.max(14, Math.min(26, s / 5))}px">${int(f)}</div>`;
        if (altura() > util()) d.innerHTML = `<div class="bv" style="font-size:12px">${int(f)}</div><div style="font-size:7px;line-height:1.05">${esc(nm)}</div>`;
      }
    }
  }

  /* ---------- 4. Peso por secretaria ---------- */
  function pesoSecretarias(m) {
    const p = folha("pg-secretarias");
    const S = m.secretarias, G = principais(m, 12);
    const maxF = Math.max(...G.map((s) => s.servidores.length)), maxL = Math.max(...G.map((s) => s.liquido));
    const barra = (L, val, max, fmt, tot) => L.map((s) => {
      const v = val(s);
      return `<span>${esc(s.nome)}</span><span class="t"><span style="width:${v / max * 100}%;background:${cor(.15 + .85 * Math.sqrt(v / max))}"></span></span><span class="num"><b>${fmt(v)}</b> · ${pct(v / tot)}</span>`;
    }).join("");
    const sit = agrupar(m.servidores, (x) => x.situacao || "Não informado");
    const maxSit = sit[0][1].length;
    p.innerHTML = cabecalho(m, "Peso por secretaria", "Comparação por número de funcionários, valor líquido pago e situação funcional") +
      `<div class="fit"><div class="grid2"><div class="blk">
        <h2>Funcionários por secretaria</h2><div class="bars">${barra(G, (s) => s.servidores.length, maxF, int, m.total)}</div>
        <h2 class="mt">Líquido pago por secretaria</h2><div class="bars">${barra(G.filter((s) => !s.demais).sort((a, b) => b.liquido - a.liquido).concat(G.filter((s) => s.demais)), (s) => s.liquido, maxL, brl, m.liquido)}</div>
        <h2 class="mt">Situação funcional</h2><div class="bars">${sit.map(([k, L]) => `<span>${esc(global.FolhaModelo.titulo(k))}</span><span class="t"><span style="width:${L.length / maxSit * 100}%;background:${cor(.15 + .85 * Math.sqrt(L.length / maxSit))}"></span></span><span class="num"><b>${int(L.length)}</b> · ${pct(L.length / m.total)}</span>`).join("")}</div>
      </div><div class="blk">
        <h2>Resumo por secretaria</h2><table class="tab-resumo"><thead><tr><th>Secretaria</th><th class="r">Setores</th><th class="r">Funcionários</th><th class="r">Proventos</th><th class="r">Líquido</th><th class="r">Líquido médio</th></tr></thead><tbody>
        ${S.map((s) => `<tr><td>${esc(s.nome)}</td><td class="r">${s.setores.length}</td><td class="r">${int(s.servidores.length)}</td><td class="r">${brl(s.servidores.reduce((a, x) => a + (x.proventos || 0), 0))}</td><td class="r">${brl(s.liquido)}</td><td class="r">${brl(s.liquido / s.servidores.length)}</td></tr>`).join("")}
        <tr class="tot"><td>Total</td><td class="r">${S.reduce((a, s) => a + s.setores.length, 0)}</td><td class="r">${int(m.total)}</td><td class="r">${brl(m.proventos)}</td><td class="r">${brl(m.liquido)}</td><td class="r">${brl(m.liquido / m.total)}</td></tr></tbody></table>
        <div class="insight mt">${m.conferencia.ok
          ? `Conferência: os funcionários e o líquido das ${m.conferencia.lotacoesConferidas} lotações batem com os totais impressos no relatório${m.conferencia.geral ? `. Total geral do relatório: ${int(m.conferencia.geral.funcionarios)} funcionários e ${brl(m.conferencia.geral.liquido)} líquido` : ""}.`
          : `Atenção: ${m.conferencia.diferencas.length} lotação(ões) com diferença entre o lido e o total impresso. Confira o arquivo antes de usar estes números.`}</div>
      </div></div></div>`;
    return p;
  }

  /* ---------- Ajuste para caber na folha ---------- */
  function caber(p) {
    const fit = p.querySelector(".fit");
    if (!fit) return;
    const inner = fit.firstElementChild;
    inner.style.transform = "";
    inner.style.width = "";
    const disp = fit.clientHeight, alt = inner.scrollHeight;
    if (alt > disp) {
      const s = Math.max(0.4, disp / alt);
      inner.style.transform = `scale(${s})`;
      inner.style.transformOrigin = "top left";
      inner.style.width = `${100 / s}%`;
    }
  }

  /** Renderiza todas as folhas dentro de `container` (que precisa estar no DOM). */
  function gerar(m, container) {
    container.innerHTML = "";
    const orgs = organograma(m, container);
    const setores = tabelaSetores(m, container);
    const pano = panorama(m);
    container.appendChild(pano);
    const peso = pesoSecretarias(m);
    container.appendChild(peso);
    const todas = [...orgs, ...setores, pano, peso];
    todas.forEach((p, i) => {
      const old = p.querySelector("footer.rf");
      if (old) old.outerHTML = rodape(m, i + 1, todas.length);
      else p.insertAdjacentHTML("beforeend", rodape(m, i + 1, todas.length));
    });
    orgs.forEach(caber);
    caber(peso);
    desenharPanorama(pano, m);
    return todas;
  }

  global.FolhaRelatorio = { gerar, PAGE_W, PAGE_H, brl, pct, int };
})(window);
