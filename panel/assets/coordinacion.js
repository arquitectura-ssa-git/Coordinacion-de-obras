// Coordinación: evaluación mensual de los DT (30 controles en 8 bloques), desvíos y compras.
// Los datos salen del JSON que exporta la app "Coordinación de Obras" (coordinacion-obras-datos.json o el
// export completo, que los trae en "datos"). Se importan desde el panel y quedan solo en este navegador.
// Rutas: #coord[.resumen] · #coord.controles.<obra> · #coord.desvios · #coord.compras · #coord.datos
window.Coord = (() => {
  const P = window.Panel;
  const esc = P.esc;
  const CLAVE = 'panel.coord1';

  const ITEMS = [
    [1, 'PLANIFICACION', 'Cumplimiento de hitos mensuales', 'QUINCENAL'],
    [2, 'PLANIFICACION', 'Gantt actualizado', 'MENSUAL'],
    [3, 'PLANIFICACION', 'Planificación y seguimiento semanal (minuta semanal)', 'SEMANAL'],
    [4, 'PLANIFICACION', 'Detección temprana de desvíos', 'EVENTUAL'],
    [5, 'PLANIFICACION', 'Plan de acción ante desvíos', 'EVENTUAL'],
    [6, 'COORDINACION', 'Coordinación de gremios y contratistas', 'SEMANAL'],
    [7, 'COORDINACION', 'Coordinación de tareas entre rubros', 'SEMANAL'],
    [8, 'COORDINACION', 'Seguimiento de pendientes', 'SEMANAL'],
    [9, 'COORDINACION', 'Resolución y seguimiento de interferencias', 'SEMANAL'],
    [10, 'DOCUMENTACION', 'Documentación técnica disponible y actualizada (apto obra)', 'SEMANAL'],
    [11, 'DOCUMENTACION', 'Actualización de documentación de obra', 'SEMANAL'],
    [12, 'DOCUMENTACION', 'Permisos municipales y administrativos de obra', 'SEMANAL'],
    [13, 'DOCUMENTACION', 'Gestión de documentación técnica', 'SEMANAL'],
    [14, 'DOCUMENTACION', 'Libro de órdenes de servicio / notas de pedido', 'SEMANAL'],
    [15, 'MATERIALES', 'Gestión y cierre de requerimientos de compras', 'SEMANAL'],
    [16, 'MATERIALES', 'Previsión y pedido de materiales', 'SEMANAL'],
    [17, 'MATERIALES', 'Recepción, stock y faltantes de materiales', 'SEMANAL'],
    [18, 'MATERIALES', 'Control de calidad de materiales', 'SEMANAL'],
    [19, 'MATERIALES', 'Verificación de cómputos de materiales de contratistas', 'SEMANAL'],
    [20, 'CALIDAD', 'Control de calidad de ejecución de trabajos', 'SEMANAL'],
    [21, 'CALIDAD', 'Detección y prevención de retrabajos', 'SEMANAL'],
    [22, 'CALIDAD', 'Recepción de trabajos ejecutados', 'SEMANAL'],
    [23, 'HyS. Y OBRA', 'Layout de obra (acceso, descargas, acopio, baños)', 'MENSUAL'],
    [24, 'HyS. Y OBRA', 'Control de HyS (EPP, orden y limpieza, altura, riesgo eléctrico)', 'SEMANAL'],
    [25, 'ADMINISTRACION', 'Medición de certificados quincenales del contratista', 'QUINCENAL'],
    [26, 'ADMINISTRACION', 'Gestión de cambios y adicionales', 'EVENTUAL'],
    [27, 'ADMINISTRACION', 'Medición de certificados mensuales para el cliente', 'MENSUAL'],
    [28, 'REPORTING', 'Informes diarios internos', 'DIARIO'],
    [29, 'REPORTING', 'Informe semanal para el cliente', 'SEMANAL'],
    [30, 'REPORTING', 'Informe fotográfico y de avance mensual para el cliente', 'MENSUAL'],
  ].map(([n, b, t, fr]) => ({ n, b, t, fr }));
  const BLOQUES = [['PLANIFICACION', 'Planificación'], ['COORDINACION', 'Coordinación'], ['DOCUMENTACION', 'Documentación'], ['MATERIALES', 'Materiales'],
    ['CALIDAD', 'Calidad'], ['HyS. Y OBRA', 'HyS y obra'], ['ADMINISTRACION', 'Administración'], ['REPORTING', 'Reporting']];
  const TABS = [['resumen', 'Resumen del mes'], ['controles', 'Controles por obra'], ['desvios', 'Desvíos'], ['compras', 'Compras'], ['datos', 'Datos']];

  let S = null;            // datos importados
  let per = null;          // mes elegido, AAAA-MM
  const filtro = { obra: '', estado: 'abiertos' };

  // ---------- datos ----------
  function normalizar(x) {
    const d = x && x.datos && x.datos.checks ? x.datos : x;
    if (!d || !Array.isArray(d.obras) || !d.checks || typeof d.checks !== 'object') return null;
    return Object.assign({ cfg: { meta: 0.8, alerta: 0.6, w: {} }, dts: [], inf: {}, desvios: [], compras: [], obsDT: {} }, d);
  }
  function cargar() {
    if (S === null) S = normalizar(P.local.leer(CLAVE));
    return S;
  }
  function guardar() { P.local.escribir(CLAVE, S); }
  const meses = () => [...new Set(Object.keys(S.checks).map(k => k.split('|')[1]))].sort();
  const mesAnt = p => { const [y, m] = p.split('-').map(Number); const t = y * 12 + m - 2; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
  const hoy = () => P.iso(new Date());

  // ---------- cálculos (los mismos de la app "Coordinación de Obras") ----------
  function semanaIso(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  }
  // Las semanas del mes son las que arrancan en un lunes de ese mes.
  function semanas(p) {
    const [y, m] = p.split('-').map(Number);
    const out = [];
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
      const f = new Date(y, m - 1, d);
      if (f.getDay() === 1) {
        const fin = new Date(y, m - 1, d + 6);
        out.push({ n: semanaIso(f), txt: `${d}–${fin.getDate()}${fin.getMonth() !== m - 1 ? '/' + (fin.getMonth() + 1) : ''}` });
      }
    }
    return out;
  }
  const aplica = (it, wi) => (it.fr === 'QUINCENAL' ? wi % 2 === 0 : it.fr === 'MENSUAL' ? wi === 0 : true);
  const prom = a => { a = a.filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };

  // Conformidad = promedio de los bloques con datos, ponderado por el peso de cada bloque.
  function puntaje(obra, p) {
    const ck = (S.checks[`${obra}|${p}`] || {}).i || {};
    const W = semanas(p);
    const bl = Object.fromEntries(BLOQUES.map(([k]) => [k, { cap: 0, ev: 0, ok: 0, pct: null }]));
    ITEMS.forEach(it => {
      const fila = ck[it.n] || [];
      W.forEach((_, wi) => {
        if (aplica(it, wi)) bl[it.b].cap++;
        const v = fila[wi];
        if (v === 0 || v === 1) { bl[it.b].ev++; bl[it.b].ok += v; }
      });
    });
    let sw = 0, sp = 0, cap = 0, ev = 0;
    BLOQUES.forEach(([k]) => {
      const b = bl[k];
      b.pct = b.ev ? b.ok / b.ev : null;
      cap += b.cap; ev += b.ev;
      const w = S.cfg.w[k] ?? 0;
      if (b.pct !== null) { sw += w; sp += w * b.pct; }
    });
    return { bl, pct: sw ? sp / sw : null, carga: cap ? Math.min(1, ev / cap) : 0, ev };
  }
  const nivel = p => (p == null ? '' : p >= S.cfg.meta ? 'verde' : p >= S.cfg.alerta ? 'amarillo' : 'rojo');
  const NOMBRE = { verde: 'Conforme', amarillo: 'En alerta', rojo: 'No conforme', '': 'Sin datos' };
  const vencido = d => d.estado !== 'cerrado' && d.fechaPA && d.fechaPA < hoy();
  const dias = (a, b) => P.dias(a, b);
  function compra(c) {
    return {
      ciclo: c.fin ? dias(c.inicio, c.fin) : null,
      transc: !c.fin && c.inicio ? dias(c.inicio, hoy()) : null,
      ex: c.entregados != null && c.pedidos ? c.entregados / c.pedidos : null,
      ah: c.pIni && c.pCompra ? (c.pIni - c.pCompra) / c.pIni : null,
    };
  }
  const activas = () => S.obras.filter(o => o.activa);
  const nombreDt = id => (S.dts.find(d => d.id === id) || {}).nombre || id;
  const nombreObra = id => (S.obras.find(o => o.id === id) || {}).nombre || id;
  const abiertos = obra => S.desvios.filter(d => d.estado !== 'cerrado' && (!obra || d.obra === obra));

  function faltantes(obra, p) {
    const c = S.checks[`${obra}|${p}`];
    const sc = puntaje(obra, p);
    if (!c || !sc.ev) return ['Sin controles cargados'];
    const g = [];
    if (sc.carga < 0.999) g.push(`Falta cargar ${Math.round((1 - sc.carga) * 100)} % de los controles`);
    const sinObs = ITEMS.filter(it => (c.i[it.n] || []).includes(0) && !(c.o && c.o[it.n]));
    if (sinObs.length) g.push(`${sinObs.length} control${sinObs.length > 1 ? 'es' : ''} no cumplido${sinObs.length > 1 ? 's' : ''} sin observación`);
    const inf = S.inf[`${obra}|${p}`] || {};
    const conTexto = Object.values(inf.txt || {}).some(t => (t.dt || '').trim() || (t.obra || '').trim()) || Object.keys(c.o || {}).length;
    if (!conTexto) g.push('Informe del mes vacío');
    return g;
  }

  function revisarDesvio(d) {
    const r = [];
    if (!d.resp) r.push('sin responsable');
    if (!d.plan) r.push('sin plan de acción');
    if (d.fechaPA && d.fecha && d.fechaPA < d.fecha) r.push('fecha del plan anterior al desvío');
    if (vencido(d)) r.push(`plan vencido el ${P.fecha(d.fechaPA)}`);
    return r;
  }

  // ---------- piezas ----------
  const pc = p => (p == null ? '—' : `${Math.round(p * 100)} %`);
  const sem = (niv, txt) => `<span class="sem ${niv}">${esc(txt)}</span>`;
  const barra = p => `<span class="mini-barra" title="Meta ${pc(S.cfg.meta)}"><span class="pista"><span class="real ${nivel(p)}" style="width:${p == null ? 0 : Math.round(p * 100)}%"></span><span class="prev" style="left:${S.cfg.meta * 100}%"></span></span>${pc(p)}</span>`;
  const td = (v, n) => `<td class="${n ? 'n' : ''}">${v}</td>`;
  const tabla = (cols, filas, vacio = 'Sin registros.') => (filas.length
    ? `<div class="desliza"><table class="tabla"><thead><tr>${cols.map(c => `<th class="${c.n ? 'n' : ''}">${c.t}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`
    : `<p class="vacio">${vacio}</p>`);
  const tonoEstado = e => ({ abierto: 'warn', 'en curso': 'acc', cerrado: 'ok' }[e] || '');
  const tonoPrio = p => ({ crítico: 'bad', urgente: 'bad', alta: 'warn' }[p] || '');
  const etq = (t, tono) => `<span class="etiqueta ${tono}">${esc(t || '—')}</span>`;
  const selMes = () => `<select id="c-mes" aria-label="Mes">${meses().map(m => `<option value="${m}" ${m === per ? 'selected' : ''}>${esc(P.mes(m))}</option>`).join('')}</select>`;

  function nivelDesvio(d) {
    const fuerte = d.prio === 'crítico' || d.prio === 'urgente';
    if (vencido(d) && fuerte) return 'critico';
    if (vencido(d) || d.prio === 'crítico') return 'rojo';
    return 'amarillo';
  }
  function desvioHTML(d) {
    const meta = [nombreObra(d.obra), d.tipo, d.resp ? `resp. ${d.resp}` : 'sin responsable', `desde ${P.fecha(d.fecha)}`].filter(Boolean).join(' · ');
    const niv = nivelDesvio(d);
    return `<div class="alerta ${niv}"><span class="franja"></span>
      <div class="txt"><b>${esc(d.evento)}</b><span>${esc(d.plan || 'Sin plan de acción')}</span><div class="chip">${esc(meta)}</div></div>
      <div class="acc">${vencido(d) ? etq(`vencido ${P.fecha(d.fechaPA)}`, 'bad') : d.fechaPA ? etq(`plan ${P.fecha(d.fechaPA)}`, '') : ''}${etq(d.prio || 'normal', tonoPrio(d.prio))}</div></div>`;
  }

  // ---------- vistas ----------
  function resumen() {
    const os = activas();
    const filas = os.map(o => ({ o, sc: puntaje(o.id, per), ds: abiertos(o.id) })).sort((a, b) => (a.sc.pct ?? 2) - (b.sc.pct ?? 2));
    const conDatos = filas.filter(f => f.sc.pct != null);
    const media = prom(conDatos.map(f => f.sc.pct));
    const ab = abiertos().filter(d => os.some(o => o.id === d.obra));
    const exact = prom(S.compras.map(c => compra(c).ex));
    const mesTxt = P.mes(per);

    const tablaObras = tabla([{ t: 'Obra' }, { t: 'DT' }, { t: 'Conformidad' }, { t: 'Carga', n: 1 }, { t: 'Bloque más bajo' }, { t: 'Desvíos abiertos', n: 1 }, { t: 'Estado' }],
      filas.map(({ o, sc, ds }) => {
        let bajo = null;
        BLOQUES.forEach(([k, n]) => { const p = sc.bl[k].pct; if (p != null && (!bajo || p < bajo.p)) bajo = { p, n }; });
        const venc = ds.filter(vencido).length;
        return `<tr>${td(`<a href="#coord.controles.${esc(o.id)}"><b>${esc(o.nombre)}</b></a><div class="muted chico">${esc(o.id)}</div>`)}${td(o.dts.map(nombreDt).map(esc).join('<br>') || '—')}${td(barra(sc.pct))}${td(pc(sc.carga), 1)}${td(bajo ? `${esc(bajo.n)} ${pc(bajo.p)}` : '—')}${td(`${ds.length}${venc ? ` ${etq(`${venc} vencido${venc > 1 ? 's' : ''}`, 'bad')}` : ''}`, 1)}${td(sem(nivel(sc.pct), NOMBRE[nivel(sc.pct)]))}</tr>`;
      }));

    const mapa = `<div class="desliza"><table class="matriz"><thead><tr><th class="obra">Obra</th>${BLOQUES.map(([, n]) => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${filas.map(({ o, sc }) =>
      `<tr><td class="obra"><a href="#coord.controles.${esc(o.id)}">${esc(o.nombre)}</a><small>${esc(o.id)}</small></td>${BLOQUES.map(([k]) => { const p = sc.bl[k].pct; return `<td><span class="sem solo ${nivel(p)}">${p == null ? '—' : Math.round(p * 100)}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;

    const dts = S.dts.map(d => {
      const os2 = os.filter(o => o.dts.includes(d.id));
      const pct = prom(os2.map(o => puntaje(o.id, per).pct));
      const prev = prom(os2.map(o => puntaje(o.id, mesAnt(per)).pct));
      const ds = S.desvios.filter(x => os2.some(o => o.id === x.obra) && x.estado !== 'cerrado');
      return { d, os2, pct, prev, ds };
    }).sort((a, b) => (a.pct ?? 2) - (b.pct ?? 2));
    const obs = S.obsDT[per] || {};
    const tablaDts = tabla([{ t: 'DT' }, { t: 'Obras' }, { t: 'Conformidad' }, { t: 'vs mes anterior', n: 1 }, { t: 'Desvíos abiertos', n: 1 }, { t: 'Estado' }, { t: 'Observación' }],
      dts.map(({ d, os2, pct, prev, ds }) => {
        const dif = pct != null && prev != null ? Math.round((pct - prev) * 100) : null;
        return `<tr>${td(`<b>${esc(d.nombre)}</b>`)}${td(os2.map(o => `<a href="#coord.controles.${esc(o.id)}">${esc(o.id)}</a>`).join(' · ') || '—')}${td(barra(pct))}${td(dif == null ? '—' : `${dif > 0 ? '+' : ''}${dif} pp`, 1)}${td(`${ds.length}${ds.filter(vencido).length ? ` ${etq(`${ds.filter(vencido).length} venc.`, 'bad')}` : ''}`, 1)}${td(sem(nivel(pct), NOMBRE[nivel(pct)]))}${td(`<span class="muted chico">${esc(obs[d.id] || '')}</span>`)}</tr>`;
      }));

    const urg = ab.filter(d => vencido(d) || d.prio === 'urgente' || d.prio === 'crítico')
      .sort((a, b) => ['critico', 'rojo', 'amarillo'].indexOf(nivelDesvio(a)) - ['critico', 'rojo', 'amarillo'].indexOf(nivelDesvio(b)) || (a.fechaPA || '9').localeCompare(b.fechaPA || '9'));
    const falta = os.map(o => ({ o, g: faltantes(o.id, per) })).filter(x => x.g.length);

    return `<div class="kpis">
        <div class="kpi ${nivel(media) === 'rojo' ? 'rojo' : nivel(media) === 'amarillo' ? 'amarillo' : ''}"><b>${pc(media)}</b><span>Conformidad media · meta ${pc(S.cfg.meta)}</span></div>
        <div class="kpi ${conDatos.some(f => f.sc.pct < S.cfg.alerta) ? 'rojo' : ''}"><b>${conDatos.filter(f => f.sc.pct < S.cfg.meta).length}</b><span>Obras bajo la meta (${conDatos.filter(f => f.sc.pct < S.cfg.alerta).length} no conformes)</span></div>
        <div class="kpi ${ab.some(vencido) ? 'rojo' : ''}"><b>${ab.length}</b><span>Desvíos abiertos · ${ab.filter(vencido).length} con plan vencido</span></div>
        <div class="kpi"><b>${pc(exact)}</b><span>Exactitud de compras (meta 95 %)</span></div>
      </div>
      <section class="card" style="margin-bottom:14px"><h2>Conformidad por obra · ${esc(mesTxt)}</h2>
        <p class="muted chico" style="margin-top:-6px">De la más baja a la más alta. La rayita marca la meta. Carga: qué parte de los controles del mes ya está marcada.</p>${tablaObras}</section>
      <section class="card" style="margin-bottom:14px"><h2>Mapa por bloque (% cumplido)</h2>${mapa}
        <div class="leyenda">${sem('verde', `${pc(S.cfg.meta)} o más`)} ${sem('amarillo', `${pc(S.cfg.alerta)} a ${pc(S.cfg.meta)}`)} ${sem('rojo', `menos de ${pc(S.cfg.alerta)}`)}</div></section>
      <div style="margin-bottom:14px">
        <section class="card"><h2>Qué falta completar</h2>${falta.length ? `<div class="pila" style="gap:8px">${falta.map(x => `<div class="fila-dato"><a href="#coord.controles.${esc(x.o.id)}">${esc(x.o.nombre)}</a><span style="text-align:right">${x.g.map(t => etq(t, 'warn')).join(' ')}</span></div>`).join('')}</div>` : '<p class="vacio">Todo completo.</p>'}</section>
      </div>
      <section class="card" style="margin-bottom:14px"><h2>Desempeño de los DT · ${esc(mesTxt)}</h2>
        <p class="muted chico" style="margin-top:-6px">Promedio de las obras que dirige cada DT. Carletto la comparten dos DT: cuenta para ambos.</p>${tablaDts}
        ${obs._gral ? `<p class="chico" style="margin:10px 0 0"><b>Observación general:</b> ${esc(obs._gral)}</p>` : ''}</section>
      <section class="pila"><h2 class="rotulo" style="margin:8px 0 0">Desvíos para resolver primero (${urg.length})</h2>
        <div class="alertas">${urg.map(desvioHTML).join('') || '<p class="vacio">Nada vencido ni urgente.</p>'}</div></section>`;
  }

  function controles(obraId) {
    const o = S.obras.find(x => x.id === obraId) || activas()[0];
    const W = semanas(per);
    const c = S.checks[`${o.id}|${per}`] || { i: {}, o: {}, d: {} };
    const sc = puntaje(o.id, per);
    const sel = `<select id="c-obra" aria-label="Obra">${S.obras.map(x => `<option value="${esc(x.id)}" ${x.id === o.id ? 'selected' : ''}>${esc(x.nombre)}${x.activa ? '' : ' (finalizada)'}</option>`).join('')}</select>`;
    const filas = BLOQUES.map(([k, n]) => {
      const p = sc.bl[k].pct;
      const cab = `<tr class="bloque"><td colspan="${W.length + 3}"><b>${esc(n)}</b> ${sem(nivel(p), pc(p))} <span class="muted chico">peso ${pc(S.cfg.w[k])}</span></td></tr>`;
      return cab + ITEMS.filter(it => it.b === k).map(it => {
        const fila = c.i[it.n] || [];
        const celdas = W.map((_, wi) => {
          const v = fila[wi];
          const corresponde = aplica(it, wi) || v === 0 || v === 1;
          const txt = v === 1 ? '✓' : v === 0 ? '✗' : corresponde ? '·' : '–';
          return `<td class="ck"><button class="celda ${v === 1 ? 'si' : v === 0 ? 'no' : ''}" data-celda="${it.n}|${wi}" data-obra="${esc(o.id)}" ${corresponde ? '' : 'disabled'} aria-label="${esc(it.t)}, semana ${W[wi].n}: ${v === 1 ? 'cumple' : v === 0 ? 'no cumple' : 'sin marcar'}">${txt}</button></td>`;
        }).join('');
        const ob = (c.o || {})[it.n];
        const a = ((c.d || {})[it.n]) || 'dt';
        return `<tr><td>${esc(it.t)}</td><td class="muted chico">${esc(it.fr.toLowerCase())}</td>${celdas}<td>${ob ? `${etq(a === 'obra' ? 'Obra' : 'DT', a === 'obra' ? 'acc' : '')} ${esc(ob)}` : ''}</td></tr>`;
      }).join('');
    }).join('');

    const inf = S.inf[`${o.id}|${per}`] || {};
    const informe = BLOQUES.map(([k, n]) => {
      const man = (inf.txt || {})[k] || {};
      const auto = dest => ITEMS.filter(it => it.b === k && (c.o || {})[it.n] && (((c.d || {})[it.n]) || 'dt') === dest).map(it => c.o[it.n])
        .filter(t => t.trim().length > 1 && !(man[dest] || '').toLowerCase().includes(t.toLowerCase()));
      const dt = [man.dt, ...auto('dt')].filter(t => t && t.trim());
      const ob = [man.obra, ...auto('obra')].filter(t => t && t.trim());
      if (!dt.length && !ob.length) return '';
      return `<tr>${td(`<b>${esc(n)}</b>`)}${td(dt.map(esc).join('<br>') || '<span class="muted">—</span>')}${td(ob.map(esc).join('<br>') || '<span class="muted">—</span>')}</tr>`;
    }).filter(Boolean);

    return `<div class="filtros">${sel}</div>
      <div class="ficha-cab">
        <div class="dato"><span>Conformidad ${esc(P.mes(per))}</span><b>${pc(sc.pct)}</b> ${sem(nivel(sc.pct), NOMBRE[nivel(sc.pct)])}</div>
        <div class="dato"><span>DT</span><b>${o.dts.map(nombreDt).map(esc).join(' y ') || '—'}</b></div>
        <div class="dato"><span>Carga del mes</span><b>${pc(sc.carga)}</b> <small>de los controles que corresponden</small></div>
        <div class="dato"><span>Desvíos abiertos</span><b>${abiertos(o.id).length}</b> <small>${abiertos(o.id).filter(vencido).length} con plan vencido</small></div>
      </div>
      <section class="card" style="margin-bottom:14px"><h2>Controles semanales · ${esc(P.mes(per))}</h2>
        <p class="muted chico" style="margin-top:-6px">Tocá una celda para cambiarla: sin marcar → ✓ cumple → ✗ no cumple. Las celdas con guion no corresponden esa semana por la frecuencia del control. Los cambios quedan en este navegador.</p>
        <div class="desliza"><table class="tabla controles"><thead><tr><th>Control</th><th>Frec.</th>${W.map(w => `<th class="ck">S${w.n}<div class="muted" style="text-transform:none;font-weight:500">${esc(w.txt)}</div></th>`).join('')}<th>Observación</th></tr></thead><tbody>${filas}</tbody></table></div></section>
      <section class="card"><h2>Informe del mes</h2>
        <p class="muted chico" style="margin-top:-6px">Junta el texto del informe con las observaciones de los controles, separadas según se refieran a la DT o a la obra.</p>
        ${tabla([{ t: 'Bloque' }, { t: 'Referido a la DT' }, { t: 'Referido a la obra o proyecto' }], informe, 'Sin observaciones para este mes.')}</section>`;
  }

  function desvios() {
    const lista = S.desvios.filter(d => (!filtro.obra || d.obra === filtro.obra)
      && (filtro.estado === 'todos' || (filtro.estado === 'abiertos' ? d.estado !== 'cerrado' : d.estado === filtro.estado)))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const ab = S.desvios.filter(d => d.estado !== 'cerrado');
    const impacto = S.desvios.reduce((s, d) => s + (d.impDias || 0), 0);
    const rev = S.desvios.map(d => ({ d, r: revisarDesvio(d).filter(x => !x.startsWith('plan vencido')) })).filter(x => x.r.length);
    const op = (l, v) => l.map(([k, t]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`).join('');
    return `<div class="kpis">
        <div class="kpi"><b>${S.desvios.length}</b><span>Desvíos registrados</span></div>
        <div class="kpi amarillo"><b>${ab.length}</b><span>Abiertos o en curso</span></div>
        <div class="kpi ${ab.some(vencido) ? 'rojo' : ''}"><b>${ab.filter(vencido).length}</b><span>Con plan de acción vencido</span></div>
        <div class="kpi"><b>${S.desvios.filter(d => d.detecta === 'DT').length}</b><span>Detectados por el DT</span></div>
        <div class="kpi"><b>${impacto}</b><span>Días de impacto declarados</span></div>
      </div>
      <div class="filtros">
        <select id="c-fobra" aria-label="Obra">${op([['', 'Todas las obras'], ...S.obras.map(o => [o.id, o.nombre])], filtro.obra)}</select>
        <select id="c-festado" aria-label="Estado">${op([['abiertos', 'Abiertos y en curso'], ['abierto', 'Abiertos'], ['en curso', 'En curso'], ['cerrado', 'Cerrados'], ['todos', 'Todos']], filtro.estado)}</select>
      </div>
      <section class="card" style="margin-bottom:14px"><h2>Registro de desvíos (${lista.length})</h2>
        ${tabla([{ t: 'Fecha' }, { t: 'Obra' }, { t: 'Desvío' }, { t: 'Tipo' }, { t: 'Detecta' }, { t: 'Impacto', n: 1 }, { t: 'Plan de acción' }, { t: 'Fecha plan' }, { t: 'Responsable' }, { t: 'Prioridad' }, { t: 'Estado' }],
          lista.map(d => `<tr class="${vencido(d) ? 'crit-fila' : ''}">${td(P.fecha(d.fecha))}${td(`<b>${esc(d.obra)}</b>`)}${td(esc(d.evento))}${td(esc(d.tipo))}${td(esc(d.detecta || '—'))}${td(d.impDias != null ? `${d.impDias} d` : '—', 1)}${td(`<span class="chico">${esc(d.plan || '—').replace(/\n/g, '<br>')}</span>`)}${td(vencido(d) ? etq(P.fecha(d.fechaPA), 'bad') : P.fecha(d.fechaPA))}${td(esc(d.resp || '—'))}${td(etq(d.prio, tonoPrio(d.prio)))}${td(etq(d.estado, tonoEstado(d.estado)))}</tr>`),
          'No hay desvíos con estos filtros.')}</section>
      <section class="card"><h2>Para revisar en la carga (${rev.length})</h2>
        <p class="muted chico" style="margin-top:-6px">Datos que parecen incompletos o con error de tipeo. Conviene corregirlos en la planilla o en la app de origen.</p>
        ${tabla([{ t: 'Fecha' }, { t: 'Obra' }, { t: 'Desvío' }, { t: 'Qué revisar' }],
          rev.map(({ d, r }) => `<tr>${td(P.fecha(d.fecha))}${td(esc(d.obra))}${td(esc(d.evento))}${td(r.map(x => etq(x, 'warn')).join(' '))}</tr>`), 'Nada para revisar.')}</section>`;
  }

  function compras() {
    const lista = S.compras.filter(c => !filtro.obra || c.obra === filtro.obra).slice().sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    const ks = lista.map(compra);
    const ex = prom(ks.map(k => k.ex)), ci = prom(ks.map(k => k.ciclo)), ah = prom(ks.map(k => k.ah));
    const op = [['', 'Todas las obras'], ...S.obras.map(o => [o.id, o.nombre])].map(([k, t]) => `<option value="${esc(k)}" ${k === filtro.obra ? 'selected' : ''}>${esc(t)}</option>`).join('');
    const porObra = S.obras.map(o => {
      const l = S.compras.filter(c => c.obra === o.id);
      const k = l.map(compra);
      return l.length ? `<tr>${td(`<b>${esc(o.nombre)}</b>`)}${td(l.length, 1)}${td(l.filter(c => !c.fin).length, 1)}${td(prom(k.map(x => x.ciclo)) == null ? '—' : `${P.dec(prom(k.map(x => x.ciclo)))} d`, 1)}${td(pc(prom(k.map(x => x.ex))), 1)}${td(pc(prom(k.map(x => x.ah))), 1)}</tr>` : '';
    }).filter(Boolean);
    return `<div class="kpis">
        <div class="kpi"><b>${lista.length}</b><span>Requerimientos · ${lista.filter(c => !c.fin).length} en curso</span></div>
        <div class="kpi"><b>${ci == null ? '—' : P.dec(ci)}</b><span>Días de ciclo medio (solo cerrados)</span></div>
        <div class="kpi ${ex != null && ex < 0.95 ? 'amarillo' : ''}"><b>${pc(ex)}</b><span>Exactitud: entregado / pedido (meta 95 %)</span></div>
        <div class="kpi"><b>${pc(ah)}</b><span>Ahorro medio: presupuesto vs compra</span></div>
      </div>
      <div class="filtros"><select id="c-fobra" aria-label="Obra">${op}</select></div>
      <section class="card" style="margin-bottom:14px"><h2>Por obra</h2>${tabla([{ t: 'Obra' }, { t: 'Req.', n: 1 }, { t: 'En curso', n: 1 }, { t: 'Ciclo medio', n: 1 }, { t: 'Exactitud', n: 1 }, { t: 'Ahorro', n: 1 }], porObra)}</section>
      <section class="card"><h2>Requerimientos de compra</h2>
        ${tabla([{ t: 'Obra' }, { t: 'Req.' }, { t: 'Descripción' }, { t: 'Inicio' }, { t: 'Llegada' }, { t: 'Ciclo', n: 1 }, { t: 'Pedidos', n: 1 }, { t: 'Entregados', n: 1 }, { t: 'Exactitud', n: 1 }, { t: 'Ahorro', n: 1 }],
          lista.map(c => { const k = compra(c); return `<tr>${td(`<b>${esc(c.obra)}</b>`)}${td(esc(c.req))}${td(`${esc(c.desc)}${c.obs ? `<div class="muted chico">${esc(c.obs)}</div>` : ''}`)}${td(P.fecha(c.inicio))}${td(c.fin ? P.fecha(c.fin) : etq('en curso', 'acc'))}${td(k.ciclo != null ? `${k.ciclo} d` : k.transc != null ? `<span class="muted">${k.transc} d…</span>` : '—', 1)}${td(c.pedidos ?? '—', 1)}${td(c.entregados ?? '—', 1)}${td(k.ex == null ? '—' : etq(pc(k.ex), k.ex < 0.95 ? 'warn' : 'ok'), 1)}${td(k.ah == null ? '—' : pc(k.ah), 1)}</tr>`; }),
          'Sin requerimientos.')}
        <p class="muted chico" style="margin:10px 0 0">Los datos de compras son de marzo de 2026. Faltan los tableros de Trello de cada obra para completarlos.</p></section>`;
  }

  function datos() {
    const resumenDatos = S ? `<div class="pila" style="gap:6px">
        <div class="fila-dato"><span>Obras</span><b>${S.obras.length} (${activas().length} vigentes)</b></div>
        <div class="fila-dato"><span>DT</span><b>${S.dts.length}</b></div>
        <div class="fila-dato"><span>Meses con controles</span><b>${meses().map(P.mes).join(', ')}</b></div>
        <div class="fila-dato"><span>Desvíos</span><b>${S.desvios.length}</b></div>
        <div class="fila-dato"><span>Requerimientos de compra</span><b>${S.compras.length}</b></div>
        <div class="fila-dato"><span>Meta / piso de alerta</span><b>${pc(S.cfg.meta)} / ${pc(S.cfg.alerta)}</b></div>
      </div>` : '';
    return `<div class="grilla-2">
      <section class="card"><h2>Importar datos</h2>
        <p style="margin-top:0">Elegí el archivo <b>coordinacion-obras-datos.json</b> (o el export completo <b>coordinacion-obras-proyecto.json</b>). Los datos quedan guardados solo en este navegador: no se suben a ningún servidor.</p>
        <label class="btn primario" style="cursor:pointer">Elegir archivo JSON<input type="file" id="c-archivo" accept=".json,application/json" hidden></label>
        <p id="c-msg" style="margin-bottom:0"></p></section>
      ${S ? `<section class="card"><h2>Datos cargados</h2>${resumenDatos}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn mini" data-c-exportar>Descargar copia (.json)</button>
          <button class="btn mini plano" data-c-borrar>Borrar datos de este navegador</button></div></section>` : ''}
    </div>`;
  }

  // ---------- entrada ----------
  function vista(tab, param) {
    cargar();
    const t = TABS.some(([k]) => k === tab) ? tab : 'resumen';
    const cab = `<div class="cab"><div><h1>Coordinación de obras</h1><p>Evaluación de los DT, desvíos y compras, con los datos de la planilla de coordinación.</p></div>${S && ['resumen', 'controles'].includes(t) ? `<div class="filtros" style="margin:0">${selMes()}</div>` : ''}</div>`;
    const tabs = `<nav class="tabs" aria-label="Coordinación">${TABS.map(([k, n]) => `<a href="#coord.${k}" class="${k === t ? 'activo' : ''}">${esc(n)}</a>`).join('')}</nav>`;
    if (!S) return cab + tabs + datos();
    if (!per || !meses().includes(per)) per = meses().slice(-1)[0] || hoy().slice(0, 7);
    const cuerpo = { resumen, controles: () => controles(param), desvios, compras, datos }[t]();
    return cab + tabs + cuerpo;
  }

  function montar(rerender) {
    const v = document.getElementById('vista');
    const mes = v.querySelector('#c-mes');
    if (mes) mes.onchange = () => { per = mes.value; rerender(); };
    const ob = v.querySelector('#c-obra');
    if (ob) ob.onchange = () => { location.hash = `coord.controles.${ob.value}`; };
    const fo = v.querySelector('#c-fobra');
    if (fo) fo.onchange = () => { filtro.obra = fo.value; rerender(); };
    const fe = v.querySelector('#c-festado');
    if (fe) fe.onchange = () => { filtro.estado = fe.value; rerender(); };
    const arch = v.querySelector('#c-archivo');
    if (arch) arch.onchange = async () => {
      const msg = v.querySelector('#c-msg');
      try {
        const d = normalizar(JSON.parse(await arch.files[0].text()));
        if (!d) throw new Error('formato');
        S = d; per = null; guardar();
        location.hash = 'coord.resumen';
        rerender();
      } catch (e) {
        msg.className = 'err-msg';
        msg.textContent = 'Ese archivo no tiene el formato de la app de coordinación (faltan "obras" o "checks").';
      }
    };
    v.querySelectorAll('[data-celda]').forEach(b => b.onclick = () => {
      const [n, wi] = b.dataset.celda.split('|').map(Number);
      const k = `${b.dataset.obra}|${per}`;
      const c = S.checks[k] = S.checks[k] || { i: {}, o: {}, d: {} };
      const fila = c.i[n] = c.i[n] || [];
      while (fila.length <= wi) fila.push(null);
      fila[wi] = fila[wi] == null ? 1 : fila[wi] === 1 ? 0 : null;
      guardar();
      const y = window.scrollY;
      rerender();
      window.scrollTo(0, y);
    });
    const ex = v.querySelector('[data-c-exportar]');
    if (ex) ex.onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
      a.download = `coordinacion-obras-datos-${hoy()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const bo = v.querySelector('[data-c-borrar]');
    if (bo) bo.onclick = () => {
      if (!confirm('¿Borrar los datos de coordinación de este navegador? Vas a tener que volver a importar el archivo.')) return;
      P.local.borrar(CLAVE); S = null; per = null; rerender();
    };
  }

  return { vista, montar };
})();
