/* =====================================================
   PAINEL DO PROFESSOR – lógica do site
   Ciclo básico: alterar os dados (S) -> salvar() -> render()
   ===================================================== */


/* ---------- 1. ESTADO ---------- */

// S = todos os dados (turmas > alunos e provas)
let S = { turmas: [] };

// U = o que está selecionado na tela agora
let U = { t: null, p: null, tab: 'alunos', sub: 'temas' };

// Carrega os dados salvos no navegador (se existirem)
try {
  let raw = localStorage.getItem('painel-prof');
  if (raw) S = JSON.parse(raw);
} catch (e) {}


/* ---------- 2. FUNÇÕES AUXILIARES ---------- */

function save() {
  try {
    localStorage.setItem('painel-prof', JSON.stringify(S));
  } catch (e) {}
}

// Gera um id aleatório curto
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// Evita que texto digitado vire HTML (segurança)
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Turma selecionada
function T() {
  return S.turmas.find(function (t) {
    return t.id === U.t;
  });
}

// Prova selecionada (da turma selecionada)
function P() {
  let t = T();
  return t && t.provas.find(function (p) {
    return p.id === U.p;
  });
}

// Lê o valor de um input e limpa o campo
function val(id) {
  let e = document.getElementById(id);
  let v = e.value.trim();
  e.value = '';
  return v;
}

// Cor conforme a porcentagem (verde / amarelo / vermelho)
function cor(p) {
  if (p >= 70) return 'var(--ok)';
  if (p >= 50) return 'var(--mid)';
  return 'var(--bad)';
}

// 7 -> "7,0"
function fmt(n) {
  return n.toFixed(1).replace('.', ',');
}


/* ---------- 3. AÇÕES (alteram os dados e redesenham) ---------- */

function addTurma() {
  let n = val('nt');
  if (!n) return;

  let t = { id: uid(), nome: n, alunos: [], provas: [] };
  S.turmas.push(t);

  U.t = t.id;
  U.p = null;
  U.tab = 'alunos';
  save();
  render();
}

function selTurma(id) {
  U.t = id;
  U.p = null;
  render();
}

function delTurma() {
  if (confirm('Excluir esta turma?')) {
    S.turmas = S.turmas.filter(function (t) {
      return t.id !== U.t;
    });
    U.t = null;
    U.p = null;
    save();
    render();
  }
}

function addAluno() {
  let n = val('na');
  if (!n) return;

  T().alunos.push({ id: uid(), nome: n });
  save();
  render();
}

function delAluno(id) {
  let t = T();

  t.alunos = t.alunos.filter(function (a) {
    return a.id !== id;
  });

  // apaga também o resultado desse aluno em todas as provas
  t.provas.forEach(function (p) {
    delete p.res[id];
  });

  save();
  render();
}

function addProva() {
  let n = document.getElementById('np').value.trim();
  let g = document.getElementById('ng').value.trim();
  if (!n || !g) return;               // nome e tema geral são obrigatórios

  let p = {
    id: uid(),
    nome: n,
    tema: g,                          // NOVO: tema geral da prova
    temas: Array(10).fill(''),        // subtópicos (opcionais)
    res: {}
  };
  T().provas.push(p);

  U.p = p.id;
  U.sub = 'temas';
  save();
  render();
}

function selProva(id) {
  U.p = id;
  render();
}

function delProva() {
  if (confirm('Excluir esta prova?')) {
    let t = T();
    t.provas = t.provas.filter(function (p) {
      return p.id !== U.p;
    });
    U.p = null;
    save();
    render();
  }
}

function setTema(i, v) {
  P().temas[i] = v.trim();
  save();
}

// Marca/desmarca o acerto do aluno "a" na questão "i"
function setRes(a, i, v) {
  let p = P();
  if (!p.res[a]) p.res[a] = Array(10).fill(false);
  p.res[a][i] = v;
  save();
}

function tab(k) {
  U.tab = k;
  render();
}

function sub(k) {
  U.sub = k;
  render();
}


/* ---------- 4. CÁLCULOS ---------- */

// Subtópico da questão; se estiver vazio, usa o tema geral da prova
function temaQ(p, i) {
  return p.temas[i] || p.tema || 'Sem tema';
}

// Quantas questões o aluno acertou na prova
function acertos(p, a) {
  return (p.res[a] || []).filter(Boolean).length;
}

