// Coordinación: evaluación mensual de los DT (30 controles en 8 bloques), desvíos, indicadores de gestión y compras.
// Es la app "Coordinación de Obras" dentro del panel, con sus mismas reglas. Los datos se importan desde su JSON
// (coordinacion-obras-datos.json o el export completo, que los trae en "datos") y quedan solo en este navegador.
// Con datos importados, demo.js usa estas obras y DT en todo el panel (ver "obras reales" en demo.js).
// Rutas: #coord[.resumen] · #coord.carga.<obra> · #coord.desvios · #coord.indicadores · #coord.compras · #coord.obras
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
  const TIPOS = ['Normativo', 'Técnico', 'Coordinación interna', 'Cliente', 'Proveedores', 'Condiciones del sitio'];
  const ESTADOS = ['abierto', 'en curso', 'cerrado'];
  const PRIOS = ['normal', 'alta', 'urgente', 'crítico'];
  const IND = [['desvios', 'Desvíos detectados anticipadamente por el DT', 'asc'], ['pendientes', 'Pendientes cerrados', 'asc'],
    ['retrabajos', 'Retrabajos', 'desc'], ['paralizaciones', 'Paralizaciones evitables', 'desc']];
  const TABS = [['resumen', 'Resumen del mes'], ['carga', 'Carga semanal'], ['desvios', 'Desvíos'], ['indicadores', 'Indicadores'], ['compras', 'Compras'], ['obras', 'Obras, DT y datos']];

  let S = null;            // datos importados
  let per = null;          // mes elegido, AAAA-MM
  let E = null;            // estado del panel (obras con reportes, certificados, láminas…)
  let refrescar = null;
  let form = null;         // { kind: 'desvio' | 'compra', id, borrar }
  let aviso = '';
  const fDes = { obra: '', estado: 'abiertos', tipo: '' };
  const fCom = { obra: '', mes: '' };

  // ---------- datos ----------
  function normalizar(x) {
    const d = x && x.datos && x.datos.checks ? x.datos : x;
    if (!d || !Array.isArray(d.obras) || !d.checks || typeof d.checks !== 'object') return null;
    const s = Object.assign({ cfg: {}, dts: [], inf: {}, desvios: [], compras: [], obsDT: {} }, d);
    s.cfg = Object.assign({ meta: 0.8, alerta: 0.6 }, s.cfg);
    s.cfg.w = Object.assign(Object.fromEntries(BLOQUES.map(([k]) => [k, 0.1])), s.cfg.w);
    Object.values(s.checks).forEach(c => { c.i = c.i || {}; c.o = c.o || {}; c.d = c.d || {}; });
    Object.values(s.inf).forEach(x => { x.txt = x.txt || {}; x.ind = x.ind || {}; });
    return s;
  }
  function cargar() {
    if (S === null) S = normalizar(P.local.leer(CLAVE));
    return S;
  }
  function guardar() { P.local.escribir(CLAVE, S); }
  const hoy = () => P.iso(new Date());
  const meses = () => [...new Set([...Object.keys(S.checks).map(k => k.split('|')[1]), hoy().slice(0, 7)])].sort();
  const mesAnt = p => { const [y, m] = p.split('-').map(Number); const t = y * 12 + m - 2; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const ck = (obra, p) => S.checks[`${obra}|${p}`] || (S.checks[`${obra}|${p}`] = { i: {}, o: {}, d: {} });
  const inf = (obra, p) => { const x = S.inf[`${obra}|${p}`] || (S.inf[`${obra}|${p}`] = { txt: {}, ind: {} }); x.txt = x.txt || {}; x.ind = x.ind || {}; return x; };
  const num = v => (v === '' || v == null ? null : Number(v));

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
        out.push({ n: semanaIso(f), ini: P.iso(f), fin: P.iso(fin), txt: `${d}–${fin.getDate()}${fin.getMonth() !== m - 1 ? '/' + (fin.getMonth() + 1) : ''}` });
      }
    }
    return out;
  }
  const aplica = (it, wi) => (it.fr === 'QUINCENAL' ? wi % 2 === 0 : it.fr === 'MENSUAL' ? wi === 0 : true);
  const prom = a => { a = a.filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };

  // Conformidad = promedio de los bloques con datos, ponderado por el peso de cada bloque.
  function puntaje(obra, p) {
    const c = (S.checks[`${obra}|${p}`] || {}).i || {};
    const W = semanas(p);
    const bl = Object.fromEntries(BLOQUES.map(([k]) => [k, { cap: 0, ev: 0, ok: 0, pct: null }]));
    ITEMS.forEach(it => {
      const fila = c[it.n] || [];
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
  function compra(c) {
    return {
      ciclo: c.fin ? P.dias(c.inicio, c.fin) : null,
      transc: !c.fin && c.inicio ? P.dias(c.inicio, hoy()) : null,
      ex: c.entregados != null && c.pedidos ? c.entregados / c.pedidos : null,
      ah: c.pIni && c.pCompra ? (c.pIni - c.pCompra) / c.pIni : null,
    };
  }
  const activas = () => S.obras.filter(o => o.activa);
  const nombreDt = id => (S.dts.find(d => d.id === id) || {}).nombre || id;
  const nombreObra = id => (S.obras.find(o => o.id === id) || {}).nombre || id;
  const abiertos = obra => S.desvios.filter(d => d.estado !== 'cerrado' && (!obra || d.obra === obra));
  const delMes = (obra, p) => S.desvios.filter(d => d.obra === obra && (d.fecha || '').slice(0, 7) === p);

  // Indicadores de gestión: lo cargado a mano, o calculado desde el registro de desvíos.
  function indVal(obra, p, k) {
    const e = ((S.inf[`${obra}|${p}`] || {}).ind || {})[k] || {};
    let dt = typeof e.dt === 'number' ? e.dt : null;
    let total = typeof e.total === 'number' ? e.total : null;
    let auto = false;
    const mes = delMes(obra, p);
    if (k === 'desvios') {
      if (dt == null && mes.length) { dt = mes.filter(d => d.detecta === 'DT').length; auto = true; }
      if (total == null && dt != null) { total = Math.max(mes.length, dt); auto = true; }
    }
    let resp = e.resp || '';
    if (k === 'retrabajos' || k === 'paralizaciones') {
      const f = k === 'retrabajos' ? 'retrab' : 'paral';
      if (mes.some(d => d[f])) { dt = mes.filter(d => d[f] === 'si').length; auto = true; }
      if (k === 'retrabajos' && !resp) resp = [...new Set(mes.filter(d => d.retrab === 'si').map(d => d.resp).filter(Boolean))].join(', ');
    }
    return { dt, total, res: dt != null && total ? dt / total : null, resp, obs: e.obs || '', auto };
  }
  function veredicto(k, cur, prev) {
    if (cur == null || prev == null) return '';
    const d = cur - prev;
    if ((IND.find(x => x[0] === k) || [])[2] === 'asc') return d > 0 ? 'verde' : d < 0 ? 'rojo' : '';
    return d < 0 ? 'verde' : d > 0 ? 'rojo' : cur === 0 ? 'verde' : '';
  }

  function faltantes(obra, p) {
    const c = S.checks[`${obra}|${p}`];
    const sc = puntaje(obra, p);
    if (!c || !sc.ev) return ['Sin controles cargados'];
    const g = [];
    if (sc.carga < 0.999) g.push(`Falta cargar ${Math.round((1 - sc.carga) * 100)} % de los controles`);
    const sinObs = ITEMS.filter(it => (c.i[it.n] || []).includes(0) && !(c.o && c.o[it.n]));
    if (sinObs.length) g.push(`${sinObs.length} control${sinObs.length > 1 ? 'es' : ''} no cumplido${sinObs.length > 1 ? 's' : ''} sin observación`);
    const x = S.inf[`${obra}|${p}`] || {};
    const conTexto = Object.values(x.txt || {}).some(t => (t.dt || '').trim() || (t.obra || '').trim()) || Object.keys(c.o || {}).length;
    if (!conTexto) g.push('Informe del mes vacío');
    const sinInd = IND.filter(([k]) => indVal(obra, p, k).dt == null);
    if (sinInd.length) g.push(`Indicadores sin cargar: ${sinInd.length} de 4`);
    const rt = indVal(obra, p, 'retrabajos');
    if (rt.dt > 0 && !rt.resp) g.push('Retrabajos sin responsable');
    return g;
  }

  function revisarDesvio(d) {
    const r = [];
    if (!d.resp) r.push('sin responsable');
    if (!d.plan) r.push('sin plan de acción');
    if (d.fechaPA && d.fecha && d.fechaPA < d.fecha) r.push('fecha del plan anterior al desvío');
    return r;
  }

  // ---------- controles automáticos ----------
  // El panel propone ✓ / ✗ para los controles que puede verificar con sus propios datos. Vos confirmás o corregís.
  const AUTO = {
    28: 'Informes diarios: ✓ si el DT confirmó el reporte de todos los días hábiles de la semana.',
    24: 'HyS: ✗ si algún reporte de la semana dice EPP incompleto o informa un incidente.',
    27: 'Certificado mensual: ✓ si el del mes anterior se presentó hasta el día 5.',
    10: 'Documentación apto obra: ✗ si al cierre de la semana falta emitir una lámina para una tarea que arranca en 10 días o menos.',
  };
  function obraPanel(id) { return E && E.obras ? E.obras.find(o => o.id === id) : null; }
  function sugerencias(obraId, p) {
    const o = obraPanel(obraId);
    const W = semanas(p);
    const out = {};
    if (!o) return out;
    const h = hoy();
    const reps = (o.reportes || []).filter(r => r.confirmado !== false);
    W.forEach((w, wi) => {
      if (w.ini > h) return;
      const corte = w.fin < h ? w.fin : P.sumarDias(h, -1);
      const put = (n, v) => { if (v != null) (out[n] = out[n] || {})[wi] = v; };
      if (o.conBot !== false && reps.length) {
        const habiles = [];
        for (let d = w.ini; d <= corte; d = P.sumarDias(d, 1)) if (P.esHabil(d) && (!o.inicio || d >= o.inicio)) habiles.push(d);
        const fechas = new Set(reps.map(r => r.fecha));
        if (habiles.length) put(28, habiles.every(d => fechas.has(d)) ? 1 : 0);
        const sem = reps.filter(r => r.fecha >= w.ini && r.fecha <= w.fin);
        if (sem.length) put(24, sem.some(r => r.epp === false || r.incidente) ? 0 : 1);
      }
      if (wi === 0 && (o.certificados || []).length) {
        const limite = `${p}-05`;
        const c = o.certificados.find(x => x.periodo === mesAnt(p));
        if (c && c.presentado && c.presentado <= limite) put(27, 1);
        else if (h > limite) put(27, 0);
      }
      if ((o.documentos || []).length && (o.tareas || []).length) {
        const falta = o.documentos.some(d => {
          const t = d.id_tarea && o.tareas.find(x => x.id === d.id_tarea);
          if (!t) return false;
          const emitida = ['emitida', 'aprobada', 'en obra'].includes(d.estado) && (!d.emision || d.emision <= corte);
          return !emitida && P.dias(corte, t.inicio) <= 10 && t.inicio >= w.ini;
        });
        put(10, falta ? 0 : 1);
      }
    });
    return out;
  }

  // ---------- piezas ----------
  const pc = p => (p == null ? '—' : `${Math.round(p * 100)} %`);
  const sem = (niv, txt) => `<span class="sem ${niv}">${esc(txt)}</span>`;
  const barra = p => `<span class="mini-barra" title="Meta ${pc(S.cfg.meta)}"><span class="pista"><span class="real ${nivel(p)}" style="width:${p == null ? 0 : Math.round(p * 100)}%"></span><span class="prev" style="left:${S.cfg.meta * 100}%"></span></span>${pc(p)}</span>`;
  const td = (v, n) => `<td class="${n ? 'n' : ''}">${v}</td>`;
  const tabla = (cols, filas, vacio = 'Sin registros.', clase = '') => (filas.length
    ? `<div class="desliza"><table class="tabla ${clase}"><thead><tr>${cols.map(c => `<th class="${c.n ? 'n' : ''}">${c.t}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`
    : `<p class="vacio">${vacio}</p>`);
  const tonoEstado = e => ({ abierto: 'warn', 'en curso': 'acc', cerrado: 'ok' }[e] || '');
  const tonoPrio = p => ({ crítico: 'bad', urgente: 'bad', alta: 'warn' }[p] || '');
  const etq = (t, tono) => `<span class="etiqueta ${tono}">${esc(t || '—')}</span>`;
  const op = (lista, v) => lista.map(x => (Array.isArray(x) ? x : [x, x])).map(([k, t]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const selMes = () => `<select id="c-mes" aria-label="Mes">${op(meses().map(m => [m, P.mes(m)]), per)}</select>`;

  function nivelDesvio(d) {
    const fuerte = d.prio === 'crítico' || d.prio === 'urgente';
    if (vencido(d) && fuerte) return 'critico';
    if (vencido(d) || d.prio === 'crítico') return 'rojo';
    return 'amarillo';
  }
  function desvioHTML(d) {
    const meta = [nombreObra(d.obra), d.tipo, d.resp ? `resp. ${d.resp}` : 'sin responsable', `desde ${P.fecha(d.fecha)}`].filter(Boolean).join(' · ');
    return `<div class="alerta ${nivelDesvio(d)}"><span class="franja"></span>
      <div class="txt"><b>${esc(d.evento)}</b><span>${esc(d.plan || 'Sin plan de acción')}</span><div class="chip">${esc(meta)}</div></div>
      <div class="acc">${vencido(d) ? etq(`vencido ${P.fecha(d.fechaPA)}`, 'bad') : d.fechaPA ? etq(`plan ${P.fecha(d.fechaPA)}`, '') : ''}${etq(d.prio || 'normal', tonoPrio(d.prio))}
        <button class="btn mini" data-c="editdes" data-id="${esc(d.id)}">Editar</button></div></div>`;
  }

  // ---------- resumen ----------
  function dtStats(id, p) {
    const os = activas().filter(o => o.dts.includes(id));
    const pct = prom(os.map(o => puntaje(o.id, p).pct));
    const prev = prom(os.map(o => puntaje(o.id, mesAnt(p)).pct));
    const ind = {}, ver = {};
    IND.forEach(([k]) => {
      let cur = null, prv = null;
      os.forEach(o => {
        const v = indVal(o.id, p, k).dt, q = indVal(o.id, mesAnt(p), k).dt;
        if (v != null) cur = (cur || 0) + v;
        if (q != null) prv = (prv || 0) + q;
      });
      ind[k] = cur; ver[k] = veredicto(k, cur, prv);
    });
    const ds = S.desvios.filter(x => os.some(o => o.id === x.obra) && x.estado !== 'cerrado');
    return { os, pct, prev, ind, ver, ds };
  }

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
        return `<tr>${td(`<a href="#coord.carga.${esc(o.id)}"><b>${esc(o.nombre)}</b></a><div class="muted chico">${esc(o.id)}</div>`)}${td(o.dts.map(nombreDt).map(esc).join('<br>') || '—')}${td(barra(sc.pct))}${td(pc(sc.carga), 1)}${td(bajo ? `${esc(bajo.n)} ${pc(bajo.p)}` : '—')}${td(`${ds.length}${venc ? ` ${etq(`${venc} vencido${venc > 1 ? 's' : ''}`, 'bad')}` : ''}`, 1)}${td(sem(nivel(sc.pct), NOMBRE[nivel(sc.pct)]))}</tr>`;
      }), 'No hay obras activas. Activalas en Obras, DT y datos.');

    const mapa = `<div class="desliza"><table class="matriz"><thead><tr><th class="obra">Obra</th>${BLOQUES.map(([, n]) => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${filas.map(({ o, sc }) =>
      `<tr><td class="obra"><a href="#coord.carga.${esc(o.id)}">${esc(o.nombre)}</a><small>${esc(o.id)}</small></td>${BLOQUES.map(([k]) => { const p = sc.bl[k].pct; return `<td><span class="sem solo ${nivel(p)}">${p == null ? '—' : Math.round(p * 100)}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;

    const obs = S.obsDT[per] || {};
    const dts = S.dts.map(d => Object.assign({ d }, dtStats(d.id, per))).sort((a, b) => (a.pct ?? 2) - (b.pct ?? 2));
    const tablaDts = tabla([{ t: 'DT' }, { t: 'Obras' }, { t: 'Conformidad' }, { t: 'vs mes ant.', n: 1 }, ...IND.map(([k, n]) => ({ t: `<span title="${esc(n)}">${{ desvios: 'Antic.', pendientes: 'Pend.', retrabajos: 'Retrab.', paralizaciones: 'Paral.' }[k]}</span>`, n: 1 })), { t: 'Desv. abiertos', n: 1 }, { t: 'Estado' }, { t: 'Observación del mes' }],
      dts.map(({ d, os, pct, prev, ind, ver, ds }) => {
        const dif = pct != null && prev != null ? Math.round((pct - prev) * 100) : null;
        const venc = ds.filter(vencido).length;
        return `<tr>${td(`<b>${esc(d.nombre)}</b>`)}${td(os.map(o => `<a href="#coord.carga.${esc(o.id)}">${esc(o.id)}</a>`).join(' · ') || '—')}${td(barra(pct))}${td(dif == null ? '—' : `${dif > 0 ? '+' : ''}${dif} pp`, 1)}${IND.map(([k]) => td(ind[k] == null ? '—' : `<span class="ind ${ver[k]}">${ind[k]}</span>`, 1)).join('')}${td(`${ds.length}${venc ? ` ${etq(`${venc} venc.`, 'bad')}` : ''}`, 1)}${td(sem(nivel(pct), NOMBRE[nivel(pct)]))}<td><textarea class="c-texto" id="c-obsdt-${esc(d.id)}" data-c="obsdt" data-id="${esc(d.id)}" rows="2" placeholder="Observación de ${esc(d.nombre)}">${esc(obs[d.id] || '')}</textarea></td></tr>`;
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
      <section class="card" style="margin-bottom:14px"><h2>Qué falta completar</h2>${falta.length ? `<div class="pila" style="gap:8px">${falta.map(x => `<div class="fila-dato"><a href="#coord.carga.${esc(x.o.id)}">${esc(x.o.nombre)}</a><span style="text-align:right">${x.g.map(t => etq(t, 'warn')).join(' ')}</span></div>`).join('')}</div>` : '<p class="vacio">Todo completo.</p>'}</section>
      <section class="card" style="margin-bottom:14px"><h2>Desempeño de los DT · ${esc(mesTxt)}</h2>
        <p class="muted chico" style="margin-top:-6px">Promedio de las obras que dirige cada DT. Carletto la comparten dos DT: cuenta para ambos. En los indicadores, verde o rojo es la tendencia contra el mes anterior. Las observaciones se guardan al salir del campo.</p>${tablaDts}
        <div class="campo" style="margin-top:12px"><label for="c-obsdt-_gral">Observación general para todos los DT</label><textarea class="c-texto" id="c-obsdt-_gral" data-c="obsdt" data-id="_gral" rows="2">${esc(obs._gral || '')}</textarea></div></section>
      <section class="pila"><h2 class="rotulo" style="margin:8px 0 0">Desvíos para resolver primero (${urg.length})</h2>
        <div class="alertas">${urg.map(desvioHTML).join('') || '<p class="vacio">Nada vencido ni urgente.</p>'}</div></section>`;
  }

  // ---------- carga semanal ----------
  // Observaciones de los controles que van solas al informe, según la fila diga DT u Obra.
  function autoLista(obraId, k, dest) {
    const c = S.checks[`${obraId}|${per}`] || { o: {}, d: {} };
    const man = (((S.inf[`${obraId}|${per}`] || {}).txt || {})[k] || {})[dest] || '';
    const auto = ITEMS.filter(it => it.b === k && (c.o || {})[it.n] && (((c.d || {})[it.n]) || 'dt') === dest).map(it => c.o[it.n])
      .filter(t => t.trim().length > 1 && !man.toLowerCase().includes(t.toLowerCase()));
    return auto.length ? `<ul class="auto">${auto.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  }
  function informeHTML(o) {
    const x = S.inf[`${o.id}|${per}`] || { txt: {} };
    const filas = BLOQUES.map(([k, n]) => {
      const man = (x.txt || {})[k] || {};
      const col = dest => {
        return `<td><div id="c-auto-${dest}-${esc(k)}">${autoLista(o.id, k, dest)}</div><textarea class="c-texto" id="c-txt-${dest}-${esc(k)}" data-c="txt" data-b="${esc(k)}" data-f="${dest}" rows="2" placeholder="Observación adicional" aria-label="${esc(n)}, referido a ${dest === 'dt' ? 'la DT' : 'la obra'}">${esc(man[dest] || '')}</textarea></td>`;
      };
      return `<tr><td><b>${esc(n)}</b></td>${col('dt')}${col('obra')}</tr>`;
    });
    return `<h2>Informe del mes</h2>
      <p class="muted chico" style="margin-top:-6px">Arriba de cada campo aparecen solas las observaciones de los controles, según elijas DT u Obra en cada fila. Sumá lo que falte en el campo.</p>
      ${tabla([{ t: 'Bloque' }, { t: 'Referido a la DT' }, { t: 'Referido a la obra o proyecto' }], filas, '', 'informe-mes')}`;
  }

  function carga(obraId) {
    const o = S.obras.find(x => x.id === obraId) || activas()[0] || S.obras[0];
    if (!o) return '<p class="vacio">No hay obras. Agregalas en Obras, DT y datos.</p>';
    const W = semanas(per);
    const c = S.checks[`${o.id}|${per}`] || { i: {}, o: {}, d: {} };
    const sc = puntaje(o.id, per);
    const sug = sugerencias(o.id, per);
    let nSug = 0;
    const sel = `<select id="c-obra" aria-label="Obra">${S.obras.map(x => `<option value="${esc(x.id)}" ${x.id === o.id ? 'selected' : ''}>${esc(x.nombre)}${x.activa ? '' : ' (finalizada)'}</option>`).join('')}</select>`;
    const filas = BLOQUES.map(([k, n]) => {
      const p = sc.bl[k].pct;
      const cab = `<tr class="bloque"><td colspan="${W.length + 3}"><b>${esc(n)}</b> ${sem(nivel(p), pc(p))} <span class="muted chico">peso ${pc(S.cfg.w[k])}</span></td></tr>`;
      return cab + ITEMS.filter(it => it.b === k).map(it => {
        const fila = c.i[it.n] || [];
        const celdas = W.map((w, wi) => {
          const v = fila[wi];
          const s = (sug[it.n] || {})[wi];
          const corresponde = aplica(it, wi) || v === 0 || v === 1 || s != null;
          if (s != null && v == null && corresponde) nSug++;
          const txt = v === 1 ? '✓' : v === 0 ? '✗' : s != null ? (s ? '✓' : '✗') : corresponde ? '·' : '–';
          const cls = v === 1 ? 'si' : v === 0 ? 'no' : s != null ? (s ? 'sug-si' : 'sug-no') : '';
          const difiere = s != null && v != null && s !== v;
          const tit = s != null ? `El panel sugiere ${s ? 'cumple' : 'no cumple'}${difiere ? ' (distinto de lo marcado)' : v == null ? ' (sin confirmar)' : ''}` : '';
          return `<td class="ck"><button class="celda ${cls} ${difiere ? 'difiere' : ''}" data-c="celda" data-n="${it.n}" data-w="${wi}" ${corresponde ? '' : 'disabled'} title="${esc(tit)}" aria-label="${esc(it.t)}, semana ${w.n}: ${v === 1 ? 'cumple' : v === 0 ? 'no cumple' : 'sin marcar'}${tit ? '. ' + esc(tit) : ''}">${txt}</button></td>`;
        }).join('');
        const a = ((c.d || {})[it.n]) || 'dt';
        return `<tr><td>${esc(it.t)}${AUTO[it.n] ? ' <span class="etiqueta acc" title="' + esc(AUTO[it.n]) + '">auto</span>' : ''}</td><td class="muted chico">${esc(it.fr.toLowerCase())}</td>${celdas}
          <td><div class="obs-fila"><select id="c-dest-${it.n}" data-c="dest" data-n="${it.n}" aria-label="La observación se refiere a"><option value="dt" ${a === 'dt' ? 'selected' : ''}>DT</option><option value="obra" ${a === 'obra' ? 'selected' : ''}>Obra</option></select><input type="text" class="c-texto" id="c-obs-${it.n}" data-c="obs" data-n="${it.n}" value="${esc((c.o || {})[it.n] || '')}" placeholder="Observación" aria-label="Observación: ${esc(it.t)}"></div></td></tr>`;
      }).join('');
    }).join('');

    const op2 = obraPanel(o.id);
    const fuente = !op2 ? 'Esta obra no está en el panel (está finalizada o se están viendo los datos de ejemplo).'
      : `El panel tiene de esta obra: ${[(op2.reportes || []).length ? `${op2.reportes.length} reportes` : 'sin reportes del bot', (op2.certificados || []).length ? `${op2.certificados.length} certificados` : 'sin certificados', (op2.documentos || []).length ? `${op2.documentos.length} láminas` : 'sin láminas'].join(', ')}. Cargá certificados y láminas en la pestaña Cargar del panel.`;

    return `<div class="filtros">${sel}</div>
      <div class="ficha-cab">
        <div class="dato"><span>Conformidad ${esc(P.mes(per))}</span><b>${pc(sc.pct)}</b> ${sem(nivel(sc.pct), NOMBRE[nivel(sc.pct)])}</div>
        <div class="dato"><span>DT</span><b>${o.dts.map(nombreDt).map(esc).join(' y ') || '—'}</b></div>
        <div class="dato"><span>Carga del mes</span><b>${pc(sc.carga)}</b> <small>de los controles que corresponden</small></div>
        <div class="dato"><span>Desvíos abiertos</span><b>${abiertos(o.id).length}</b> <small>${abiertos(o.id).filter(vencido).length} con plan vencido</small></div>
      </div>
      <section class="card" style="margin-bottom:14px">
        <div class="cab" style="margin:0 0 6px"><h2 style="margin:0">Controles semanales · ${esc(P.mes(per))}</h2>
          ${nSug ? `<button class="btn mini primario" data-c="aplicar" data-obra="${esc(o.id)}">Aplicar ${nSug} sugerencia${nSug > 1 ? 's' : ''} del panel</button>` : ''}</div>
        <p class="muted chico" style="margin-top:0">Tocá una celda: sin marcar → ✓ cumple → ✗ no cumple. Con guion no corresponde esa semana por la frecuencia. Las celdas punteadas son sugerencias del panel sin confirmar; con borde naranja, lo marcado no coincide con lo que sugiere el panel.</p>
        <div class="desliza"><table class="tabla controles"><thead><tr><th>Control</th><th>Frec.</th>${W.map((w, wi) => `<th class="ck">S${w.n}<div class="muted" style="text-transform:none;font-weight:500">${esc(w.txt)}</div><button class="btn mini plano" data-c="todo" data-w="${wi}" title="Marca cumple en los controles vacíos de esa semana">Todo ✓</button></th>`).join('')}<th>Observación y a quién se refiere</th></tr></thead><tbody>${filas}</tbody></table></div>
        <details class="chico" style="margin-top:10px"><summary>Controles que sugiere el panel</summary>
          <ul>${Object.entries(AUTO).map(([n, t]) => `<li><b>${n}.</b> ${esc(t)}</li>`).join('')}</ul><p class="muted">${esc(fuente)}</p></details>
      </section>
      <section class="card" id="c-informe">${informeHTML(o)}</section>`;
  }

  // ---------- desvíos ----------
  function formDesvio() {
    const d = form.id ? S.desvios.find(x => x.id === form.id) : { fecha: hoy(), obra: fDes.obra || (activas()[0] || {}).id, estado: 'abierto', prio: 'normal', tipo: TIPOS[0], detecta: 'DT' };
    if (!d) return '';
    const flag = v => `<option value="" ${!v ? 'selected' : ''}>Sin definir</option><option value="si" ${v === 'si' ? 'selected' : ''}>Sí</option><option value="no" ${v === 'no' ? 'selected' : ''}>No</option>`;
    const campo = (id, label, html, ancho) => `<div class="campo ${ancho ? 'ancho' : ''}"><label for="${id}">${label}</label>${html}</div>`;
    return `<form class="card" id="c-form-desvio" style="margin-bottom:14px"><h2>${form.id ? 'Editar desvío' : 'Nuevo desvío'}</h2><div class="form">
      ${campo('fd-fecha', 'Fecha', `<input type="date" id="fd-fecha" name="fecha" value="${esc(d.fecha || '')}" required>`)}
      ${campo('fd-obra', 'Obra', `<select id="fd-obra" name="obra">${op(S.obras.map(o => [o.id, o.nombre]), d.obra)}</select>`)}
      ${campo('fd-tipo', 'Tipo', `<select id="fd-tipo" name="tipo">${op(TIPOS, d.tipo)}</select>`)}
      ${campo('fd-detecta', 'Lo detectó', `<select id="fd-detecta" name="detecta">${op([['DT', 'DT'], ['CO', 'Coordinación'], ['Otro', 'Otro'], ['', 'Sin dato']], d.detecta || '')}</select>`)}
      ${campo('fd-evento', 'Desvío', `<input type="text" id="fd-evento" name="evento" value="${esc(d.evento || '')}" required>`, 1)}
      ${campo('fd-plan', 'Plan de acción', `<textarea id="fd-plan" name="plan" rows="2">${esc(d.plan || '')}</textarea>`, 1)}
      ${campo('fd-fechaPA', 'Fecha del plan', `<input type="date" id="fd-fechaPA" name="fechaPA" value="${esc(d.fechaPA || '')}">`)}
      ${campo('fd-resp', 'Responsable', `<input type="text" id="fd-resp" name="resp" value="${esc(d.resp || '')}">`)}
      ${campo('fd-imp', 'Impacto en plazo (días)', `<input type="number" id="fd-imp" name="impDias" min="0" value="${d.impDias ?? ''}" placeholder="vacío: en estudio">`)}
      ${campo('fd-prio', 'Prioridad', `<select id="fd-prio" name="prio">${op(PRIOS, d.prio || 'normal')}</select>`)}
      ${campo('fd-estado', 'Estado', `<select id="fd-estado" name="estado">${op(ESTADOS, d.estado)}</select>`)}
      ${campo('fd-retrab', '¿Genera retrabajo?', `<select id="fd-retrab" name="retrab">${flag(d.retrab)}</select>`)}
      ${campo('fd-paral', '¿Paralización evitable?', `<select id="fd-paral" name="paral">${flag(d.paral)}</select>`)}
      <div class="acciones"><button class="btn primario" type="submit">Guardar desvío</button><button class="btn" type="button" data-c="cancelar">Cancelar</button>
        ${form.id ? `<button class="btn plano" type="button" data-c="${form.borrar ? 'borrar2' : 'borrar'}">${form.borrar ? 'Confirmar: eliminar este desvío' : 'Eliminar'}</button>` : ''}</div>
    </div></form>`;
  }

  function desvios() {
    const lista = S.desvios.filter(d => (!fDes.obra || d.obra === fDes.obra) && (!fDes.tipo || d.tipo === fDes.tipo)
      && (fDes.estado === 'todos' || (fDes.estado === 'abiertos' ? d.estado !== 'cerrado' : d.estado === fDes.estado)))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const ab = S.desvios.filter(d => d.estado !== 'cerrado');
    const impacto = S.desvios.reduce((s, d) => s + (d.impDias || 0), 0);
    const rev = S.desvios.map(d => ({ d, r: revisarDesvio(d) })).filter(x => x.r.length);
    const tg = (d, f, n) => `<button type="button" class="tg ${d[f] || ''}" data-c="flag" data-id="${esc(d.id)}" data-f="${f}" title="${n}. Tocá para cambiar: sin definir → Sí → No">${d[f] === 'si' ? 'Sí' : d[f] === 'no' ? 'No' : '–'}</button>`;
    return `<div class="kpis">
        <div class="kpi"><b>${S.desvios.length}</b><span>Desvíos registrados</span></div>
        <div class="kpi amarillo"><b>${ab.length}</b><span>Abiertos o en curso</span></div>
        <div class="kpi ${ab.some(vencido) ? 'rojo' : ''}"><b>${ab.filter(vencido).length}</b><span>Con plan de acción vencido</span></div>
        <div class="kpi"><b>${S.desvios.filter(d => d.detecta === 'DT').length}</b><span>Detectados por el DT</span></div>
        <div class="kpi"><b>${impacto}</b><span>Días de impacto declarados</span></div>
      </div>
      ${form && form.kind === 'desvio' ? formDesvio() : ''}
      <div class="filtros" style="align-items:center">
        <select id="c-fdes-obra" data-c="fdes" data-k="obra" aria-label="Obra">${op([['', 'Todas las obras'], ...S.obras.map(o => [o.id, o.nombre])], fDes.obra)}</select>
        <select id="c-fdes-estado" data-c="fdes" data-k="estado" aria-label="Estado">${op([['abiertos', 'Abiertos y en curso'], ['abierto', 'Abiertos'], ['en curso', 'En curso'], ['cerrado', 'Cerrados'], ['todos', 'Todos']], fDes.estado)}</select>
        <select id="c-fdes-tipo" data-c="fdes" data-k="tipo" aria-label="Tipo">${op([['', 'Todos los tipos'], ...TIPOS.map(t => [t, t])], fDes.tipo)}</select>
        <button class="btn primario" data-c="nuevodes" style="margin-left:auto">Nuevo desvío</button>
      </div>
      <section class="card" style="margin-bottom:14px"><h2>Registro de desvíos (${lista.length})</h2>
        ${tabla([{ t: 'Fecha' }, { t: 'Obra' }, { t: 'Desvío' }, { t: 'Tipo' }, { t: 'Detecta' }, { t: 'Impacto', n: 1 }, { t: 'Plan de acción' }, { t: 'Fecha plan' }, { t: 'Responsable' }, { t: 'Prioridad' }, { t: '<span title="¿Genera retrabajo?">Retrab.</span>' }, { t: '<span title="¿Paralización evitable?">Paral.</span>' }, { t: 'Estado' }, { t: '' }],
          lista.map(d => `<tr class="${vencido(d) ? 'crit-fila' : ''}">${td(P.fecha(d.fecha))}${td(`<b>${esc(d.obra)}</b>`)}${td(esc(d.evento))}${td(esc(d.tipo))}${td(esc(d.detecta || '—'))}${td(d.impDias != null ? `${d.impDias} d` : '<span class="muted">estudio</span>', 1)}${td(`<span class="chico">${esc(d.plan || '—').replace(/\n/g, '<br>')}</span>`)}${td(vencido(d) ? etq(P.fecha(d.fechaPA), 'bad') : P.fecha(d.fechaPA))}${td(esc(d.resp || '—'))}${td(etq(d.prio || 'normal', tonoPrio(d.prio)))}${td(tg(d, 'retrab', 'Genera retrabajo'))}${td(tg(d, 'paral', 'Paralización evitable'))}<td><select id="c-est-${esc(d.id)}" data-c="estado" data-id="${esc(d.id)}" aria-label="Estado" class="estado-${tonoEstado(d.estado)}">${op(ESTADOS, d.estado)}</select></td><td><button class="btn mini" data-c="editdes" data-id="${esc(d.id)}">Editar</button></td></tr>`),
          'No hay desvíos con estos filtros.')}</section>
      <section class="card"><h2>Para revisar en la carga (${rev.length})</h2>
        <p class="muted chico" style="margin-top:-6px">Datos que parecen incompletos o con error de tipeo.</p>
        ${tabla([{ t: 'Fecha' }, { t: 'Obra' }, { t: 'Desvío' }, { t: 'Qué revisar' }, { t: '' }],
          rev.map(({ d, r }) => `<tr>${td(P.fecha(d.fecha))}${td(esc(d.obra))}${td(esc(d.evento))}${td(r.map(x => etq(x, 'warn')).join(' '))}<td><button class="btn mini" data-c="editdes" data-id="${esc(d.id)}">Corregir</button></td></tr>`), 'Nada para revisar.')}</section>`;
  }

  // ---------- indicadores ----------
  function evalInd(obra, k) {
    const v = indVal(obra, per, k), q = indVal(obra, mesAnt(per), k);
    const vd = veredicto(k, v.dt, q.dt);
    const txt = vd === 'verde' ? 'Conforme' : vd === 'rojo' ? 'No conforme' : v.dt == null ? 'Sin datos' : q.dt == null ? 'Sin mes anterior' : 'Sin variación';
    return `${sem(vd, txt)} <span class="muted chico">ant. ${q.dt ?? '—'}${v.res != null ? ` · resultado ${pc(v.res)}` : ''}</span>`;
  }
  function indicadores() {
    const filas = activas().flatMap(o => IND.map(([k, n, obj], i) => {
      const e = ((S.inf[`${o.id}|${per}`] || {}).ind || {})[k] || {};
      const v = indVal(o.id, per, k);
      const bloq = (k === 'retrabajos' || k === 'paralizaciones') && v.auto;
      const f = k === 'retrabajos' ? 'resp' : 'obs';
      return `<tr class="${i === 0 ? 'primera' : ''}">${td(i === 0 ? `<b>${esc(o.nombre)}</b><div class="muted chico">${esc(o.dts.map(nombreDt).join(' y '))}</div>` : '')}${td(`${esc(n)}<div class="muted chico">${obj === 'asc' ? 'Tiene que subir ▲' : 'Tiene que bajar ▼'}</div>`)}
        <td class="n"><input type="number" min="0" class="num-in" id="c-ind-${esc(o.id)}-${k}-dt" data-c="ind" data-o="${esc(o.id)}" data-k="${k}" data-f="dt" value="${bloq ? v.dt : typeof e.dt === 'number' ? e.dt : ''}" placeholder="${v.auto && v.dt != null ? v.dt : ''}" ${bloq ? 'disabled title="Se calcula desde las marcas del registro de desvíos"' : ''} aria-label="${esc(n)}, DT"></td>
        <td class="n"><input type="number" min="0" class="num-in" id="c-ind-${esc(o.id)}-${k}-total" data-c="ind" data-o="${esc(o.id)}" data-k="${k}" data-f="total" value="${typeof e.total === 'number' ? e.total : ''}" placeholder="${v.auto && v.total != null ? v.total : ''}" aria-label="${esc(n)}, totales"></td>
        <td id="c-eval-${esc(o.id)}-${k}">${evalInd(o.id, k)}</td>
        <td><input type="text" class="c-texto" id="c-ind-${esc(o.id)}-${k}-${f}" data-c="indtxt" data-o="${esc(o.id)}" data-k="${k}" data-f="${f}" value="${esc(e[f] || '')}" placeholder="${k === 'retrabajos' ? esc(v.resp && !e.resp ? v.resp : 'Responsable del retrabajo') : 'Observación'}" aria-label="${esc(n)}, ${k === 'retrabajos' ? 'responsable' : 'observación'}"></td></tr>`;
    }));
    return `<section class="card"><h2>Indicadores de gestión · ${esc(P.mes(per))}</h2>
      <p class="muted chico" style="margin-top:-6px">Escribí cuántos le corresponden al DT y cuántos hubo en total. La evaluación compara al DT con el mes anterior. Desvíos anticipados: si dejás vacío, se cuentan los del registro marcados "lo detectó el DT". Retrabajos y paralizaciones evitables: cuando marcás algún desvío del mes con Sí o No en el registro, se calculan solos y el campo queda bloqueado.</p>
      ${tabla([{ t: 'Obra' }, { t: 'Indicador' }, { t: 'DT', n: 1 }, { t: 'Totales', n: 1 }, { t: 'Evaluación' }, { t: 'Responsable u observación' }], filas, 'No hay obras activas.', 'indicadores')}</section>`;
  }

  // ---------- compras ----------
  function materialesDe(obraId) {
    const o = obraPanel(obraId);
    return o ? (o.tareas || []).flatMap(t => (t.materiales || []).map(m => [`${t.id}|${m.nombre}`, `${t.id} ${t.nombre}: ${m.nombre}`])) : [];
  }
  function formCompra() {
    const c = form.id ? S.compras.find(x => x.id === form.id) : { obra: fCom.obra || (activas()[0] || {}).id, inicio: hoy() };
    if (!c) return '';
    const mats = materialesDe(c.obra);
    const campo = (id, label, html, ancho) => `<div class="campo ${ancho ? 'ancho' : ''}"><label for="${id}">${label}</label>${html}</div>`;
    return `<form class="card" id="c-form-compra" style="margin-bottom:14px"><h2>${form.id ? 'Editar requerimiento de compra' : 'Nuevo requerimiento de compra'}</h2><div class="form">
      ${campo('fc-obra', 'Obra', `<select id="fc-obra" name="obra" data-c="fcobra">${op(S.obras.map(o => [o.id, o.nombre]), c.obra)}</select>`)}
      ${campo('fc-req', 'Requerimiento', `<input type="text" id="fc-req" name="req" value="${esc(c.req || '')}" placeholder="REQ Nº 018" required>`)}
      ${campo('fc-desc', 'Descripción', `<input type="text" id="fc-desc" name="desc" value="${esc(c.desc || '')}" required>`, 1)}
      ${campo('fc-mat', 'Material del cronograma', mats.length ? `<select id="fc-mat" name="material">${op([['', 'Sin vincular'], ...mats], c.material || '')}</select>` : `<input type="text" id="fc-mat" disabled value="La obra no tiene cronograma con materiales en el panel">`, 1)}
      ${campo('fc-ini', 'Inicio', `<input type="date" id="fc-ini" name="inicio" value="${esc(c.inicio || '')}" required>`)}
      ${campo('fc-fin', 'Llegada', `<input type="date" id="fc-fin" name="fin" value="${esc(c.fin || '')}">`)}
      ${campo('fc-ped', 'Cantidad pedida', `<input type="number" id="fc-ped" name="pedidos" min="0" value="${c.pedidos ?? ''}">`)}
      ${campo('fc-ent', 'Cantidad entregada', `<input type="number" id="fc-ent" name="entregados" min="0" value="${c.entregados ?? ''}">`)}
      ${campo('fc-pini', 'Presupuesto inicial ($)', `<input type="number" id="fc-pini" name="pIni" min="0" value="${c.pIni ?? ''}">`)}
      ${campo('fc-pcom', 'Compra final ($)', `<input type="number" id="fc-pcom" name="pCompra" min="0" value="${c.pCompra ?? ''}">`)}
      ${campo('fc-obs', 'Observación', `<textarea id="fc-obs" name="obs" rows="2">${esc(c.obs || '')}</textarea>`, 1)}
      <div class="acciones"><button class="btn primario" type="submit">Guardar requerimiento</button><button class="btn" type="button" data-c="cancelar">Cancelar</button>
        ${form.id ? `<button class="btn plano" type="button" data-c="${form.borrar ? 'borrar2' : 'borrar'}">${form.borrar ? 'Confirmar: eliminar este requerimiento' : 'Eliminar'}</button>` : ''}</div>
    </div></form>`;
  }
  function compras() {
    const mesesC = [...new Set(S.compras.map(c => (c.fin || c.inicio || '').slice(0, 7)).filter(Boolean))].sort();
    const lista = S.compras.filter(c => (!fCom.obra || c.obra === fCom.obra) && (!fCom.mes || (c.fin || c.inicio || '').slice(0, 7) === fCom.mes))
      .slice().sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    const ks = lista.map(compra);
    const ex = prom(ks.map(k => k.ex)), ci = prom(ks.map(k => k.ciclo)), ah = prom(ks.map(k => k.ah));
    const porObra = S.obras.map(o => {
      const l = S.compras.filter(c => c.obra === o.id);
      const k = l.map(compra);
      const cm = prom(k.map(x => x.ciclo));
      return l.length ? `<tr>${td(`<b>${esc(o.nombre)}</b>`)}${td(l.length, 1)}${td(l.filter(c => !c.fin).length, 1)}${td(cm == null ? '—' : `${P.dec(cm)} d`, 1)}${td(pc(prom(k.map(x => x.ex))), 1)}${td(pc(prom(k.map(x => x.ah))), 1)}</tr>` : '';
    }).filter(Boolean);
    const matNombre = c => { if (!c.material) return ''; const m = materialesDe(c.obra).find(x => x[0] === c.material); return `<div class="chico"><span class="etiqueta acc">material</span> ${esc(m ? m[1] : c.material.replace('|', ': '))}</div>`; };
    return `<div class="kpis">
        <div class="kpi"><b>${lista.length}</b><span>Requerimientos · ${lista.filter(c => !c.fin).length} en curso</span></div>
        <div class="kpi"><b>${ci == null ? '—' : P.dec(ci)}</b><span>Días de ciclo medio (solo cerrados)</span></div>
        <div class="kpi ${ex != null && ex < 0.95 ? 'amarillo' : ''}"><b>${pc(ex)}</b><span>Exactitud: entregado / pedido (meta 95 %)</span></div>
        <div class="kpi"><b>${pc(ah)}</b><span>Ahorro medio: presupuesto vs compra</span></div>
      </div>
      ${form && form.kind === 'compra' ? formCompra() : ''}
      <div class="filtros" style="align-items:center">
        <select id="c-fcom-obra" data-c="fcom" data-k="obra" aria-label="Obra">${op([['', 'Todas las obras'], ...S.obras.map(o => [o.id, o.nombre])], fCom.obra)}</select>
        <select id="c-fcom-mes" data-c="fcom" data-k="mes" aria-label="Mes">${op([['', 'Todos los meses'], ...mesesC.map(m => [m, P.mes(m)])], fCom.mes)}</select>
        <button class="btn primario" data-c="nuevacom" style="margin-left:auto">Nuevo requerimiento</button>
      </div>
      <section class="card" style="margin-bottom:14px"><h2>Por obra</h2>${tabla([{ t: 'Obra' }, { t: 'Req.', n: 1 }, { t: 'En curso', n: 1 }, { t: 'Ciclo medio', n: 1 }, { t: 'Exactitud', n: 1 }, { t: 'Ahorro', n: 1 }], porObra)}</section>
      <section class="card"><h2>Requerimientos de compra</h2>
        <p class="muted chico" style="margin-top:-6px">Si vinculás un requerimiento con un material del cronograma, el panel da ese material por pedido (o recibido, con fecha de llegada) y deja de avisar que falta pedirlo.</p>
        ${tabla([{ t: 'Obra' }, { t: 'Req.' }, { t: 'Descripción' }, { t: 'Inicio' }, { t: 'Llegada' }, { t: 'Ciclo', n: 1 }, { t: 'Pedidos', n: 1 }, { t: 'Entregados', n: 1 }, { t: 'Exactitud', n: 1 }, { t: 'Ahorro', n: 1 }, { t: '' }],
          lista.map(c => { const k = compra(c); return `<tr>${td(`<b>${esc(c.obra)}</b>`)}${td(esc(c.req))}${td(`${esc(c.desc)}${c.obs ? `<div class="muted chico">${esc(c.obs)}</div>` : ''}${matNombre(c)}`)}${td(P.fecha(c.inicio))}${td(c.fin ? P.fecha(c.fin) : etq('en curso', 'acc'))}${td(k.ciclo != null ? `${k.ciclo} d` : k.transc != null ? `<span class="muted">${k.transc} d…</span>` : '—', 1)}${td(c.pedidos ?? '—', 1)}${td(c.entregados ?? '—', 1)}${td(k.ex == null ? '—' : etq(pc(k.ex), k.ex < 0.95 ? 'warn' : 'ok'), 1)}${td(k.ah == null ? '—' : `${pc(k.ah)}${c.pIni && c.pCompra ? `<div class="muted chico">${P.pesos(c.pIni - c.pCompra)}</div>` : ''}`, 1)}<td><button class="btn mini" data-c="editcom" data-id="${esc(c.id)}">Editar</button></td></tr>`; }),
          'Sin requerimientos con estos filtros.')}</section>`;
  }

  // ---------- obras, DT y datos ----------
  function importar() {
    return `<section class="card"><h2>Importar datos</h2>
        <p style="margin-top:0">Elegí <b>coordinacion-obras-datos.json</b> o el export completo <b>coordinacion-obras-proyecto.json</b>. Reemplaza lo que haya en este navegador. Los datos quedan solo acá: no se suben a ningún servidor.</p>
        <label class="btn primario" style="cursor:pointer">Elegir archivo JSON<input type="file" id="c-archivo" accept=".json,application/json" hidden></label>
        ${aviso ? `<p class="err-msg">${esc(aviso)}</p>` : ''}</section>`;
  }
  function obras() {
    const filas = S.obras.map(o => `<tr>${td(`<b>${esc(o.id)}</b>`)}
      <td><input type="text" class="c-texto" id="c-onombre-${esc(o.id)}" data-c="onombre" data-id="${esc(o.id)}" value="${esc(o.nombre)}" aria-label="Nombre de ${esc(o.id)}" style="min-width:220px"></td>
      <td><div class="checks">${S.dts.map(d => `<label><input type="checkbox" id="c-odt-${esc(o.id)}-${esc(d.id)}" data-c="odt" data-id="${esc(o.id)}" data-dt="${esc(d.id)}" ${o.dts.includes(d.id) ? 'checked' : ''}> ${esc(d.nombre)}</label>`).join('')}</div></td>
      <td><label class="checks"><input type="checkbox" id="c-oact-${esc(o.id)}" data-c="oact" data-id="${esc(o.id)}" ${o.activa ? 'checked' : ''}> Activa</label></td></tr>`);
    const pesos = BLOQUES.reduce((s, [k]) => s + (S.cfg.w[k] || 0), 0);
    return `<section class="card" style="margin-bottom:14px"><h2>Obras y DT</h2>
        <p class="muted chico" style="margin-top:-6px">Solo las obras activas entran al resumen y al panel. Una obra puede tener más de un DT.</p>
        ${tabla([{ t: 'Código' }, { t: 'Obra' }, { t: 'DT a cargo' }, { t: 'Estado' }], filas)}
        <form id="c-form-obra" class="filtros" style="margin:12px 0 0">
          <input type="text" id="c-nueva-obra-id" placeholder="Código (ej. NV)" aria-label="Código de la obra nueva" required style="width:150px">
          <input type="text" id="c-nueva-obra-nombre" placeholder="Nombre de la obra" aria-label="Nombre de la obra nueva" required>
          <button class="btn" type="submit">Agregar obra</button></form>
        <form id="c-form-dt" class="filtros" style="margin:8px 0 0">
          <input type="text" id="c-nuevo-dt" placeholder="Nombre y apellido" aria-label="Nombre del DT nuevo" required>
          <button class="btn" type="submit">Agregar DT</button></form>
        ${aviso ? `<p class="err-msg">${esc(aviso)}</p>` : ''}</section>
      <section class="card" style="margin-bottom:14px"><h2>Parámetros de evaluación</h2>
        <p class="muted chico" style="margin-top:-6px">Conforme desde la meta, en alerta desde el piso, no conforme por debajo. Los pesos no necesitan sumar 100 (hoy suman ${Math.round(pesos * 100)}).</p>
        <div class="form">${BLOQUES.map(([k, n]) => `<div class="campo"><label for="c-peso-${esc(k)}">Peso ${esc(n)} (%)</label><input type="number" min="0" max="100" id="c-peso-${esc(k)}" data-c="peso" data-k="${esc(k)}" value="${Math.round((S.cfg.w[k] || 0) * 100)}"></div>`).join('')}
          <div class="campo"><label for="c-meta">Meta de conformidad (%)</label><input type="number" min="0" max="100" id="c-meta" data-c="cfg" data-k="meta" value="${Math.round(S.cfg.meta * 100)}"></div>
          <div class="campo"><label for="c-alerta">Piso de alerta (%)</label><input type="number" min="0" max="100" id="c-alerta" data-c="cfg" data-k="alerta" value="${Math.round(S.cfg.alerta * 100)}"></div></div></section>
      <div class="grilla-2">
        ${importar()}
        <section class="card"><h2>Datos en este navegador</h2>
          <div class="pila" style="gap:6px">
            <div class="fila-dato"><span>Obras</span><b>${S.obras.length} (${activas().length} activas)</b></div>
            <div class="fila-dato"><span>Meses con controles</span><b>${[...new Set(Object.keys(S.checks).map(k => k.split('|')[1]))].sort().map(P.mes).join(', ') || '—'}</b></div>
            <div class="fila-dato"><span>Desvíos · compras</span><b>${S.desvios.length} · ${S.compras.length}</b></div>
            <div class="fila-dato"><span>El panel usa</span><b>${E && E.reales ? 'tus obras reales' : 'los datos de ejemplo'}</b></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            ${P.CFG.ARTIFACT ? '' : '<button class="btn mini" data-c="exportar">Descargar copia (.json)</button>'}
            <button class="btn mini" data-c="modo">${E && E.reales ? 'Ver los datos de ejemplo en el panel' : 'Usar mis obras en el panel'}</button>
            <button class="btn mini plano" data-c="${form && form.kind === 'limpiar' ? 'limpiar2' : 'limpiar'}">${form && form.kind === 'limpiar' ? 'Confirmar: borrar todo de este navegador' : 'Borrar datos de este navegador'}</button></div>
          ${P.CFG.ARTIFACT ? '<p class="muted chico" style="margin:10px 0 0">Para descargar una copia, abrí el panel en tu PC.</p>' : ''}</section>
      </div>`;
  }

  // ---------- entrada ----------
  function vista(tab, param, estado) {
    E = estado || E;
    cargar();
    const t = tab === 'controles' ? 'carga' : TABS.some(([k]) => k === tab) ? tab : 'resumen';
    const conMes = S && ['resumen', 'carga', 'indicadores'].includes(t);
    const cab = `<div class="cab"><div><h1>Coordinación de obras</h1><p>Evaluación de los DT, desvíos, indicadores y compras, con tu planilla de coordinación.</p></div>${conMes ? `<div class="filtros" style="margin:0">${selMes()}</div>` : ''}</div>`;
    const tabs = `<nav class="tabs" aria-label="Coordinación">${TABS.map(([k, n]) => `<a href="#coord.${k}" class="${k === t ? 'activo' : ''}">${esc(n)}</a>`).join('')}</nav>`;
    if (!S) return cab + importar();
    if (!per || !meses().includes(per)) {
      const cnt = {};
      Object.keys(S.checks).forEach(k => { const m = k.split('|')[1]; cnt[m] = (cnt[m] || 0) + 1; });
      const buenos = Object.keys(cnt).filter(m => cnt[m] >= Math.ceil(activas().length / 2)).sort();
      per = buenos.slice(-1)[0] || meses().slice(-1)[0];
    }
    const cuerpo = { resumen, carga: () => carga(param), desvios, indicadores, compras, obras }[t]();
    return cab + tabs + cuerpo;
  }

  async function redibujar() {
    const y = window.scrollY;
    await refrescar();
    window.scrollTo(0, y);
  }
  const obraActual = () => (document.getElementById('c-obra') || {}).value;
  // Actualiza solo las listas automáticas del informe, sin tocar lo que se está escribiendo.
  const autoInforme = obra => BLOQUES.forEach(([k]) => ['dt', 'obra'].forEach(dest => {
    const el = document.getElementById(`c-auto-${dest}-${k}`);
    if (el) el.innerHTML = autoLista(obra, k, dest);
  }));

  let instalado = false;
  function montar(refrescarPanel, estado) {
    refrescar = refrescarPanel;
    E = estado || E;
    if (instalado) return;
    instalado = true;
    const v = document.getElementById('vista');
    const enCoord = () => location.hash.startsWith('#coord');

    v.addEventListener('click', e => {
      const b = e.target.closest('[data-c]');
      if (!b || !enCoord() || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA' || (b.tagName === 'INPUT' && b.type !== 'checkbox')) return;
      const a = b.dataset.c;
      const tocar = () => { guardar(); redibujar(); };
      if (a === 'celda' || a === 'todo' || a === 'aplicar') {
        const obra = obraActual();
        const c = ck(obra, per);
        const poner = (n, wi, val, soloVacias) => {
          const fila = c.i[n] = c.i[n] || [];
          while (fila.length <= wi) fila.push(null);
          if (soloVacias && fila[wi] != null) return;
          fila[wi] = typeof val === 'function' ? val(fila[wi]) : val;
        };
        if (a === 'celda') poner(+b.dataset.n, +b.dataset.w, x => (x == null ? 1 : x === 1 ? 0 : null));
        if (a === 'todo') ITEMS.forEach(it => { if (aplica(it, +b.dataset.w)) poner(it.n, +b.dataset.w, 1, true); });
        if (a === 'aplicar') Object.entries(sugerencias(obra, per)).forEach(([n, ws]) => Object.entries(ws).forEach(([wi, val]) => poner(+n, +wi, val, true)));
        tocar();
      } else if (a === 'flag') {
        const d = S.desvios.find(x => x.id === b.dataset.id);
        const f = b.dataset.f;
        d[f] = !d[f] ? 'si' : d[f] === 'si' ? 'no' : '';
        tocar();
      } else if (a === 'nuevodes' || a === 'editdes') {
        form = { kind: 'desvio', id: a === 'editdes' ? b.dataset.id : null };
        if (location.hash !== '#coord.desvios') { location.hash = 'coord.desvios'; return; }
        redibujar().then(() => document.getElementById('c-form-desvio').scrollIntoView({ block: 'start' }));
      } else if (a === 'nuevacom' || a === 'editcom') {
        form = { kind: 'compra', id: a === 'editcom' ? b.dataset.id : null };
        redibujar().then(() => document.getElementById('c-form-compra').scrollIntoView({ block: 'start' }));
      } else if (a === 'cancelar') { form = null; redibujar(); }
      else if (a === 'borrar') { form.borrar = true; redibujar(); }
      else if (a === 'borrar2') {
        if (form.kind === 'desvio') S.desvios = S.desvios.filter(x => x.id !== form.id);
        else S.compras = S.compras.filter(x => x.id !== form.id);
        form = null; tocar();
      } else if (a === 'odt') {
        const o = S.obras.find(x => x.id === b.dataset.id);
        o.dts = b.checked ? [...new Set([...o.dts, b.dataset.dt])] : o.dts.filter(x => x !== b.dataset.dt);
        tocar();
      } else if (a === 'oact') {
        S.obras.find(x => x.id === b.dataset.id).activa = b.checked;
        tocar();
      } else if (a === 'modo') {
        P.llamar('modo', { modo: E && E.reales ? 'ejemplo' : 'reales' }).then(redibujar);
      } else if (a === 'limpiar') { form = { kind: 'limpiar' }; redibujar(); }
      else if (a === 'limpiar2') { P.local.borrar(CLAVE); S = null; per = null; form = null; redibujar(); }
      else if (a === 'exportar') {
        const l = document.createElement('a');
        l.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
        l.download = `coordinacion-obras-datos-${hoy()}.json`;
        l.click();
        setTimeout(() => URL.revokeObjectURL(l.href), 1000);
      }
    });

    v.addEventListener('change', async e => {
      const t = e.target;
      if (!enCoord()) return;
      if (t.id === 'c-mes') { per = t.value; redibujar(); return; }
      if (t.id === 'c-obra') { location.hash = `coord.carga.${t.value}`; return; }
      if (t.id === 'c-archivo') {
        try {
          const d = normalizar(JSON.parse(await t.files[0].text()));
          if (!d) throw new Error('formato');
          S = d; per = null; aviso = ''; guardar();
          await P.llamar('modo', { modo: 'reales' });
          if (location.hash === '#coord.resumen') redibujar(); else location.hash = 'coord.resumen';
        } catch (err) {
          aviso = 'Ese archivo no tiene el formato de la app de coordinación (le faltan "obras" o "checks").';
          redibujar();
        }
        return;
      }
      const a = t.dataset.c;
      if (!a) return;
      const obra = obraActual();
      if (a === 'obs') {
        const c = ck(obra, per);
        if (t.value.trim()) c.o[t.dataset.n] = t.value.trim(); else delete c.o[t.dataset.n];
        guardar(); autoInforme(obra);
      } else if (a === 'dest') {
        ck(obra, per).d[t.dataset.n] = t.value;
        guardar(); autoInforme(obra);
      } else if (a === 'txt') {
        const x = inf(obra, per);
        (x.txt[t.dataset.b] = x.txt[t.dataset.b] || {})[t.dataset.f] = t.value;
        guardar();
      } else if (a === 'obsdt') {
        const o = S.obsDT[per] || (S.obsDT[per] = {});
        if (t.value.trim()) o[t.dataset.id] = t.value; else delete o[t.dataset.id];
        guardar();
      } else if (a === 'ind' || a === 'indtxt') {
        const x = inf(t.dataset.o, per);
        const reg = x.ind[t.dataset.k] = x.ind[t.dataset.k] || {};
        reg[t.dataset.f] = a === 'ind' ? num(t.value) : t.value.trim();
        guardar();
        const celda = document.getElementById(`c-eval-${t.dataset.o}-${t.dataset.k}`);
        if (celda) celda.innerHTML = evalInd(t.dataset.o, t.dataset.k);
      } else if (a === 'estado') {
        S.desvios.find(x => x.id === t.dataset.id).estado = t.value;
        guardar(); redibujar();
      } else if (a === 'fdes') { fDes[t.dataset.k] = t.value; redibujar(); }
      else if (a === 'fcom') { fCom[t.dataset.k] = t.value; redibujar(); }
      else if (a === 'fcobra') {
        // el selector de materiales depende de la obra elegida
        const sel = document.getElementById('fc-mat');
        const mats = materialesDe(t.value);
        const campo = sel.parentElement;
        campo.innerHTML = `<label for="fc-mat">Material del cronograma</label>${mats.length ? `<select id="fc-mat" name="material">${op([['', 'Sin vincular'], ...mats], '')}</select>` : '<input type="text" id="fc-mat" disabled value="La obra no tiene cronograma con materiales en el panel">'}`;
      } else if (a === 'onombre') {
        if (t.value.trim()) { S.obras.find(x => x.id === t.dataset.id).nombre = t.value.trim(); guardar(); }
      } else if (a === 'peso') {
        S.cfg.w[t.dataset.k] = Math.max(0, Number(t.value) || 0) / 100;
        guardar(); redibujar();
      } else if (a === 'cfg') {
        S.cfg[t.dataset.k] = Math.min(100, Math.max(0, Number(t.value) || 0)) / 100;
        guardar(); redibujar();
      }
    });

    v.addEventListener('submit', e => {
      if (!enCoord()) return;
      const f = e.target;
      const val = id => (document.getElementById(id) || {}).value || '';
      if (f.id === 'c-form-desvio') {
        e.preventDefault();
        const x = Object.fromEntries(new FormData(f));
        const d = { id: form.id || uid(), fecha: x.fecha, obra: x.obra, evento: x.evento.trim(), tipo: x.tipo, detecta: x.detecta, impDias: num(x.impDias), plan: x.plan.trim(),
          fechaPA: x.fechaPA || null, resp: x.resp.trim(), estado: x.estado, prio: x.prio, retrab: x.retrab || '', paral: x.paral || '' };
        const i = S.desvios.findIndex(y => y.id === d.id);
        if (i >= 0) Object.assign(S.desvios[i], d); else S.desvios.push(d);
        form = null; guardar(); redibujar();
      } else if (f.id === 'c-form-compra') {
        e.preventDefault();
        const x = Object.fromEntries(new FormData(f));
        const c = { id: form.id || uid(), obra: x.obra, req: x.req.trim(), desc: x.desc.trim(), material: x.material || '', inicio: x.inicio, fin: x.fin || null,
          pedidos: num(x.pedidos), entregados: num(x.entregados), pIni: num(x.pIni), pCompra: num(x.pCompra), obs: x.obs.trim() };
        const i = S.compras.findIndex(y => y.id === c.id);
        if (i >= 0) S.compras[i] = c; else S.compras.push(c);
        form = null; guardar(); redibujar();
      } else if (f.id === 'c-form-obra') {
        e.preventDefault();
        const id = val('c-nueva-obra-id').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        const nombre = val('c-nueva-obra-nombre').trim();
        aviso = !id ? 'El código solo puede tener letras, números y guiones.' : S.obras.some(o => o.id === id) ? `Ya hay una obra con el código ${id}.` : '';
        if (!aviso) S.obras.push({ id, nombre, dts: [], activa: true });
        guardar(); redibujar();
      } else if (f.id === 'c-form-dt') {
        e.preventDefault();
        const nombre = val('c-nuevo-dt').trim();
        if (nombre) { S.dts.push({ id: 'dt' + uid(), nombre }); aviso = ''; guardar(); redibujar(); }
      }
    });
  }

  return { vista, montar };
})();
