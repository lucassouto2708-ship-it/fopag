# FOPAG · Organograma da Folha de Pagamento

Plataforma 100% front-end. Você envia o **TXT da folha de pagamento** e recebe, na hora:

1. **Organograma**: Prefeitura → Secretarias → Setores (departamento/ação) → Vínculos, com a quantidade de funcionários em cada nível.
2. **Setores, cargos e vínculos**: tabela com os cargos, os vínculos, as folhas do relatório e o líquido de cada setor.
3. **Onde a folha pesa mais**: panorama com um bloco por secretaria, do tamanho do número de funcionários.
4. **Peso por secretaria**: funcionários, líquido, situação funcional e líquido médio.

Tudo sai em A3 paisagem pelo botão **Baixar PDF**. O botão **Baixar planilha (CSV)** gera a lista de servidores já com secretaria, setor e vínculo, para abrir no Excel.

## Privacidade

O arquivo é lido **no navegador**. Não existe servidor nem banco de dados: nenhum dado da folha sai do computador de quem está usando.

## Conferência automática

Depois de ler o arquivo, a plataforma compara a soma dos servidores com os totais que o próprio relatório imprime:

- `T O T A L  F U N C I O N A R I O S` e `T O T A L  L O T A C A O` de cada lotação;
- `TOTAL GERAL FUNCIONARIOS` e `TOTAL GERAL DA FOLHA DE PAGAMENTO`.

Se algo não bater, aparece um aviso em laranja com as lotações divergentes, e o rodapé do PDF também avisa.

## Formato aceito

TXT da folha **em ordem de lotação** ("F O L H A  D E  P A G A M E N T O", "ORDEM - LOTAÇÃO / ALFABÉTICA"), como neste trecho:

```
   LOTAÇÃO:    002                    - PREFEITURA MUNICIPAL DE SARDOA
               002.001                - SECRET. MUNIC. DE ADMINISTR. E GOVERNO
               002.001.204            - MANUT. DEPART. DE ADMINISTRACAO
               002.001.204.00043      - CONTRATO - F 49
   160201  /1  MARILENE DA COSTA FIRMINO         III /B       -CHEFE DE DIVISAO              04/02/2025  COMISSIONADO
                100        P   VENCIMENTO                         200,00            2.293,72
                                                   TOTAL....:                       2.293,72         182,11       2.111,61
```

Os níveis da lotação viram a hierarquia do organograma:

| Nível | Exemplo | No relatório |
|---|---|---|
| 1 | `002` | Órgão (topo do organograma) |
| 2 | `002.001` | Secretaria |
| 3 | `002.001.204` | Setor (departamento/ação) |
| 4 | `002.001.204.00043` | Vínculo (contratado, efetivo, comissionado…) |

Arquivos em ISO-8859-1 (padrão do sistema) ou UTF-8 funcionam.

## Nomes

Os nomes do orçamento são deixados legíveis automaticamente (abreviações e acentos): `MANUT. DEPART. DE OBRAS` vira `Departamento de Obras`.
Para corrigir um nome, **clique nele no organograma** e digite. Vale para município, órgão, secretarias e setores; a mudança aparece em todas as páginas e fica salva no navegador para os próximos arquivos do mesmo município.

## Como baixar o PDF

Clique em **Baixar PDF**. Na janela de impressão do navegador:

- **Destino:** "Salvar como PDF";
- **Tamanho/orientação:** já vêm como A3 paisagem;
- Em "Mais definições", deixe **"Gráficos de plano de fundo"** marcado (para as cores aparecerem).

O nome do arquivo já vem sugerido, por exemplo `Organograma_Folha_Sardoa_Outubro-2026.pdf`.
Funciona melhor no **Chrome** ou no **Edge**.

## Publicar no GitHub Pages

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Selecione o branch **main** e a pasta **/ (root)** e clique em **Save**.
4. Em um ou dois minutos o site fica no ar em `https://<usuario>.github.io/fopag/`.

Também dá para abrir direto no computador: baixe o repositório e dê dois cliques no `index.html`.

## Estrutura

```
index.html          tela de envio e visualização
css/app.css         visual da plataforma (tema claro/escuro)
css/relatorio.css   visual das folhas A3 (o que vai para o PDF)
js/parser.js        leitura do TXT e conferência dos totais
js/modelo.js        hierarquia e limpeza dos nomes
js/relatorio.js     montagem das 4 páginas
js/app.js           envio do arquivo, edição de nomes, PDF e CSV
```

> Não suba arquivos de folha (TXT) para este repositório: eles têm dados pessoais dos servidores. O `.gitignore` já ignora `*.txt`.