// % de alunos que acertaram a questão "i"
function pctQ(p, t, i) {
  if (!t.alunos.length) return 0;

  let c = t.alunos.filter(function (a) {
    return p.res[a.id] && p.res[a.id][i];
  }).length;

  return Math.round(c / t.alunos.length * 100);
}
// Média da turma em uma prova
function mediaProva(t, p) {
  if (!t.alunos.length) return 0;

  let soma = t.alunos.reduce(function (s, a) {
    return s + acertos(p, a.id);
  }, 0);

  return soma / t.alunos.length;
}

// % de acerto por tema em uma prova, ex.: { Álgebra: 44, Equações: 100 }
function temasProva(t, p) {
  let g = {};

  for (let i = 0; i < 10; i++) {
    let tm = temaQ(p, i);              // usa o subtópico ou o tema geral
    if (!g[tm]) g[tm] = [];
    g[tm].push(pctQ(p, t, i));
  }

  let r = {};
  Object.keys(g).forEach(function (k) {
    let soma = g[k].reduce(function (x, y) { return x + y; }, 0);
    r[k] = Math.round(soma / g[k].length);
  });
  return r;
}

// Agrupa as provas da turma por matéria
function agruparPorMateria(t) {
  let grupos = {};

  t.provas.forEach(function (p) {
    if (!p.tema) return;                        // prova antiga, sem matéria
    let chave = p.tema.trim().toLowerCase();    // "Matemática" e "matemática" = mesma
    if (!grupos[chave]) grupos[chave] = { nome: p.tema.trim(), provas: [] };
    grupos[chave].provas.push(p);
  });

  return Object.keys(grupos).map(function (k) {
    return grupos[k];
  });
}

// Seta de evolução (▲ subiu, ▼ caiu)
function seta(atual, anterior) {
  if (anterior === undefined) return '';
  if (atual > anterior) return ' <span style="color:var(--ok)">▲</span>';
  if (atual < anterior) return ' <span style="color:var(--bad)">▼</span>';
  return ' <span class="mu">=</span>';
}

/* ---------- 5. Ranking (classificação) ---------- */

function ranking(t, p) {
  let l = t.alunos
    .map(function (a) { return { nome: a.nome, n: acertos(p, a.id) }; })
    .sort(function (a, b) { return b.n - a.n; });   // maior nota primeiro

  l.forEach(function (x, i) {
    // empate: mesma posição do aluno anterior
    x.pos = (i > 0 && x.n === l[i - 1].n) ? l[i - 1].pos : i + 1;
  });
  return l;
}

function faixa(n) {
  return n >= 9 ? 'Excelente' : n >= 7 ? 'Bom' : n >= 6 ? 'Regular' : 'reprovação';
}

/* ---------- 6. TELAS (geram o HTML) ---------- */

// Aba "Análise": visão da turma + temas + visão individual
function viewAnalise(t, p) {
  if (!t.alunos.length) {
    return '<p class="mu">Cadastre alunos para ver a análise.</p>';
  }

  // --- barras de % por questão ---
  let q = '', i, temas = {};

  for (i = 0; i < 10; i++) {
    let pc = pctQ(p, t, i);
    let tm = temaQ(p, i);

    q += '<div class="q">' +
           '<div><b>Questão ' + (i + 1) + '</b><small>' + esc(tm) + '</small></div>' +
           '<div class="bar"><i style="width:' + pc + '%;background:' + cor(pc) + '"></i></div>' +
           '<b>' + pc + '%</b>' +
         '</div>';

    // agrupa as porcentagens por tema
    if (!temas[tm]) temas[tm] = [];
    temas[tm].push(pc);
  }

  // --- média por tema, do mais fraco ao mais forte ---
  let tl = Object.keys(temas).map(function (k) {
    let a = temas[k];
    let soma = a.reduce(function (x, y) { return x + y; }, 0);
    return { k: k, v: Math.round(soma / a.length) };
  }).sort(function (a, b) {
    return a.v - b.v;
  });

  let th = tl.map(function (x) {
    return '<tr>' +
             '<td>' + esc(x.k) + '</td>' +
             '<td style="color:' + cor(x.v) + '"><b>' + x.v + '%</b></td>' +
           '</tr>';
  }).join('');

  // --- cartões individuais ---
  let al = t.alunos.map(function (a) {
    let n = acertos(p, a.id);
    return '<div class="al">' +
             '<b>' + esc(a.nome) + '</b>' +
             '<div>Acertos: ' + n + '/10</div>' +
             '<div class="mu">Nota: ' + fmt(n) + '</div>' +
           '</div>';
  }).join('');

  // --- média da turma ---
  let med = t.alunos.reduce(function (s, a) {
    return s + acertos(p, a.id);
  }, 0) / t.alunos.length;

  return '<button class="p" onclick="window.print()">🖨️ Exportar relatório (PDF)</button>' +
       '<div id="relatorio">' +
         '<h1 class="so-print">Relatório – ' + esc(t.nome) + ' · ' + esc(p.nome) +
           ' <small>(' + new Date().toLocaleDateString('pt-BR') + ')</small></h1>' +
         '<h2>Visão da turma</h2>' + q +
         '<p class="mu">Média da turma: <b>' + fmt(med) + '</b></p>' +
         '<h2 style="margin-top:18px">Desempenho por tema ' +
           '<span class="mu">(do mais fraco ao mais forte)</span></h2>' +
         '<table>' + th + '</table>' +
         viewRanking(t, p) +
         '<h2 style="margin-top:18px">Visão individual</h2>' +
         '<div class="grid">' + al + '</div>' +
       '</div>';
}

