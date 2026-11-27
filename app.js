/* Mi AION UT · Registro de cargas
 * App estática (HTML + CSS + JS) — los datos se guardan en el navegador (localStorage).
 * Usa Ajustes → Exportar respaldo para llevar tus datos a otro dispositivo.
 */
'use strict';
(() => {
  // ---------------------------------------------------------------------------
  // Datos por defecto
  // ---------------------------------------------------------------------------
  const STORE_KEY = 'aionut-cargas.v1';

  // Ficha pública del GAC AION UT Elite (Colombia, nov-2026). Editable en Ajustes.
  const DEFAULT_CAR = {
    nombre: 'GAC AION UT Elite',
    modelo: '2027',
    placa: 'WXN839',
    color: 'Blanco',
    bateriaKwh: 44.12,
    quimica: 'LFP',
    autonomiaKm: 400,
    ciclo: 'NEDC',
    potenciaKw: 100,
    potenciaHp: 134,
    torqueNm: 145,
    acMaxKw: 6.6,
    dcMaxKw: '',          // por confirmar en el manual
    conector: 'CCS2 (Tipo 2 para AC)',
    consumoKwh100: 13     // consumo real estimado; se recalcula con tus odómetros
  };

  const DEFAULT_PREFS = {
    efAC: 90,        // % de la energía cobrada que llega a la batería en AC
    efDC: 95,        // idem en DC
    precioGalon: '', // para comparar con gasolina
    kmGalon: 35      // rendimiento de referencia (Stepway 2021)
  };

  const CONNECTORS = ['Tipo 2', 'CCS2', 'Toma doméstica', 'GB/T AC', 'GB/T DC', 'CHAdeMO', 'Tipo 1 (J1772)', 'CCS1'];
  const COMPATIBLE = ['Tipo 2', 'CCS2', 'Toma doméstica'];

  const SEED_DATE = '2000-01-01T00:00:00.000Z';
  const iso = () => new Date().toISOString();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function seedStations() {
    const verify = 'Dato tomado de una app de terceros: verifica conector y precio en el sitio.';
    // IDs fijos y fecha antigua: así los datos iniciales no se duplican al sincronizar varios dispositivos
    const mk = (sid, nombre, operador, direccion, chargers, notas = verify, extra = {}) => ({
      id: 'seed-' + sid, nombre, operador, direccion, ciudad: 'Cali', mapsUrl: '', notas, ...extra,
      cargadores: chargers.map((c, i) => ({ id: `seed-${sid}-${i + 1}`, nombre: '', cargoFijo: 0, ...c })),
      actualizado: SEED_DATE
    });
    return [
      mk('casa', 'Casa – Harika', 'EMCALI', 'Parqueadero sótano, apto 105', [
        { nombre: 'Cargador portátil', corriente: 'AC', conector: 'Toma doméstica', potenciaKw: 3.5, precioKwh: 900 }
      ], 'Precio de referencia: cámbialo por el valor del kWh de tu factura EMCALI.', { esCasa: true }),
      mk('jardin-plaza', 'Punto de carga Jardín Plaza', '', 'Calle 25, Urb. San Joaquín, Comuna 17', [
        { corriente: 'AC', conector: 'Tipo 2', potenciaKw: 11, precioKwh: 0 }
      ]),
      mk('aventura-plaza', 'Aventura Plaza', 'Electrolineras de Colombia', 'Cra. 100 #15A-61, Comuna 17', [
        { corriente: 'AC', conector: 'Tipo 2', potenciaKw: 7, precioKwh: 0 }
      ]),
      mk('electrolandia', 'Electrolandia', '', 'Carrera 90, Urb. San Joaquín, Comuna 17', [
        { corriente: 'AC', conector: 'Tipo 2', potenciaKw: 11, precioKwh: 0 }
      ]),
      mk('pronta-vivero', 'Pronta Plaza Vivero', 'Electrolineras de Colombia', 'Tienda D1, Calle 55, Vivero Parque Residencial', [
        { corriente: 'AC', conector: 'Tipo 2', potenciaKw: 7, precioKwh: 0 }
      ]),
      mk('terpel-canasgordas', 'Terpel Voltex Cañasgordas', 'Terpel Voltex', 'Calle 18, Parcelaciones Pance, Comuna 22', [
        { corriente: 'DC', conector: 'CCS2', potenciaKw: 80, precioKwh: 1750 }
      ], 'Precio de referencia (Terpel anunció $1.650–1.800/kWh). Confírmalo en la app Terpel Voltex.')
    ];
  }

  const defaultState = () => ({
    version: 1,
    car: { ...DEFAULT_CAR },
    prefs: { ...DEFAULT_PREFS },
    stations: seedStations(),
    charges: [],
    tombstones: { charges: [], stations: [] }, // borrados pendientes de propagar a otros dispositivos
    configActualizado: ''
  });

  // ---------------------------------------------------------------------------
  // Almacenamiento
  // ---------------------------------------------------------------------------
  function normalize(s) {
    const d = defaultState();
    return {
      version: 1,
      car: { ...d.car, ...(s && s.car) },
      prefs: { ...d.prefs, ...(s && s.prefs) },
      stations: Array.isArray(s && s.stations) ? s.stations : d.stations,
      charges: Array.isArray(s && s.charges) ? s.charges : [],
      tombstones: {
        charges: (s && s.tombstones && Array.isArray(s.tombstones.charges)) ? s.tombstones.charges : [],
        stations: (s && s.tombstones && Array.isArray(s.tombstones.stations)) ? s.tombstones.stations : []
      },
      configActualizado: (s && s.configActualizado) || ''
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? normalize(JSON.parse(raw)) : defaultState();
    } catch (e) {
      return defaultState();
    }
  }

  let state = load();

  function saveLocal() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('No se pudo guardar en este navegador. Exporta un respaldo.');
    }
  }
  /** Guarda en el navegador y programa la sincronización con Google Sheets. */
  function save() {
    saveLocal();
    scheduleSync();
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const money = n => COP.format(Math.round(n || 0));
  const fmt = (n, d = 1) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: d }).format(n || 0);
  const pad = n => String(n).padStart(2, '0');
  const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const monthKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const parseLocal = s => { const [d, t = '00:00'] = String(s).split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, (m || 1) - 1, dd || 1, h || 0, mi || 0); };
  const fmtDate = s => parseLocal(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDateTime = s => parseLocal(s).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const fmtMonth = ym => { const t = parseLocal(ym + '-01').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const fmtDur = min => {
    if (!min || !Number.isFinite(min)) return '—';
    const m = Math.round(min);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
  };

  const ICON = {
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/></svg>',
    battery: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 10v4M10 10v4"/></svg>',
    road: '<svg viewBox="0 0 24 24"><path d="M5 21 9 3M19 21 15 3M12 6v2M12 11v2M12 16v2"/></svg>',
    gauge: '<svg viewBox="0 0 24 24"><path d="M12 14l4-4"/><path d="M3.5 18a9 9 0 1 1 17 0"/></svg>',
    torque: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
    plug: '<svg viewBox="0 0 24 24"><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    nav: '<svg viewBox="0 0 24 24"><path d="m3 11 18-8-8 18-2-8z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }

  const stationById = id => state.stations.find(s => s.id === id);
  const chargerOf = (st, cid) => st && (st.cargadores || []).find(c => c.id === cid);

  // ---------------------------------------------------------------------------
  // Cálculos
  // ---------------------------------------------------------------------------
  /** Calcula energía, tiempo y costo de una carga. */
  function calcCharge({ socIni, socFin, corriente, potenciaKw, precioKwh, cargoFijo, kwhManual, usarManual }) {
    const cap = num(state.car.bateriaKwh);
    const ini = clamp(num(socIni), 0, 100), fin = clamp(num(socFin), 0, 100);
    const delta = Math.max(0, fin - ini);
    const kwhBateria = cap * delta / 100;
    const ef = clamp(corriente === 'DC' ? num(state.prefs.efDC) : num(state.prefs.efAC), 50, 100) / 100;
    const manual = usarManual && num(kwhManual) > 0;
    const kwhCobrados = manual ? num(kwhManual) : kwhBateria / ef;

    // Potencia efectiva: la menor entre cargador y lo que acepta el carro
    const carMax = corriente === 'DC' ? num(state.car.dcMaxKw) : num(state.car.acMaxKw);
    const charger = num(potenciaKw);
    let p = charger > 0 ? charger : carMax;
    if (carMax > 0 && p > 0) p = Math.min(p, carMax);

    let minutos = 0;
    if (p > 0 && delta > 0) {
      if (corriente === 'DC') {
        // En DC la potencia baja bastante después de ~80 %
        const a = Math.max(0, Math.min(fin, 80) - ini);
        const b = Math.max(0, fin - Math.max(ini, 80));
        minutos = ((cap * a / 100 / ef) / p + (cap * b / 100 / ef) / (p * 0.35)) * 60;
      } else {
        minutos = (kwhBateria / ef) / p * 60;
      }
    }
    const costo = kwhCobrados * num(precioKwh) + num(cargoFijo);
    return { kwhBateria, kwhCobrados, ef, potenciaEf: p, minutos, costo, delta };
  }

  function sortedCharges() {
    return [...state.charges].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }

  function computeStats() {
    const ch = sortedCharges();
    const sum = list => list.reduce((a, c) => ({
      costo: a.costo + num(c.costo),
      kwhB: a.kwhB + num(c.kwhBateria),
      kwhC: a.kwhC + num(c.kwhCobrados),
      n: a.n + 1
    }), { costo: 0, kwhB: 0, kwhC: 0, n: 0 });

    const tot = sum(ch);
    const mes = sum(ch.filter(c => String(c.fecha).startsWith(monthKey())));

    // Consumo real: energía usada entre dos cargas consecutivas con odómetro
    const cap = num(state.car.bateriaKwh);
    let e = 0, d = 0;
    for (let i = 0; i < ch.length - 1; i++) {
      const a = ch[i], b = ch[i + 1];
      const oa = num(a.odometro), ob = num(b.odometro);
      if (oa > 0 && ob > oa) {
        const used = (num(a.socFin) - num(b.socIni)) / 100 * cap;
        if (used > 0) { e += used; d += ob - oa; }
      }
    }
    const consumoReal = d >= 50 ? e / d * 100 : null;
    const consumo = consumoReal ?? num(state.car.consumoKwh100);

    const costoKwhB = tot.kwhB > 0 ? tot.costo / tot.kwhB : null;   // $ por kWh que llegó a la batería
    const costoKwhC = tot.kwhC > 0 ? tot.costo / tot.kwhC : null;   // $ por kWh cobrado
    const costoKm = costoKwhB != null && consumo > 0 ? costoKwhB * consumo / 100 : null;
    const gasKm = num(state.prefs.precioGalon) > 0 && num(state.prefs.kmGalon) > 0
      ? num(state.prefs.precioGalon) / num(state.prefs.kmGalon) : null;
    const kmEst = consumo > 0 ? tot.kwhB / consumo * 100 : 0;
    const ahorro = gasKm != null && costoKm != null ? (gasKm - costoKm) * kmEst : null;

    return { tot, mes, consumo, consumoReal, distReal: d, costoKwhB, costoKwhC, costoKm, gasKm, kmEst, ahorro, last: ch[ch.length - 1] };
  }

  // ---------------------------------------------------------------------------
  // Vistas
  // ---------------------------------------------------------------------------
  function specTile(icon, label, value, unit = '') {
    return `<div class="spec"><span class="k">${ICON[icon] || ''}${esc(label)}</span>
      <span class="v">${value}${unit ? ` <small>${esc(unit)}</small>` : ''}</span></div>`;
  }
  function statTile(label, value, hint = '', accent = false) {
    return `<div class="stat${accent ? ' accent' : ''}"><div class="k">${esc(label)}</div>
      <div class="v num">${value}</div>${hint ? `<div class="h">${esc(hint)}</div>` : ''}</div>`;
  }

  function chargeItem(c) {
    const st = stationById(c.estacionId);
    const name = st ? st.nombre : (c.estacionNombre || 'Electrolinera');
    const dc = c.corriente === 'DC';
    const ini = clamp(num(c.socIni), 0, 100), fin = clamp(num(c.socFin), 0, 100);
    return `<button class="charge-item" data-action="edit-charge" data-id="${esc(c.id)}">
      <span class="ci-icon${dc ? ' dc' : ''}">${st && st.esCasa ? ICON.home : ICON.bolt}</span>
      <span class="ci-main">
        <strong>${esc(name)}</strong>
        <span class="meta">${esc(fmtDateTime(c.fecha))} · ${esc(c.corriente || 'AC')} ${c.potenciaKw ? esc(fmt(c.potenciaKw)) + ' kW' : ''}</span>
        <span class="ci-bar"><i class="base" style="left:0;width:${ini}%"></i><i style="left:${ini}%;width:${Math.max(0, fin - ini)}%"></i></span>
      </span>
      <span class="ci-side">
        <strong class="num">${money(c.costo)}</strong>
        <span class="num">${fmt(ini, 0)}→${fmt(fin, 0)}% · ${fmt(c.kwhCobrados, 1)} kWh</span>
      </span>
    </button>`;
  }

  function viewInicio() {
    const car = state.car;
    const s = computeStats();
    const soc = s.last ? clamp(num(s.last.socFin), 0, 100) : null;
    const r = 52, C = 2 * Math.PI * r;
    const off = C * (1 - (soc ?? 0) / 100);
    const rangeNedc = soc != null ? num(car.autonomiaKm) * soc / 100 : null;
    const rangeReal = soc != null && s.consumo > 0 ? num(car.bateriaKwh) * soc / 100 / s.consumo * 100 : null;
    const recent = sortedCharges().reverse().slice(0, 3);

    return `
    <section class="card hero">
      <div class="hero-top">
        <div>
          <p class="eyebrow">Mi vehículo</p>
          <h2>${esc(car.nombre)}</h2>
          <p class="muted small" style="margin:2px 0 0">${esc([car.modelo, car.color, car.placa].filter(Boolean).join(' · '))}</p>
        </div>
        <span class="badge">${ICON.bolt.replace('<svg', '<svg style="width:14px;height:14px"')} Eléctrico</span>
      </div>
      <div class="gauge-row">
        <div class="ring" role="img" aria-label="Último nivel registrado ${soc ?? 'sin datos'}%">
          <svg viewBox="0 0 124 124"><circle class="track" cx="62" cy="62" r="${r}"/>
            <circle class="val" cx="62" cy="62" r="${r}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" stroke-linecap="round"/></svg>
          <div class="ring-label"><strong class="num">${soc != null ? fmt(soc, 0) + '%' : '—'}</strong><span>último nivel</span></div>
        </div>
        <div class="range-list">
          <div><strong class="num">${rangeReal != null ? '≈ ' + fmt(rangeReal, 0) + ' km' : '—'}</strong><span>Autonomía estimada real (${fmt(s.consumo, 1)} kWh/100 km)</span></div>
          <div><strong class="num">${rangeNedc != null ? fmt(rangeNedc, 0) + ' km' : '—'}</strong><span>Autonomía ciclo ${esc(car.ciclo)}</span></div>
          <div><span>${s.last ? 'Registrado el ' + esc(fmtDate(s.last.fecha)) : 'Registra tu primera carga para ver el nivel'}</span></div>
        </div>
      </div>
      <button class="btn primary block" data-action="new-charge">${ICON.bolt} Registrar carga</button>
    </section>

    <h3 class="section-title">Ficha técnica <a href="#ajustes">Editar</a></h3>
    <div class="spec-grid">
      ${specTile('battery', 'Batería', fmt(car.bateriaKwh, 2), 'kWh ' + car.quimica)}
      ${specTile('road', 'Autonomía', fmt(car.autonomiaKm, 0), 'km ' + car.ciclo)}
      ${specTile('gauge', 'Potencia', fmt(car.potenciaKw, 0) + ' kW', '/ ' + fmt(car.potenciaHp, 0) + ' HP')}
      ${specTile('torque', 'Torque', fmt(car.torqueNm, 0), 'Nm')}
      ${specTile('plug', 'Carga AC máx.', fmt(car.acMaxKw, 1), 'kW')}
      ${specTile('bolt', 'Carga DC máx.', num(car.dcMaxKw) ? fmt(car.dcMaxKw, 0) : 'Por confirmar', num(car.dcMaxKw) ? 'kW' : '')}
      ${specTile('plug', 'Conector', esc(car.conector))}
      ${specTile('battery', 'Energía 20→80 %', fmt(num(car.bateriaKwh) * 0.6, 1), 'kWh')}
    </div>

    <h3 class="section-title">Este mes</h3>
    <div class="stats">
      ${statTile('Gasto', money(s.mes.costo), '', true)}
      ${statTile('Energía', fmt(s.mes.kwhC, 1) + ' kWh', 'cobrados')}
      ${statTile('Cargas', s.mes.n)}
    </div>

    <h3 class="section-title">Histórico</h3>
    <div class="stats two">
      ${statTile('Total gastado', money(s.tot.costo), s.tot.n + ' cargas')}
      ${statTile('Energía cobrada', fmt(s.tot.kwhC, 1) + ' kWh', fmt(s.tot.kwhB, 1) + ' kWh a la batería')}
      ${statTile('Precio promedio', s.costoKwhC != null ? money(s.costoKwhC) : '—', 'por kWh cobrado')}
      ${statTile('Consumo', fmt(s.consumo, 1) + ' kWh/100 km', s.consumoReal != null ? 'real, ' + fmt(s.distReal, 0) + ' km medidos' : 'estimado (anota el odómetro)')}
      ${statTile('Costo por km', s.costoKm != null ? money(s.costoKm) : '—', s.gasKm != null ? 'gasolina: ' + money(s.gasKm) + '/km' : 'eléctrico')}
      ${statTile('Ahorro vs gasolina', s.ahorro != null ? money(s.ahorro) : '—', s.ahorro != null ? '≈ ' + fmt(s.kmEst, 0) + ' km recorridos' : 'pon el precio del galón en Ajustes', s.ahorro != null && s.ahorro > 0)}
    </div>

    <h3 class="section-title">Últimas cargas ${recent.length ? '<a href="#cargas">Ver todas</a>' : ''}</h3>
    ${recent.length ? `<div class="list">${recent.map(chargeItem).join('')}</div>`
      : `<div class="card empty">${ICON.bolt}<h3>Aún no hay cargas</h3><p>Toca “Registrar carga” cuando conectes el carro.</p></div>`}
    `;
  }

  function viewCargas() {
    const ch = sortedCharges().reverse();
    if (!ch.length) {
      return `<div class="card empty" style="margin-top:12px">${ICON.bolt}<h3>Sin cargas registradas</h3>
        <p>Registra el porcentaje inicial y final; la app calcula los kWh y el costo.</p>
        <button class="btn primary" data-action="new-charge">Registrar carga</button></div>`;
    }
    const groups = {};
    ch.forEach(c => { const k = String(c.fecha).slice(0, 7); (groups[k] = groups[k] || []).push(c); });
    return Object.keys(groups).map(k => {
      const g = groups[k];
      const costo = g.reduce((a, c) => a + num(c.costo), 0);
      const kwh = g.reduce((a, c) => a + num(c.kwhCobrados), 0);
      return `<div class="month-head"><h3>${esc(fmtMonth(k))}</h3>
        <span class="num">${g.length} ${g.length === 1 ? 'carga' : 'cargas'} · ${fmt(kwh, 1)} kWh · <b>${money(costo)}</b></span></div>
        <div class="list">${g.map(chargeItem).join('')}</div>`;
    }).join('');
  }

  let stationFilter = '';
  function viewElectrolineras() {
    return `
      <label class="search">${ICON.search}<input type="search" id="st-search" placeholder="Buscar por nombre, operador o dirección" value="${esc(stationFilter)}" autocomplete="off"></label>
      <div class="list" id="st-list" style="margin-top:12px">${stationCards()}</div>`;
  }

  function stationCards() {
    const q = stationFilter.trim().toLowerCase();
    const list = state.stations
      .filter(s => !q || [s.nombre, s.operador, s.direccion, s.ciudad].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.esCasa ? 1 : 0) - (a.esCasa ? 1 : 0) || a.nombre.localeCompare(b.nombre));
    if (!list.length) return `<div class="card empty">${ICON.pin}<h3>Sin resultados</h3><p>Agrega una electrolinera con el botón +.</p></div>`;
    return list.map(s => {
      const used = state.charges.filter(c => c.estacionId === s.id);
      const spent = used.reduce((a, c) => a + num(c.costo), 0);
      const hasDC = (s.cargadores || []).some(c => c.corriente === 'DC');
      const mapsHref = s.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.nombre, s.direccion, s.ciudad].filter(Boolean).join(', '))}`;
      const chips = (s.cargadores || []).map(c => {
        const bad = !COMPATIBLE.includes(c.conector);
        return `<span class="chip${c.corriente === 'DC' ? ' dc' : ''}${bad ? ' bad' : ''}">
          <b>${esc(c.corriente)}</b> ${esc(c.conector)} · ${fmt(c.potenciaKw, 1)} kW · ${num(c.precioKwh) ? money(c.precioKwh) + '/kWh' : 'precio s/d'}</span>`;
      }).join('');
      return `<article class="card station">
        <div class="station-head">
          <span class="ci-icon${hasDC ? ' dc' : ''}">${s.esCasa ? ICON.home : ICON.bolt}</span>
          <div style="min-width:0">
            <h3>${esc(s.nombre)}</h3>
            <p>${esc([s.operador, s.direccion, s.ciudad].filter(Boolean).join(' · '))}</p>
          </div>
        </div>
        <div class="chips">${chips || '<span class="muted small">Sin cargadores registrados</span>'}</div>
        ${s.notas ? `<p class="note">${esc(s.notas)}</p>` : ''}
        <div class="station-foot">
          <span class="grow num">${used.length ? `${used.length} ${used.length === 1 ? 'carga' : 'cargas'} · ${money(spent)} gastados` : 'Sin cargas aquí todavía'}</span>
          <a class="btn sm ghost" href="${esc(mapsHref)}" target="_blank" rel="noopener">${ICON.nav} Ir</a>
          <button class="btn sm ghost" data-action="edit-station" data-id="${esc(s.id)}">${ICON.edit} Editar</button>
          <button class="btn sm primary" data-action="charge-at" data-id="${esc(s.id)}">${ICON.bolt} Cargar</button>
        </div>
      </article>`;
    }).join('');
  }

  function field(label, name, value, { type = 'number', unit = '', hint = '', step = 'any', attrs = '' } = {}) {
    const input = `<input type="${type}" name="${name}" value="${esc(value)}" ${type === 'number' ? `step="${step}" inputmode="decimal"` : ''} ${attrs}>`;
    return `<label class="field"><span>${esc(label)}</span>
      ${unit ? `<div class="input-unit">${input}<em>${esc(unit)}</em></div>` : input}
      ${hint ? `<small class="hint">${esc(hint)}</small>` : ''}</label>`;
  }

  function viewAjustes() {
    const c = state.car, p = state.prefs;
    return `
    <div style="margin-top:8px">${viewSyncGroup()}</div>

    <h3 class="section-title">Vehículo y costos</h3>
    <form class="form" id="settings-form">
      <div class="group">
        <p class="group-title">Mi vehículo</p>
        ${field('Nombre', 'car.nombre', c.nombre, { type: 'text' })}
        <div class="grid-3">
          ${field('Modelo', 'car.modelo', c.modelo, { type: 'text' })}
          ${field('Color', 'car.color', c.color, { type: 'text' })}
          ${field('Placa', 'car.placa', c.placa, { type: 'text' })}
        </div>
        <div class="grid-2">
          ${field('Batería', 'car.bateriaKwh', c.bateriaKwh, { unit: 'kWh', hint: 'Base de todos los cálculos' })}
          ${field('Química', 'car.quimica', c.quimica, { type: 'text' })}
          ${field('Autonomía', 'car.autonomiaKm', c.autonomiaKm, { unit: 'km' })}
          ${field('Ciclo', 'car.ciclo', c.ciclo, { type: 'text' })}
          ${field('Potencia', 'car.potenciaKw', c.potenciaKw, { unit: 'kW' })}
          ${field('Potencia', 'car.potenciaHp', c.potenciaHp, { unit: 'HP' })}
          ${field('Torque', 'car.torqueNm', c.torqueNm, { unit: 'Nm' })}
          ${field('Carga AC máx.', 'car.acMaxKw', c.acMaxKw, { unit: 'kW' })}
          ${field('Carga DC máx.', 'car.dcMaxKw', c.dcMaxKw, { unit: 'kW', hint: 'Consúltalo en el manual' })}
          ${field('Consumo estimado', 'car.consumoKwh100', c.consumoKwh100, { unit: 'kWh/100', hint: 'Se reemplaza por el real cuando anotes odómetros' })}
        </div>
        ${field('Conector', 'car.conector', c.conector, { type: 'text' })}
      </div>

      <div class="group">
        <p class="group-title">Cálculo de costos</p>
        <div class="grid-2">
          ${field('Eficiencia AC', 'prefs.efAC', p.efAC, { unit: '%', hint: 'Energía cobrada que llega a la batería' })}
          ${field('Eficiencia DC', 'prefs.efDC', p.efDC, { unit: '%' })}
        </div>
        <p class="note">Al cargar se pierde algo de energía en calor. Con 90 %, subir 10 kWh en la batería cuesta ≈ 11,1 kWh en el medidor.</p>
      </div>

      <div class="group">
        <p class="group-title">Comparar con gasolina</p>
        <div class="grid-2">
          ${field('Precio del galón', 'prefs.precioGalon', p.precioGalon, { unit: 'COP' })}
          ${field('Rendimiento', 'prefs.kmGalon', p.kmGalon, { unit: 'km/gal' })}
        </div>
      </div>

      <button class="btn primary block" type="submit">Guardar ajustes</button>
    </form>

    <h3 class="section-title">Mis datos</h3>
    <div class="group settings-actions">
      <p class="note">${sync.url
        ? 'Tus datos están en este dispositivo y en tu hoja de Google. El respaldo .json es una copia extra.'
        : 'Tus datos se guardan solo en este navegador. Exporta un respaldo de vez en cuando, o conecta Google Sheets.'}</p>
      <button class="btn block" data-action="export-json">Exportar respaldo (.json)</button>
      <button class="btn block" data-action="import-json">Importar respaldo</button>
      <button class="btn block" data-action="export-csv">Exportar cargas a Excel (.csv)</button>
      <button class="btn danger block" data-action="reset">Borrar todo y empezar de cero</button>
    </div>
    <p class="note" style="margin:16px 4px">Ficha del carro con datos públicos (nov-2026). Los precios de electrolineras cambian: confírmalos en cada punto.</p>`;
  }


  // ---------------------------------------------------------------------------
  // Sincronización con Google Sheets (vía Google Apps Script)
  // ---------------------------------------------------------------------------
  const SYNC_KEY = 'aionut-sync.v1';
  function loadSync() {
    try { return { url: '', token: '', lastSync: '', lastError: '', pending: false, sheetName: '', ...JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') }; }
    catch (e) { return { url: '', token: '', lastSync: '', lastError: '', pending: false, sheetName: '' }; }
  }
  let sync = loadSync();
  const saveSync = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch (e) { /* sin espacio */ } };

  let syncTimer = null, syncing = false, syncAgain = false, renderDeferred = false, syncStatus = 'idle';

  function scheduleSync(delay = 1500) {
    if (!sync.url || !sync.token) return;
    sync.pending = true;
    saveSync();
    setSyncStatus('pending');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => doSync(), delay);
  }

  function setSyncStatus(st) {
    syncStatus = st;
    const pill = $('#sync-pill');
    if (!pill) return;
    pill.hidden = !sync.url;
    const label = {
      idle: 'Google Sheets', ok: 'Sincronizado', syncing: 'Sincronizando…',
      pending: 'Pendiente', offline: 'Sin conexión', error: 'Error al sincronizar'
    }[st] || '';
    pill.className = 'sync-pill ' + st;
    pill.querySelector('span').textContent = label;
    pill.title = st === 'error' && sync.lastError ? sync.lastError : (sync.lastSync ? 'Última sincronización: ' + fmtDateTimeIso(sync.lastSync) : label);
    const info = $('#sync-info');
    if (info) info.innerHTML = syncInfoHtml();
  }

  const fmtDateTimeIso = s => new Date(s).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  function syncInfoHtml() {
    if (!sync.url) return 'No conectado. Tus datos están solo en este dispositivo.';
    const parts = [];
    if (sync.sheetName) parts.push(`Hoja: <b>${esc(sync.sheetName)}</b>`);
    parts.push(sync.lastSync ? `Última sincronización: ${esc(fmtDateTimeIso(sync.lastSync))}` : 'Aún no se ha sincronizado');
    if (syncStatus === 'error' && sync.lastError) parts.push(`<span style="color:var(--danger)">Error: ${esc(sync.lastError)}</span>`);
    if (syncStatus === 'offline') parts.push('Sin conexión: se sincroniza cuando vuelva la señal');
    return parts.join('<br>');
  }

  /** Une dos listas por id; gana el registro con "actualizado" más reciente. */
  function mergeRecords(remote, localActive, localTombs) {
    const m = new Map();
    const put = r => {
      if (!r || !r.id) return;
      const c = m.get(r.id);
      if (!c || String(r.actualizado || '') > String(c.actualizado || '')) m.set(r.id, r);
    };
    (remote || []).forEach(put);
    localActive.forEach(put);
    localTombs.forEach(t => put({ id: t.id, actualizado: t.actualizado, eliminado: true }));
    const all = [...m.values()];
    return {
      active: all.filter(r => !r.eliminado).map(r => { const { eliminado, ...rest } = r; return rest; }),
      tombs: all.filter(r => r.eliminado).map(r => ({ id: r.id, actualizado: r.actualizado }))
    };
  }

  const NUMERIC_KEYS = ['bateriaKwh', 'autonomiaKm', 'potenciaKw', 'potenciaHp', 'torqueNm', 'acMaxKw', 'dcMaxKw', 'consumoKwh100', 'efAC', 'efDC', 'precioGalon', 'kmGalon'];
  const fixNums = obj => {
    const o = { ...obj };
    Object.keys(o).forEach(k => { if (NUMERIC_KEYS.includes(k)) o[k] = String(o[k]).trim() === '' ? '' : num(o[k]); });
    return o;
  };

  function applyRemote(data) {
    const before = JSON.stringify([state.charges, state.stations, state.car, state.prefs]);
    const ch = mergeRecords(data.charges, state.charges, state.tombstones.charges);
    const st = mergeRecords(data.stations, state.stations, state.tombstones.stations);
    state.charges = ch.active;
    state.tombstones.charges = ch.tombs;
    state.stations = st.active.map(x => ({ ...x, cargadores: Array.isArray(x.cargadores) ? x.cargadores : [] }));
    state.tombstones.stations = st.tombs;
    const cfg = data.config;
    if (cfg && cfg.car && String(cfg.actualizado || '') > String(state.configActualizado || '')) {
      state.car = { ...DEFAULT_CAR, ...fixNums(cfg.car) };
      state.prefs = { ...DEFAULT_PREFS, ...fixNums(cfg.prefs || {}) };
      state.configActualizado = cfg.actualizado;
    }
    saveLocal();
    if (before !== JSON.stringify([state.charges, state.stations, state.car, state.prefs])) refreshView();
  }

  /** Vuelve a dibujar la pantalla sin interrumpir un formulario abierto. */
  function refreshView() {
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#view form');
    if (!$('#sheet').hidden || typing) { renderDeferred = true; return; }
    render();
  }

  async function doSync({ manual = false } = {}) {
    if (!sync.url || !sync.token) return false;
    if (!navigator.onLine) { setSyncStatus('offline'); if (manual) toast('Sin conexión a internet'); return false; }
    if (syncing) { syncAgain = true; return false; }
    syncing = true;
    clearTimeout(syncTimer);
    setSyncStatus('syncing');
    const payload = {
      action: 'sync',
      token: sync.token,
      charges: [...state.charges, ...state.tombstones.charges.map(t => ({ ...t, eliminado: true }))],
      stations: [...state.stations, ...state.tombstones.stations.map(t => ({ ...t, eliminado: true }))],
      config: { car: state.car, prefs: state.prefs, actualizado: state.configActualizado || '' }
    };
    let ok = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(sync.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita la verificación CORS previa que Apps Script no soporta
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      let data;
      try { data = await res.json(); } catch (e) { throw new Error('La URL no respondió como el backend de la app. Revisa que termine en /exec y que el acceso sea "Cualquier persona".'); }
      if (!data.ok) throw new Error(data.error || 'Respuesta inválida');
      applyRemote(data);
      sync.lastSync = new Date().toISOString();
      sync.lastError = '';
      sync.pending = false;
      sync.sheetName = data.sheet || sync.sheetName;
      saveSync();
      setSyncStatus('ok');
      if (manual) toast(`Sincronizado con «${sync.sheetName}»`);
      ok = true;
    } catch (err) {
      sync.lastError = err.name === 'AbortError' ? 'La hoja tardó demasiado en responder' : (err.message === 'Failed to fetch' ? 'No se pudo contactar la URL' : err.message);
      saveSync();
      setSyncStatus('error');
      if (manual) toast('No se pudo sincronizar: ' + sync.lastError);
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; scheduleSync(300); }
    }
    return ok;
  }

  function viewSyncGroup() {
    return `
    <form class="group" id="sync-form" autocomplete="off">
      <p class="group-title">Google Sheets</p>
      <p class="note">Guarda tus cargas en una hoja de tu cuenta de Google y úsalas en el celular y el computador. La configuración está en el README (sección “Conectar con Google Sheets”).</p>
      ${field('URL de la aplicación web', 'url', sync.url, { type: 'url', attrs: 'placeholder="https://script.google.com/macros/s/…/exec"' })}
      <label class="field"><span>Clave</span><input type="password" name="token" value="${esc(sync.token)}" placeholder="La misma CLAVE de Code.gs"></label>
      <p class="note" id="sync-info">${syncInfoHtml()}</p>
      <div class="row-actions">
        ${sync.url ? '<button type="button" class="btn" data-action="sync-disconnect">Desconectar</button>' : ''}
        <button type="submit" class="btn primary">${sync.url ? 'Sincronizar' : 'Conectar'}</button>
      </div>
    </form>`;
  }

  async function submitSync(e) {
    e.preventDefault();
    const f = e.target;
    const url = f.elements.url.value.trim();
    const token = f.elements.token.value.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) { toast('Pega la URL que termina en /exec'); return; }
    if (!token) { toast('Escribe la clave'); return; }
    const isNew = url !== sync.url || token !== sync.token;
    const prev = { ...sync };
    if (isNew) sync = { ...sync, url, token, lastSync: '', lastError: '', sheetName: '' };
    saveSync();
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    const ok = await doSync({ manual: true });
    btn.disabled = false;
    if (!ok && isNew && !prev.url) { sync = { ...prev, url: '', token: '' }; saveSync(); setSyncStatus('idle'); }
    render();
  }

  // ---------------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------------
  const ROUTES = {
    inicio: { title: 'Mi carro', render: viewInicio, fab: null },
    cargas: { title: 'Cargas', render: viewCargas, fab: 'new-charge' },
    electrolineras: { title: 'Electrolineras', render: viewElectrolineras, fab: 'new-station' },
    ajustes: { title: 'Ajustes', render: viewAjustes, fab: null }
  };

  function currentRoute() {
    const r = location.hash.replace('#', '');
    return ROUTES[r] ? r : 'inicio';
  }

  function render() {
    const name = currentRoute();
    const route = ROUTES[name];
    $('#page-title').textContent = route.title;
    $('#page-sub').textContent = name === 'inicio' ? state.car.placa || '' :
      name === 'cargas' ? `${state.charges.length} registradas` :
      name === 'electrolineras' ? `${state.stations.length} guardadas` : '';
    $$('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === name));
    $('#view').innerHTML = route.render();
    const fab = $('#fab');
    fab.hidden = !route.fab;
    if (route.fab) {
      fab.dataset.action = route.fab;
      fab.setAttribute('aria-label', route.fab === 'new-station' ? 'Agregar electrolinera' : 'Registrar carga');
    }
    if (name === 'electrolineras') {
      $('#st-search').addEventListener('input', e => { stationFilter = e.target.value; $('#st-list').innerHTML = stationCards(); });
    }
    if (name === 'ajustes') {
      $('#settings-form').addEventListener('submit', saveSettings);
      $('#sync-form').addEventListener('submit', submitSync);
    }
    renderDeferred = false;
    setSyncStatus(syncStatus);
  }

  window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });

  // ---------------------------------------------------------------------------
  // Sheet (formularios)
  // ---------------------------------------------------------------------------
  function openSheet(title, html, onMount) {
    $('#sheet-title').textContent = title;
    $('#sheet-body').innerHTML = html;
    $('#sheet').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#sheet-body').scrollTop = 0;
    if (onMount) onMount($('#sheet-body'));
  }
  function closeSheet() {
    const wasOpen = !$('#sheet').hidden;
    $('#sheet').hidden = true;
    document.body.style.overflow = '';
    if (wasOpen && renderDeferred) render();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  // ----- Formulario de carga -----
  function openChargeForm(existing, presetStationId) {
    const c = existing || {};
    const last = sortedCharges().pop();
    const stId = c.estacionId || presetStationId || (state.stations.find(s => s.esCasa) || state.stations[0] || {}).id || '';
    const stOptions = state.stations.map(s => `<option value="${esc(s.id)}" ${s.id === stId ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('');
    const ini = c.socIni ?? 20;
    const fin = c.socFin ?? 80;

    const html = `
    <form class="form" id="charge-form" novalidate>
      <div class="group">
        <p class="group-title">Dónde y cuándo</p>
        ${field('Fecha y hora', 'fecha', c.fecha || nowLocal(), { type: 'datetime-local' })}
        <label class="field"><span>Electrolinera</span>
          <select name="estacionId">${stOptions || '<option value="">— Agrega una electrolinera —</option>'}</select></label>
        <label class="field"><span>Cargador</span><select name="cargadorId"></select>
          <small class="hint" id="cf-charger-hint"></small></label>
      </div>

      <div class="group">
        <p class="group-title">Nivel de batería</p>
        <div class="soc-row">
          <div class="soc-top"><span>Nivel inicial</span><b class="num" id="cf-ini-v">${ini}%</b></div>
          <input type="range" name="socIni" min="0" max="100" step="1" value="${ini}" aria-label="Nivel inicial">
        </div>
        <div class="soc-row">
          <div class="soc-top"><span>Cargar hasta</span><b class="num" id="cf-fin-v">${fin}%</b></div>
          <input type="range" name="socFin" min="0" max="100" step="1" value="${fin}" aria-label="Nivel final">
        </div>
        <div class="soc-bar" aria-hidden="true"><i class="cur" id="cf-bar-cur"></i><i class="add" id="cf-bar-add"></i></div>
        <div class="soc-legend"><span><i></i>Inicial · <b id="cf-l-ini">${ini}%</b></span><span><i class="o"></i>Final · <b id="cf-l-fin">${fin}%</b></span></div>
        <div class="warn-box" id="cf-warn" hidden>El nivel final debe ser mayor que el inicial.</div>
      </div>

      <div class="group">
        <p class="group-title">Precio</p>
        <div class="grid-2">
          ${field('Valor del kWh', 'precioKwh', c.precioKwh ?? '', { unit: 'COP' })}
          ${field('Cargo fijo / parqueo', 'cargoFijo', c.cargoFijo ?? 0, { unit: 'COP' })}
        </div>
        <label class="check"><input type="checkbox" name="usarManual" ${c.usarManual ? 'checked' : ''}> Tengo los kWh reales (del recibo o la app)</label>
        <div id="cf-manual" ${c.usarManual ? '' : 'hidden'}>
          ${field('kWh cobrados', 'kwhManual', c.kwhManual ?? '', { unit: 'kWh' })}
        </div>
      </div>

      <div class="result" aria-live="polite">
        <p class="eyebrow">Resultado</p>
        <div class="big num" id="cf-cost">$0</div>
        <div class="lines">
          <div class="line"><span>Energía a la batería</span><b class="num" id="cf-kwhb">—</b></div>
          <div class="line"><span id="cf-kwhc-l">Energía cobrada (con pérdidas)</span><b class="num" id="cf-kwhc">—</b></div>
          <div class="line"><span>Potencia de carga</span><b class="num" id="cf-pow">—</b></div>
          <div class="line"><span>Tiempo estimado</span><b class="num" id="cf-time">—</b></div>
          <div class="line"><span>Autonomía añadida (aprox.)</span><b class="num" id="cf-km">—</b></div>
        </div>
      </div>

      <div class="group">
        <p class="group-title">Opcional</p>
        ${field('Odómetro', 'odometro', c.odometro ?? '', { unit: 'km', hint: last && last.odometro && !existing ? `Último registrado: ${fmt(last.odometro, 0)} km. Con el odómetro la app calcula tu consumo real.` : 'Con el odómetro la app calcula tu consumo real.' })}
        <label class="field"><span>Notas</span><textarea name="notas" placeholder="Ej.: cargador ocupado, pagué con tarjeta…">${esc(c.notas || '')}</textarea></label>
      </div>

      <button class="btn primary block" type="submit" id="cf-save">${existing ? 'Guardar cambios' : 'Guardar carga'}</button>
      ${existing ? `<button class="btn danger block" type="button" data-action="delete-charge" data-id="${esc(c.id)}">${ICON.trash} Eliminar carga</button>` : ''}
    </form>`;

    openSheet(existing ? 'Editar carga' : 'Registrar carga', html, body => {
      const f = $('#charge-form', body);
      const el = n => f.elements[n];

      const fillChargers = (keepId, setPrice) => {
        const st = stationById(el('estacionId').value);
        const list = (st && st.cargadores) || [];
        el('cargadorId').innerHTML = list.length
          ? list.map(ch => `<option value="${esc(ch.id)}" ${ch.id === keepId ? 'selected' : ''}>${esc(chargerLabel(ch))}</option>`).join('')
          : '<option value="">Sin cargadores — edita la electrolinera</option>';
        if (setPrice) applyChargerPrice();
      };
      const currentCharger = () => chargerOf(stationById(el('estacionId').value), el('cargadorId').value);
      const applyChargerPrice = () => {
        const ch = currentCharger();
        if (ch) {
          el('precioKwh').value = num(ch.precioKwh) || '';
          el('cargoFijo').value = num(ch.cargoFijo) || 0;
        }
      };

      const update = () => {
        const ch = currentCharger();
        const ini = num(el('socIni').value), fin = num(el('socFin').value);
        $('#cf-ini-v').textContent = $('#cf-l-ini').textContent = ini + '%';
        $('#cf-fin-v').textContent = $('#cf-l-fin').textContent = fin + '%';
        el('socIni').style.setProperty('--p', ini + '%');
        el('socFin').style.setProperty('--p', fin + '%');
        $('#cf-bar-cur').style.width = ini + '%';
        $('#cf-bar-add').style.left = ini + '%';
        $('#cf-bar-add').style.width = Math.max(0, fin - ini) + '%';
        const bad = fin <= ini;
        $('#cf-warn').hidden = !bad;
        $('#cf-save').disabled = bad;
        $('#cf-manual').hidden = !el('usarManual').checked;

        const r = calcCharge({
          socIni: ini, socFin: fin,
          corriente: ch ? ch.corriente : 'AC',
          potenciaKw: ch ? ch.potenciaKw : 0,
          precioKwh: el('precioKwh').value, cargoFijo: el('cargoFijo').value,
          kwhManual: el('kwhManual').value, usarManual: el('usarManual').checked
        });
        $('#cf-cost').textContent = money(r.costo);
        $('#cf-kwhb').textContent = fmt(r.kwhBateria, 2) + ' kWh';
        $('#cf-kwhc').textContent = fmt(r.kwhCobrados, 2) + ' kWh';
        $('#cf-kwhc-l').textContent = el('usarManual').checked && num(el('kwhManual').value) > 0 ? 'Energía cobrada (real)' : `Energía cobrada (${fmt(r.ef * 100, 0)} % efic.)`;
        $('#cf-pow').textContent = r.potenciaEf ? fmt(r.potenciaEf, 1) + ' kW' : '—';
        $('#cf-time').textContent = fmtDur(r.minutos);
        const s = computeStats();
        $('#cf-km').textContent = s.consumo > 0 ? '≈ ' + fmt(r.kwhBateria / s.consumo * 100, 0) + ' km' : '—';

        let hint = '';
        if (ch) {
          if (!COMPATIBLE.includes(ch.conector)) hint = `⚠️ El conector ${ch.conector} no es compatible con tu carro (CCS2/Tipo 2).`;
          else if (ch.corriente === 'AC' && num(ch.potenciaKw) > num(state.car.acMaxKw) && num(state.car.acMaxKw) > 0)
            hint = `Tu carro acepta máx. ${fmt(state.car.acMaxKw, 1)} kW en AC, así que cargará a esa potencia.`;
          else if (!num(ch.precioKwh)) hint = 'Este cargador no tiene precio guardado: escríbelo abajo.';
        }
        $('#cf-charger-hint').textContent = hint;
      };

      fillChargers(c.cargadorId, !existing);
      if (existing) { el('precioKwh').value = c.precioKwh ?? ''; el('cargoFijo').value = c.cargoFijo ?? 0; }

      el('estacionId').addEventListener('change', () => { fillChargers(null, true); update(); });
      el('cargadorId').addEventListener('change', () => { applyChargerPrice(); update(); });
      f.addEventListener('input', update);
      f.addEventListener('change', update);
      update();

      f.addEventListener('submit', e => {
        e.preventDefault();
        const st = stationById(el('estacionId').value);
        const ch = currentCharger();
        const ini = num(el('socIni').value), fin = num(el('socFin').value);
        if (!st) { toast('Primero agrega una electrolinera'); return; }
        if (fin <= ini) { toast('El nivel final debe ser mayor que el inicial'); return; }
        const data = {
          socIni: ini, socFin: fin,
          corriente: ch ? ch.corriente : 'AC',
          potenciaKw: ch ? num(ch.potenciaKw) : 0,
          precioKwh: num(el('precioKwh').value),
          cargoFijo: num(el('cargoFijo').value),
          kwhManual: num(el('kwhManual').value) || '',
          usarManual: el('usarManual').checked
        };
        const r = calcCharge(data);
        const rec = {
          id: c.id || uid(),
          fecha: el('fecha').value || nowLocal(),
          estacionId: st.id,
          estacionNombre: st.nombre,
          cargadorId: ch ? ch.id : '',
          conector: ch ? ch.conector : '',
          ...data,
          kwhBateria: +r.kwhBateria.toFixed(3),
          kwhCobrados: +r.kwhCobrados.toFixed(3),
          minutosEst: Math.round(r.minutos),
          costo: Math.round(r.costo),
          odometro: num(el('odometro').value) || '',
          notas: el('notas').value.trim(),
          actualizado: iso()
        };
        const i = state.charges.findIndex(x => x.id === rec.id);
        if (i >= 0) state.charges[i] = rec; else state.charges.push(rec);
        save();
        closeSheet();
        render();
        toast(existing ? 'Carga actualizada' : `Carga guardada · ${money(rec.costo)}`);
      });
    });
  }

  const chargerLabel = ch => [ch.nombre, `${ch.corriente} ${ch.conector}`, `${fmt(ch.potenciaKw, 1)} kW`, num(ch.precioKwh) ? `${money(ch.precioKwh)}/kWh` : 'sin precio'].filter(Boolean).join(' · ');

  // ----- Formulario de electrolinera -----
  function chargerRow(ch = {}, i = 0) {
    const opt = (list, v) => list.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    return `<div class="charger-row" data-cid="${esc(ch.id || uid())}">
      <div class="cr-head"><b>Cargador ${i + 1}</b>
        <button type="button" class="btn sm danger" data-action="remove-charger-row">Quitar</button></div>
      ${field('Nombre o número (opcional)', 'c_nombre', ch.nombre || '', { type: 'text', attrs: 'placeholder="Ej.: Pistola 2"' })}
      <div class="grid-2">
        <label class="field"><span>Corriente</span><select name="c_corriente">${opt(['AC', 'DC'], ch.corriente || 'AC')}</select></label>
        <label class="field"><span>Conector</span><select name="c_conector">${opt(CONNECTORS, ch.conector || 'Tipo 2')}</select></label>
        ${field('Potencia', 'c_potencia', ch.potenciaKw ?? '', { unit: 'kW' })}
        ${field('Valor del kWh', 'c_precio', ch.precioKwh || '', { unit: 'COP' })}
      </div>
      ${field('Cargo fijo / parqueo (opcional)', 'c_fijo', ch.cargoFijo || '', { unit: 'COP', hint: 'Se suma a cada carga en este cargador' })}
    </div>`;
  }

  function openStationForm(existing) {
    const s = existing || { cargadores: [{}] };
    const html = `
    <form class="form" id="station-form" novalidate>
      <div class="group">
        <p class="group-title">Datos</p>
        ${field('Nombre', 'nombre', s.nombre || '', { type: 'text', attrs: 'required placeholder="Ej.: Terpel Voltex Pance"' })}
        ${field('Operador', 'operador', s.operador || '', { type: 'text', attrs: 'placeholder="Ej.: Terpel Voltex, Celsia, Enel X"' })}
        ${field('Dirección', 'direccion', s.direccion || '', { type: 'text' })}
        <div class="grid-2">
          ${field('Ciudad', 'ciudad', s.ciudad || 'Cali', { type: 'text' })}
          <label class="field"><span>¿Es mi casa?</span>
            <label class="check" style="min-height:46px"><input type="checkbox" name="esCasa" ${s.esCasa ? 'checked' : ''}> Sí</label></label>
        </div>
        ${field('Enlace de Google Maps (opcional)', 'mapsUrl', s.mapsUrl || '', { type: 'url', attrs: 'placeholder="https://maps.app.goo.gl/…"' })}
        <label class="field"><span>Notas</span><textarea name="notas" placeholder="Horario, forma de pago, app requerida…">${esc(s.notas || '')}</textarea></label>
      </div>

      <div class="group">
        <p class="group-title">Cargadores</p>
        <div id="charger-rows" class="form">${(s.cargadores || []).map(chargerRow).join('')}</div>
        <button type="button" class="btn block" data-action="add-charger-row">+ Agregar cargador</button>
      </div>

      <button class="btn primary block" type="submit">${existing ? 'Guardar cambios' : 'Guardar electrolinera'}</button>
      ${existing ? `<button class="btn danger block" type="button" data-action="delete-station" data-id="${esc(s.id)}">${ICON.trash} Eliminar electrolinera</button>` : ''}
    </form>`;

    openSheet(existing ? 'Editar electrolinera' : 'Nueva electrolinera', html, body => {
      const f = $('#station-form', body);
      f.addEventListener('submit', e => {
        e.preventDefault();
        const nombre = f.elements.nombre.value.trim();
        if (!nombre) { toast('Escribe el nombre'); f.elements.nombre.focus(); return; }
        const cargadores = $$('.charger-row', f).map(row => {
          const v = n => $(`[name="${n}"]`, row).value;
          return {
            id: row.dataset.cid,
            nombre: v('c_nombre').trim(),
            corriente: v('c_corriente'),
            conector: v('c_conector'),
            potenciaKw: num(v('c_potencia')),
            precioKwh: num(v('c_precio')),
            cargoFijo: num(v('c_fijo'))
          };
        });
        const esCasa = f.elements.esCasa.checked;
        const rec = {
          id: s.id || uid(),
          nombre,
          operador: f.elements.operador.value.trim(),
          direccion: f.elements.direccion.value.trim(),
          ciudad: f.elements.ciudad.value.trim(),
          mapsUrl: /^https?:\/\//i.test(f.elements.mapsUrl.value.trim()) ? f.elements.mapsUrl.value.trim() : '',
          notas: f.elements.notas.value.trim(),
          esCasa,
          cargadores,
          actualizado: iso()
        };
        if (esCasa) state.stations.forEach(x => { if (x.id !== rec.id && x.esCasa) { x.esCasa = false; x.actualizado = iso(); } });
        const i = state.stations.findIndex(x => x.id === rec.id);
        if (i >= 0) state.stations[i] = rec; else state.stations.push(rec);
        save();
        closeSheet();
        render();
        toast(existing ? 'Electrolinera actualizada' : 'Electrolinera guardada');
      });
    });
  }

  function renumberChargerRows() {
    $$('#charger-rows .charger-row').forEach((row, i) => { $('.cr-head b', row).textContent = `Cargador ${i + 1}`; });
  }

  // ---------------------------------------------------------------------------
  // Ajustes y respaldo
  // ---------------------------------------------------------------------------
  function saveSettings(e) {
    e.preventDefault();
    const f = e.target;
    const numeric = ['bateriaKwh', 'autonomiaKm', 'potenciaKw', 'potenciaHp', 'torqueNm', 'acMaxKw', 'dcMaxKw', 'consumoKwh100', 'efAC', 'efDC', 'precioGalon', 'kmGalon'];
    [...f.elements].forEach(input => {
      if (!input.name || !input.name.includes('.')) return;
      const [grp, key] = input.name.split('.');
      const raw = input.value.trim();
      state[grp][key] = numeric.includes(key) ? (raw === '' ? '' : num(raw)) : raw;
    });
    if (!num(state.car.bateriaKwh)) { state.car.bateriaKwh = DEFAULT_CAR.bateriaKwh; toast('La batería no puede quedar vacía'); }
    state.prefs.efAC = clamp(num(state.prefs.efAC) || 90, 50, 100);
    state.prefs.efDC = clamp(num(state.prefs.efDC) || 95, 50, 100);
    state.configActualizado = iso();
    save();
    render();
    toast('Ajustes guardados');
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  const today = () => nowLocal().slice(0, 10);

  function exportJSON() {
    download(`aion-cargas-respaldo-${today()}.json`, JSON.stringify({ ...state, exportado: new Date().toISOString() }, null, 2), 'application/json');
    toast('Respaldo descargado');
  }

  function exportCSV() {
    if (!state.charges.length) { toast('No hay cargas para exportar'); return; }
    const dec = n => (n === '' || n == null) ? '' : String(n).replace('.', ',');
    const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const head = ['Fecha', 'Electrolinera', 'Corriente', 'Conector', 'Potencia kW', '% inicial', '% final', 'kWh batería', 'kWh cobrados', 'Valor kWh', 'Cargo fijo', 'Costo', 'Tiempo est. min', 'Odómetro km', 'Notas'];
    const rows = sortedCharges().map(c => {
      const st = stationById(c.estacionId);
      return [q(String(c.fecha).replace('T', ' ')), q(st ? st.nombre : c.estacionNombre), c.corriente, q(c.conector), dec(c.potenciaKw),
        c.socIni, c.socFin, dec(c.kwhBateria), dec(c.kwhCobrados), c.precioKwh, c.cargoFijo, c.costo, c.minutosEst ?? '', c.odometro, q(c.notas)].join(';');
    });
    download(`aion-cargas-${today()}.csv`, '﻿' + [head.join(';'), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
    toast('CSV descargado');
  }

  $('#import-file').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.charges) || !Array.isArray(data.stations)) throw new Error('formato');
        if (!confirm(`El respaldo tiene ${data.charges.length} cargas y ${data.stations.length} electrolineras. ¿Reemplazar los datos actuales?`)) return;
        state = normalize(data);
        save();
        render();
        toast('Respaldo importado');
      } catch (err) {
        toast('El archivo no es un respaldo válido');
      }
    };
    reader.readAsText(file);
  });

  // ---------------------------------------------------------------------------
  // Acciones (delegación de clics)
  // ---------------------------------------------------------------------------
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const id = t.dataset.id;
    switch (t.dataset.action) {
      case 'new-charge':
        if (!state.stations.length) { toast('Primero agrega una electrolinera'); location.hash = '#electrolineras'; return; }
        openChargeForm(null);
        break;
      case 'charge-at':
        openChargeForm(null, id);
        break;
      case 'edit-charge':
        openChargeForm(state.charges.find(c => c.id === id));
        break;
      case 'delete-charge':
        if (confirm('¿Eliminar esta carga?')) {
          state.charges = state.charges.filter(c => c.id !== id);
          state.tombstones.charges.push({ id, actualizado: iso() });
          save(); closeSheet(); render(); toast('Carga eliminada');
        }
        break;
      case 'new-station':
        openStationForm(null);
        break;
      case 'edit-station':
        openStationForm(stationById(id));
        break;
      case 'delete-station': {
        const n = state.charges.filter(c => c.estacionId === id).length;
        if (confirm(n ? `Esta electrolinera tiene ${n} cargas. Las cargas se conservan con el nombre guardado. ¿Eliminarla?` : '¿Eliminar esta electrolinera?')) {
          state.stations = state.stations.filter(s => s.id !== id);
          state.tombstones.stations.push({ id, actualizado: iso() });
          save(); closeSheet(); render(); toast('Electrolinera eliminada');
        }
        break;
      }
      case 'add-charger-row': {
        const wrap = $('#charger-rows');
        wrap.insertAdjacentHTML('beforeend', chargerRow({}, wrap.children.length));
        wrap.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'remove-charger-row':
        t.closest('.charger-row').remove();
        renumberChargerRows();
        break;
      case 'sync-now':
        if (sync.url) doSync({ manual: true }); else location.hash = '#ajustes';
        break;
      case 'sync-disconnect':
        if (confirm('La app dejará de sincronizar. Tus datos quedan en este dispositivo y en la hoja. ¿Desconectar?')) {
          sync = { url: '', token: '', lastSync: '', lastError: '', pending: false, sheetName: '' };
          saveSync(); setSyncStatus('idle'); render(); toast('Google Sheets desconectado');
        }
        break;
      case 'close-sheet':
        closeSheet();
        break;
      case 'export-json': exportJSON(); break;
      case 'import-json': $('#import-file').click(); break;
      case 'export-csv': exportCSV(); break;
      case 'reset':
        if (confirm(sync.url
          ? 'Se borrarán los datos de este dispositivo. Como tienes Google Sheets conectado, se volverán a descargar desde tu hoja. ¿Continuar?'
          : 'Se borrarán todas tus cargas, electrolineras y ajustes de este navegador. ¿Continuar?')) {
          state = defaultState(); save(); render(); toast('Datos reiniciados');
        }
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // Inicio
  // ---------------------------------------------------------------------------
  render();

  if (sync.url) doSync();
  window.addEventListener('online', () => { if (sync.url) doSync(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sync.url && (!sync.lastSync || Date.now() - new Date(sync.lastSync) > 60000 || sync.pending)) doSync();
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