// Aba "Resultados": tabela de checkboxes (aluno x questão)
function viewResultados(t, p) {
  if (!t.alunos.length) {
    return '<p class="mu">Cadastre alunos primeiro.</p>';
  }

  // cabeçalho da tabela
  let h = '<tr><th>Aluno</th>';
  for (let i = 0; i < 10; i++) {
    h += '<th>Q' + (i + 1) + '</th>';
  }
  h += '<th>Total</th></tr>';

  // uma linha por aluno
  t.alunos.forEach(function (a) {
    let r = p.res[a.id] || [];

    h += '<tr><td>' + esc(a.nome) + '</td>';
    for (let i = 0; i < 10; i++) {
      h += '<td class="cel"><label class="chk">' +
       '<input type="checkbox" ' + (r[i] ? 'checked' : '') +
         ' onchange="setRes(\'' + a.id + '\',' + i + ',this.checked)">' +
     '</label></td>';
    }
    h += '<td>' + acertos(p, a.id) + '/10</td></tr>';
  });

  return '<p class="mu">Marque as questões que cada aluno acertou e abra a aba Análise.</p>' +
         '<div class="scroll"><table>' + h + '</table></div>';
}

// Aba "Questões e temas": 10 campos de texto
function viewTemas(p) {
  let h = '';

  for (let i = 0; i < 10; i++) {
    h += '<div class="row" style="margin-bottom:6px">' +
           '<span style="width:90px">Questão ' + (i + 1) + '</span>' +
           '<input value="' + esc(p.temas[i]) + '" placeholder="Tema (ex.: Frações)" ' +
                  'onchange="setTema(' + i + ',this.value)">' +
         '</div>';
  }

  return h;
}

// Tabela comparando as provas da turma
function viewComparar(t, provas) {
  let dados = provas.map(function (p) {
    return { nome: p.nome, media: mediaProva(t, p), temas: temasProva(t, p) };
  });

  // lista de todos os temas que apareceram em alguma prova
  let todos = [];
  dados.forEach(function (d) {
    Object.keys(d.temas).forEach(function (k) {
      if (todos.indexOf(k) < 0) todos.push(k);
    });
  });

  // cabeçalho
  let h = '<tr><th></th>' + dados.map(function (d) {
    return '<th>' + esc(d.nome) + '</th>';
  }).join('') + '</tr>';

  // linha da média
  h += '<tr><td><b>Média da turma</b></td>' + dados.map(function (d, i) {
    let ant = i > 0 ? dados[i - 1].media : undefined;
    return '<td><b>' + fmt(d.media) + '</b>' + seta(d.media, ant) + '</td>';
  }).join('') + '</tr>';

  // uma linha por tema
  todos.forEach(function (tema) {
    h += '<tr><td>' + esc(tema) + '</td>';

    dados.forEach(function (d, i) {
      let v = d.temas[tema];
      if (v === undefined) {                 // tema não caiu nessa prova
        h += '<td class="mu">–</td>';
        return;
      }
      let ant = i > 0 ? dados[i - 1].temas[tema] : undefined;
      h += '<td style="color:' + cor(v) + '">' + v + '%' + seta(v, ant) + '</td>';
    });

    h += '</tr>';
  });

  return '<table>' + h + '</table>';
}

// Cartão da prova selecionada (com as 3 sub-abas)
function viewProva(t, p) {
  let s = ['temas', 'resultados', 'analise'];
  let n = { temas: 'Questões e temas', resultados: 'Resultados', analise: 'Análise' };

  let tb = s.map(function (k) {
    return '<button class="' + (U.sub === k ? 'on' : '') + '" onclick="sub(\'' + k + '\')">' +
             n[k] +
           '</button>';
  }).join('');

  let body;
  if (U.sub === 'temas') body = viewTemas(p);
  else if (U.sub === 'resultados') body = viewResultados(t, p);
  else body = viewAnalise(t, p);

  return '<div class="card">' +
           '<div class="row" style="justify-content:space-between">' +
             '<h2>' + esc(p.nome) + '</h2>' +
             '<button class="x" onclick="delProva()">Excluir prova</button>' +
           '</div>' +
           '<div class="tabs">' + tb + '</div>' +
           body +
         '</div>';
}

// Aba "Ranking": tabela de classificação (aluno x nota)
function viewRanking(t, p) {
  let medalha = ['🥇', '🥈', '🥉'];
  let linhas = ranking(t, p).map(function (x) {
    return '<tr>' +
      '<td>' + (medalha[x.pos - 1] || x.pos + 'º') + '</td>' +
      '<td>' + esc(x.nome) + '</td>' +
      '<td>' + fmt(x.n) + '</td>' +
      '<td style="color:' + (x.n < 6 ? 'var(--bad)' : cor(x.n * 10)) + '"><b>' + faixa(x.n) + '</b></td>' +
      '</tr>';
  }).join('');

  return '<h2 style="margin-top:18px">Classificação</h2>' +
    '<table><tr><th>#</th><th>Aluno</th><th>Nota</th><th>Faixa</th></tr>' + linhas + '</table>';
}

/* ---------- 7. DESENHA A PÁGINA ---------- */

function render() {
  let app = document.getElementById('app');
  let t = T();

  // --- bloco de turmas (sempre aparece) ---
  let h = '<div class="card"><h2>Turmas</h2>' +
            '<div class="tabs">' +
              S.turmas.map(function (x) {
                return '<button class="' + (x.id === U.t ? 'on' : '') + '" ' +
                         'onclick="selTurma(\'' + x.id + '\')">' + esc(x.nome) + '</button>';
              }).join('') +
            '</div>' +
            '<div class="row">' +
              '<input id="nt" placeholder="Nova turma (ex.: 8º A)">' +
              '<button class="p" onclick="addTurma()">Criar turma</button>' +
            '</div>' +
          '</div>';

  // nenhuma turma selecionada: para por aqui
  if (!t) {
    app.innerHTML = h + '<p class="mu">Crie ou selecione uma turma para começar.</p>';
    return;
  }

  // --- abas Alunos / Provas ---
  h += '<div class="tabs">' +
         '<button class="' + (U.tab === 'alunos' ? 'on' : '') + '" onclick="tab(\'alunos\')">' +
           'Alunos (' + t.alunos.length + ')</button>' +
         '<button class="' + (U.tab === 'provas' ? 'on' : '') + '" onclick="tab(\'provas\')">' +
           'Provas (' + t.provas.length + ')</button>' +
         '<button class="x" onclick="delTurma()">Excluir turma</button>' +
       '</div>';

  if (U.tab === 'alunos') {
    // --- lista de alunos ---
    h += '<div class="card">' +
           '<div class="row">' +
             '<input id="na" placeholder="Nome do aluno" onkeydown="if(event.key===\'Enter\')addAluno()">' +
             '<button class="p" onclick="addAluno()">Adicionar</button>' +
           '</div>' +
           '<table>' +
             t.alunos.map(function (a) {
               return '<tr>' +
                        '<td>' + esc(a.nome) + '</td>' +
                        '<td style="text-align:right">' +
                          '<button class="x" onclick="delAluno(\'' + a.id + '\')">✕</button>' +
                        '</td>' +
                      '</tr>';
             }).join('') +
           '</table>' +
         '</div>';
  } else {
    // --- lista de provas + prova selecionada ---
    h += '<div class="card">' +
           '<div class="tabs">' +
             t.provas.map(function (x) {
               return '<button class="' + (x.id === U.p ? 'on' : '') + '" ' +
                        'onclick="selProva(\'' + x.id + '\')">' + esc(x.nome) + '</button>';
             }).join('') +
           '</div>' +
           '<div class="row">' +
             '<input id="np" placeholder="Nome da prova (ex.: Prova 1)">' +
              '<input id="ng" placeholder="Matéria (ex.: Matemática)">' +
            '<button class="p" onclick="addProva()">Criar prova</button>' +
           '</div>' +
         '</div>';

        let p = P();
    if (p) h += viewProva(t, p);

        // comparação entre provas: um cartão por matéria (só com 2 ou mais provas)
    agruparPorMateria(t).forEach(function (g) {
      if (g.provas.length >= 2) {
        h += '<div class="card"><h2>Evolução em ' + esc(g.nome) + '</h2>' +
             '<div class="scroll">' + viewComparar(t, g.provas) + '</div></div>';
      }
    });
  }
    
  app.innerHTML = h;
}

// Primeira vez que a página abre
render();
