// Prueba manual automatizada (Playwright) que genera docs/capturas/*.png y results.json.
// Uso:  npm i --no-save playwright && npx playwright install chromium
//       npm run dev   (en otra terminal, puerto 5173)
//       node scripts/e2e-capturas.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:5173';
import os from 'node:os';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../docs/capturas');
const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'cdc-e2e-'));
fs.mkdirSync(OUT, { recursive: true });

const results = []; // {caso, entrada, esperado, obtenido, ok}
const problems = [];
const consoleErrors = [];
const log = (...a) => console.log(...a);

function check(caso, entrada, esperado, obtenido, ok) {
  if (ok === undefined) ok = String(esperado) === String(obtenido);
  results.push({ caso, entrada, esperado: String(esperado), obtenido: String(obtenido), ok });
  log(ok ? 'OK  ' : 'FAIL', caso, '| esperado:', esperado, '| obtenido:', obtenido);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, locale: 'es-PE', timezoneId: 'America/Lima' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[console.error] ${m.text()}`); });
page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));

process.on('uncaughtException', async (e) => { console.log('FATAL', String(e.message).slice(0, 300), String(e.stack).split(String.fromCharCode(10)).filter((l) => l.includes('e2e.mjs')).join(' / ')); await page.screenshot({ path: SP + '/fail.png' }); await browser.close(); process.exit(1); });
const shot = async (name, scrollTo) => {
  if (scrollTo) await scrollTo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log('captura', name);
};
const field = (label, root = page) =>
  root.locator(`div:has(> label:has-text("${label}"))`).locator('input,select').first();
const login = async (u, p) => {
  await page.getByPlaceholder('Nombre de usuario').fill(u);
  await page.locator('input[type=password]').fill(p);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((url) => !url.pathname.includes('login'));
};
const logout = async () => {
  await page.getByText('Cerrar Sesión').click();
  await page.waitForURL(/login/);
};
const nav = (label) => page.locator('aside a', { hasText: label }).click();
const setFecha = async (iso) => {
  await page.getByRole('button', { name: /Simular fecha|Cambiar fecha/ }).click();
  await page.locator('input[type=datetime-local]').fill(iso);
  await page.getByRole('button', { name: 'Aplicar' }).click();
};
const getData = () => page.evaluate(() => JSON.parse(localStorage.getItem('cdc_data')));

// ───────────────────────── 0. limpio
await page.goto(BASE + '/login');
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '/login');
await page.waitForSelector('text=Iniciar Sesión');
await shot('01_login');

// ───────────────────────── a) SuperAdmin → tasa máxima BCRP
await login('superadmin', 'admin123');
await page.waitForSelector('text=Panel SuperAdmin');
await shot('02_sa_dashboard');
await nav('Tiendas');
await page.waitForSelector('text=Gestión de Tiendas');
await page.locator('tr:has-text("Bodega La Esquina") td:last-child button').first().click();
const tasaInput = field('Tasa máxima BCRP');
await tasaInput.fill('90');
await shot('03_sa_tiendas');
await page.locator('button[type=submit]').click();
await page.waitForSelector('text=Datos de la Tienda', { state: 'detached' });
// reabrir para comprobar persistencia
await page.locator('tr:has-text("Bodega La Esquina") td:last-child button').first().click();
check('a) Tasa máxima BCRP persiste', 'Tiendas → editar → 90 → guardar → reabrir', '90', await field('Tasa máxima BCRP').inputValue());
await page.getByRole('button', { name: /Cancelar/ }).click();
const dataA = await getData();
check('a) tasaMaxBCRP guardada (decimal)', 'localStorage tiendas[0].tasaMaxBCRP', '0.9', dataA.tiendas[0].tasaMaxBCRP);
await logout();

// ───────────────────────── b) Admin → clientes
await login('admin', 'tienda123');
await page.waitForSelector('text=Dashboard');
await nav('Clientes');
await page.getByRole('button', { name: 'Nuevo Cliente' }).click();
const modal = page.locator('form');
await field('Nombre Completo').fill('María Quispe Torres');
await field('DNI').fill('45678912');
await field('Usuario *').fill('maria');
await field('Contraseña').fill('maria123');
await field('Tipo de Tasa').selectOption('TEA');
await field('Tasa de Interés').fill('30');
await field('Tasa Moratoria').fill('50');
await field('Límite de Crédito').fill('1000');
await field('Meses Máximos').fill('6');
await field('Día de Corte').fill('20');

// --- tooltips (hover / foco / toque / Escape)
const helpBtn = page.locator('label:has-text("Tasa de Interés") button[aria-label=Ayuda]');
const tip = page.getByRole('tooltip');
const tipVisible = async () => (await tip.count()) > 0 && (await tip.first().isVisible());
await page.mouse.move(5, 5);
await helpBtn.hover();
await page.waitForTimeout(150);
check('b) Tooltip "?" abre con hover', 'mouse sobre ?', 'visible', (await tipVisible()) ? 'visible' : 'oculto');
await shot('05_at_cliente_form_helptip');
await page.mouse.move(5, 5);
await page.waitForTimeout(150);
check('b) Tooltip se cierra al quitar el mouse', 'mouse fuera', 'oculto', (await tipVisible()) ? 'visible' : 'oculto');
await helpBtn.focus();
await page.waitForTimeout(150);
check('b) Tooltip abre con foco de teclado', 'focus()', 'visible', (await tipVisible()) ? 'visible' : 'oculto');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check('b) Escape cierra tooltip abierto por foco', 'Escape tras foco', 'oculto', (await tipVisible()) ? 'visible' : 'oculto');
await helpBtn.blur();
await helpBtn.click();
await page.mouse.move(5, 5);
await page.waitForTimeout(150);
check('b) Tooltip abre y queda fijo con click', 'click en ?', 'visible', (await tipVisible()) ? 'visible' : 'oculto');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check('b) Escape cierra tooltip fijado', 'Escape tras click', 'oculto', (await tipVisible()) ? 'visible' : 'oculto');
await helpBtn.hover();
await page.waitForTimeout(100);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check('b) Escape cierra tooltip abierto por hover', 'Escape tras hover', 'oculto', (await tipVisible()) ? 'visible' : 'oculto');
await page.mouse.move(5, 5);

// --- día de pago = día de corte
await field('Día de Pago').fill('20');
await page.locator('form button[type=submit]').click();
const errTxt1 = await page.locator('form p.text-danger-700').textContent().catch(() => '');
check('b) Día de pago = día de corte → error', 'corte 20, pago 20', 'error "distinto del día de corte"', errTxt1 || '(sin error)', /distinto/.test(errTxt1 ?? ''));
// --- tasa sobre tope BCRP
await field('Día de Pago').fill('26');
await field('Tasa de Interés').fill('95');
await page.locator('form button[type=submit]').click();
const errTxt2 = await page.locator('form p.text-danger-700').textContent().catch(() => '');
check('b) TEA 95 % > tope 90 % → error', 'tasa compensatoria TEA 95 %', 'error "supera la tasa máxima BCRP"', errTxt2 || '(sin error)', /supera/.test(errTxt2 ?? ''));
await field('Tasa de Interés').fill('30');
await field('Tasa Moratoria').fill('95');
await page.locator('form button[type=submit]').click();
const errTxt3 = await page.locator('form p.text-danger-700').textContent().catch(() => '');
check('b) Mora TEA 95 % > tope 90 % → error', 'tasa moratoria TEA 95 %', 'error "supera la tasa máxima BCRP"', errTxt3 || '(sin error)', /supera/.test(errTxt3 ?? ''));
await field('Tasa Moratoria').fill('50');
await page.locator('form button[type=submit]').click();
await page.waitForSelector('text=María Quispe Torres');

// José
await page.getByRole('button', { name: 'Nuevo Cliente' }).click();
await field('Nombre Completo').fill('José Ramos Díaz');
await field('DNI').fill('41234567');
await field('Usuario *').fill('jose');
await field('Contraseña').fill('jose123');
await field('Tipo de Tasa').selectOption('TNA');
await field('Capitalización de la TNA').selectOption('30');
await field('Tasa de Interés').fill('24');
await field('Tasa Moratoria').fill('36');
await field('Límite de Crédito').fill('300');
await field('Meses Máximos').fill('3');
await field('Día de Corte').fill('15');
await field('Día de Pago').fill('5');
await page.locator('form button[type=submit]').click();
await page.waitForSelector('text=José Ramos Díaz');
await shot('04_at_clientes');
const dC = await getData();
const maria = dC.clientes.find((c) => c.username === 'maria');
const jose = dC.clientes.find((c) => c.username === 'jose');
check('b) María guardada', 'TEA 30 / mora 50 / PEN / 1000 / 6 / 20 / 26',
  'TEA 0.3 / 0.5 / PEN / 1000 / 6 / 20 / 26',
  `${maria.tipoTasa} ${maria.tasaInteres} / ${maria.tasaMoratoria} / ${maria.moneda} / ${maria.limiteCredito} / ${maria.maxMeses} / ${maria.diaCorte} / ${maria.diaPago}`);
check('b) José guardado', 'TNA 24 cap 30 / mora 36 / PEN / 300 / 3 / 15 / 5',
  'TNA 0.24 cap30 / 0.36 / PEN / 300 / 3 / 15 / 5',
  `${jose.tipoTasa} ${jose.tasaInteres} cap${jose.capitalizacion} / ${jose.tasaMoratoria} / ${jose.moneda} / ${jose.limiteCredito} / ${jose.maxMeses} / ${jose.diaCorte} / ${jose.diaPago}`);

// ───────────────────────── c) Productos
await nav('Productos');
// imagen de prueba (PNG generado con canvas)
const imgB64 = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 300;
  const x = c.getContext('2d');
  x.fillStyle = '#f59e0b'; x.fillRect(0, 0, 400, 300);
  x.fillStyle = '#1f2937'; x.fillRect(60, 90, 280, 120);
  x.fillStyle = '#9ca3af';
  for (const cx of [130, 270]) { x.beginPath(); x.arc(cx, 150, 38, 0, 7); x.fill(); }
  x.fillStyle = '#ef4444';
  for (const cx of [130, 270]) { x.beginPath(); x.arc(cx, 150, 14, 0, 7); x.fill(); }
  return c.toDataURL('image/png').split(',')[1];
});
const imgPath = `${SP}/cocina.png`;
fs.writeFileSync(imgPath, Buffer.from(imgB64, 'base64'));

const crearProducto = async (desc, unidad, contado, credito, cuotas, imagen) => {
  await page.getByRole('button', { name: /Nuevo Producto/ }).click();
  await field('Descripción').fill(desc);
  await field('Unidad').fill(unidad);
  await field('Precio Contado').fill(String(contado));
  await field('Precio Crédito').fill(String(credito));
  if (cuotas) await page.getByLabel('Permite Cuotas').check();
  if (imagen) {
    await page.locator('input[type=file]').setInputFiles(imagen);
    await page.waitForSelector('img[alt="Vista previa"]');
  }
  await page.locator('form button[type=submit]').click();
  await page.waitForSelector(`text=${desc}`);
};
await crearProducto('Arroz extra 5 kg', 'kg', 25, 26, false);
await crearProducto('Aceite vegetal 1 L', 'lt', 11, 11.5, false);
await crearProducto('Cocina a gas 2 hornillas', 'unidad', 420, 450, true, imgPath);
await crearProducto('Balón de gas 10 kg', 'unidad', 48, 50, false);
const dP = await getData();
check('c) 4 productos creados', 'Arroz, Aceite, Cocina, Balón', '4', dP.productos.length);
const cocina = dP.productos.find((p) => p.descripcion.startsWith('Cocina'));
check('c) Cocina: precios y cuotas', '420 / 450 / permite cuotas', '420/450/true', `${cocina.precioContado}/${cocina.precioCredito}/${cocina.permiteCuotas}`);
check('c) Solo Cocina permite cuotas', 'Arroz, Aceite, Balón sin cuotas', '1', dP.productos.filter((p) => p.permiteCuotas).length);
check('c) Imagen de Cocina guardada reducida (data URL JPEG)', 'archivo PNG 400×300', 'data:image/jpeg', (cocina.imagenUrl ?? '').slice(0, 15), (cocina.imagenUrl ?? '').startsWith('data:image/jpeg'));
const imgTabla = page.locator('tr:has-text("Cocina a gas") img');
await imgTabla.waitFor();
const loadedTabla = await imgTabla.evaluate((i) => i.complete && i.naturalWidth > 0);
check('c) Imagen visible en tabla de productos', 'img naturalWidth>0', 'true', loadedTabla);
await shot('06_at_productos');

// ───────────────────────── d) Simular 15/09/2026 → venta cuotas a María
await setFecha('2026-09-15T10:00');
await nav('Punto de Venta');
const selCliente = async (nombre) => {
  const v = await page.locator(`select.input option:has-text("${nombre}")`).first().getAttribute('value');
  await page.locator('select.input').first().selectOption(v);
};
const add = async (desc, n = 1) => {
  const btn = page.locator('div.border-gray-100', { hasText: desc }).getByRole('button');
  for (let i = 0; i < n; i++) await btn.click();
};
const preview = page.locator('.card:has-text("Vista Previa Financiera")');
const stat = async (label) => {
  const t = await preview.locator('div.bg-gray-50').filter({ hasText: label }).first().innerText();
  return t.trim().split('\n').pop().trim();
};
const filas = async () => preview.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())));

await selCliente('María');
await page.locator('label:has-text("Cuotas")').first().click();
await add('Cocina a gas');
await page.locator('div.card-body select.input').last().selectOption('3');
await page.getByRole('button', { name: /Calcular Condiciones/ }).click();
await preview.waitFor();
const dGracia = await stat('Días de Gracia');
const dCap = await stat('Capital c/ Gracia');
const dCuota = await stat('Cuota Mensual');
const dTcea = await stat('TCEA');
const dFilas = await filas();
const dMonto = await stat('Monto Compra');
check('d) Monto de compra', '1 Cocina a gas (precio crédito)', 'S/ 450.00', dMonto);
check('d) Días de gracia', 'compra 15/09/2026, corte 20, pago 26', '11 días', dGracia);
check('d) Capital con gracia C′', '450 × (1+TED)^11, TEA 30 %', 'S/ 453.62', dCap);
check('d) Cuota mensual (3 cuotas)', 'método francés, TEM de TEA 30 %', 'S/ 157.94', dCuota);
check('d) Vencimientos', '3 cuotas', '26/10/2026, 26/11/2026, 26/12/2026', dFilas.map((r) => r[1]).join(', '));
check('d) TCEA ≈ TEA', 'TIR de los flujos → 360 días', '30.0000000%', dTcea, /^30\.0000/.test(dTcea) || /^29\.9999/.test(dTcea));
await shot('07_pv_cuotas_preview', preview);
await page.getByRole('button', { name: /Confirmar y Registrar/ }).click();
await page.waitForSelector('text=Venta registrada');
const dTx = (await getData()).transacciones;
check('d) Venta confirmada y guardada', 'confirmar', '1 crédito, 3 cuotas, vigente', `${dTx.length} crédito, ${dTx[0]?.cronograma.length} cuotas, ${dTx[0]?.estado}`);

// ───────────────────────── e) Simular 10/11/2026 → fin de mes
await setFecha('2026-11-10T10:00');
await selCliente('María');
await add('Arroz extra', 2);
await add('Aceite vegetal', 2);
await page.getByRole('button', { name: /Calcular Condiciones/ }).click();
await preview.waitFor();
const eFilas = await filas();
const eGracia = await stat('Días de Gracia');
const eMonto = await stat('Monto Compra');
check('e) Monto 2 Arroz + 2 Aceite (contado)', '2×25 + 2×11', 'S/ 72.00', eMonto);
check('e) Vencimiento fin de mes', 'compra 10/11/2026, corte 20, pago 26', '26/11/2026', eFilas[0]?.[1]);
check('e) Días', '10/11 → 26/11', '16 días', eGracia);
check('e) Total a pagar', '72 × (1+TED)^16', 'S/ 72.84', eFilas[0]?.[4]);
await shot('08_pv_finmes_preview', preview);
await page.getByRole('button', { name: /Confirmar y Registrar/ }).click();
await page.waitForSelector('text=Venta registrada');

// ───────────────────────── f) Arroz + Cocina → cuotas bloqueadas
await selCliente('María');
await add('Arroz extra');
await add('Cocina a gas');
const cuotasRadio = page.locator('label:has-text("Cuotas") input[type=radio]').first();
check('f) Opción Cuotas deshabilitada', 'carrito Arroz + Cocina', 'disabled', (await cuotasRadio.isDisabled()) ? 'disabled' : 'habilitada');
const motivo = await page.locator('p:has-text("No se puede financiar en cuotas")').textContent();
check('f) Motivo mostrado', 'texto de ayuda', 'menciona "Arroz extra 5 kg"', motivo.trim().slice(0, 90), /Arroz extra 5 kg/.test(motivo));
await shot('09_pv_cuotas_bloqueadas');

// ───────────────────────── g) José: 1 Cocina → exceso de línea
await page.getByRole('button', { name: /Cerrar|Quitar/ }).count(); // noop
await page.reload(); // limpia carrito; la fecha simulada se pierde, se vuelve a aplicar tras re-login
await page.waitForURL(/login/).catch(() => {});
await login('admin', 'tienda123');
await setFecha('2026-11-10T10:00');
await nav('Punto de Venta');
await selCliente('José');
await page.locator('label:has-text("Cuotas")').first().click();
await add('Cocina a gas');
await page.getByRole('button', { name: /Calcular Condiciones/ }).click();
await page.waitForSelector('text=Excede el límite de crédito');
const gTxt = await page.locator('div.bg-danger-50').first().innerText();
check('g) Bloqueo por exceso de línea', 'José, 1 Cocina (S/ 450), línea 300', 'Disponible S/ 300.00, Exceso S/ 150.00', gTxt.trim(), /Disponible: S\/ 300\.00/.test(gTxt) && /Exceso: S\/ 150\.00/.test(gTxt));
const noPreview = (await preview.count()) === 0;
check('g) No se genera vista previa', 'bloqueo', 'sin vista previa', noPreview ? 'sin vista previa' : 'con vista previa');
await shot('10_pv_exceso_linea');

// ───────────────────────── h) 05/12/2026 → estado de cuenta de María
await setFecha('2026-12-05T10:00');
await nav('Estado de Cuenta');
await page.waitForSelector('h1:has-text("Estado de Cuenta")');
{
  const v = await page.locator('select.input option:has-text("María")').first().getAttribute('value');
  await page.locator('select.input').first().selectOption(v);
}
const cardFin = page.locator('div.card.overflow-hidden').filter({ hasText: 'Pago único' });
await cardFin.locator('.card-header').click();
const cuadroMora = cardFin.locator('.bg-gray-50.rounded-lg.p-3.space-y-1.text-sm').last();
await cuadroMora.waitFor();
const moraFila = await cardFin.locator('div.text-danger-600:has-text("Intereses por mora")').first().innerText();
check('h) Ítem "Intereses por mora" (fin de mes)', '9 días de atraso (26/11 → 05/12) sobre 72.84, TEA mora 50 %', 'Intereses por mora S/ 0.74', moraFila.replace(/\s+/g, ' ').trim(), /S\/ 0\.74/.test(moraFila));
const estadoFila = await cardFin.locator('tbody tr').first().innerText();
check('h) Cuota fin de mes vencida', 'vence 26/11, hoy 05/12', 'Vencida', /Vencida/.test(estadoFila) ? 'Vencida' : estadoFila.replace(/\s+/g, ' '));
await shot('11_ec_mora', cardFin);

// pago: 1) rechazar confirmación → nada cambia
let dlgMsg = '';
page.once('dialog', async (d) => { dlgMsg = d.message(); await d.dismiss(); });
await cardFin.getByRole('button', { name: 'Pagar' }).click();
await page.waitForTimeout(300);
check('h) El pago pide confirmación', 'clic en Pagar', 'mensaje con "pago COMPLETO" y "No se admiten pagos parciales"', dlgMsg.slice(0, 140), /COMPLETO/.test(dlgMsg) && /No se admiten pagos parciales/.test(dlgMsg));
check('h) Si se cancela no se registra pago', 'confirm → Cancelar', '0', (await getData()).pagos.length);
check('h) No hay campo de monto (sin pago parcial)', 'inputs numéricos en la tarjeta del crédito', '0', await cardFin.locator('input').count());
// captura de la confirmación (el diálogo nativo no es capturable → se reemplaza confirm por una réplica en DOM que devuelve false)
await page.evaluate(() => {
  window.confirm = (m) => {
    const o = document.createElement('div');
    o.id = 'fake-confirm';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding-top:40px;font-family:system-ui';
    o.innerHTML = `<div style="background:#fff;border:1px solid #bbb;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);width:520px;padding:18px 20px;font-size:14px;color:#111"><div style="font-size:12px;color:#666;margin-bottom:8px">localhost:5173 dice</div><div style="margin-bottom:16px;line-height:1.4">${m}</div><div style="display:flex;justify-content:flex-end;gap:8px"><button style="padding:6px 16px;border-radius:6px;background:#2563eb;color:#fff;border:0">Aceptar</button><button style="padding:6px 16px;border-radius:6px;background:#e5e7eb;border:0">Cancelar</button></div></div>`;
    document.body.appendChild(o);
    return false;
  };
});
await cardFin.getByRole('button', { name: 'Pagar' }).click();
await page.waitForSelector('#fake-confirm');
await shot('12_ec_pago_confirmacion');
await page.evaluate(() => { document.getElementById('fake-confirm')?.remove(); window.confirm = () => true; });
// 2) aceptar
await cardFin.getByRole('button', { name: 'Pagar' }).click();
await page.waitForTimeout(300);
const hTx = (await getData());
const pago = hTx.pagos[0];
check('h) Se registra 1 pago', 'confirmar', '1', hTx.pagos.length);
check('h) Pago: total', '72.84 cuota + 0.74 mora', '73.58', pago?.montoPagado);
check('h) Pago: desglose mora → interés → capital', 'prelación', 'mora 0.74 / interés 0.84 / capital 72', `mora ${pago?.desgloseMora} / interés ${pago?.desgloseInteres} / capital ${pago?.desgloseCapital}`);
const liq = hTx.transacciones.find((t) => t.modalidadPago === 'fin_de_mes');
check('h) Crédito pasa a Liquidado', 'única cuota pagada', 'liquidado', liq.estado);
await cardFin.locator('.card-header').waitFor();
const badge = await cardFin.locator('.card-header').innerText();
check('h) Badge "Liquidado" en pantalla', 'tarjeta del crédito', 'Liquidado', /Liquidado/.test(badge) ? 'Liquidado' : badge.replace(/\s+/g, ' '));
// expandido tras pagar (el estado expandido se conserva)
await shot('13_ec_liquidado', cardFin);
const totalAPagarAdmin = (await page.locator('div.card.p-4.text-sm div.border-t span').last().innerText()).trim();
const deudaCocina = (await page.locator('div.card.overflow-hidden').filter({ hasText: '3 cuotas' }).locator('.card-header .text-right').first().innerText());
log('cabecera Cocina:', deudaCocina.replace(/\s+/g,' '));
check('h) Total a pagar global no suma la mora ya pagada', 'cocina 473.83 deuda + 8.89 mora pendiente (el crédito liquidado aporta 0)', 'S/ 482.72', totalAPagarAdmin, totalAPagarAdmin === 'S/ 482.72');

// Dashboard admin
await nav('Dashboard');
await page.waitForSelector('text=Clientes Activos');
await shot('14_at_dashboard');
await logout();

// ───────────────────────── i) Cliente
await login('maria', 'maria123');
await page.waitForSelector('text=Hola, María');
await shot('15_cl_dashboard');
await nav('Estado de Cuenta');
await page.waitForSelector('text=Mi Estado de Cuenta');
const totCl = (await page.locator('.stat-card:has-text("Total a Pagar") .stat-value').innerText()).trim();
check('i) Total a pagar del cliente coincide con el del admin', 'estado de cuenta de maria', 'S/ 482.72', totCl, totCl === 'S/ 482.72');
const clTxt = await page.locator('main').innerText();
check('i) Cliente ve moneda S/', 'estado de cuenta de maria', 'montos con "S/"', /S\/ /.test(clTxt) ? 'montos con "S/"' : 'sin S/');
check('i) Cliente ve TCEA', 'estado de cuenta', 'TCEA presente', /TCEA/.test(clTxt) ? 'TCEA presente' : 'ausente');
check('i) Cliente ve "Intereses por mora" y compensatorio', 'estado de cuenta', 'ambos presentes', /Intereses por mora/i.test(clTxt) && /compensatorio/i.test(clTxt) ? 'ambos presentes' : 'faltan');
check('i) Cliente ve el crédito liquidado', 'estado de cuenta', 'Liquidado', /Liquidado/i.test(clTxt) ? 'Liquidado' : 'no visible');
await page.evaluate(() => window.scrollTo(0, 0));
await shot('16_cl_estado_cuenta');
await logout();

log('>> touch');
// ───────────────────────── Tooltip con TOQUE (contexto táctil)
{
  const tctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, hasTouch: true });
  const tp = await tctx.newPage();
  tp.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[touch console.error] ${m.text()}`); });
  tp.on('pageerror', (e) => consoleErrors.push(`[touch pageerror] ${e.message}`));
  await tp.goto(BASE + '/login');
  await tp.getByPlaceholder('Nombre de usuario').fill('admin');
  await tp.locator('input[type=password]').fill('tienda123');
  await tp.locator('button[type=submit]').click();
  await tp.waitForSelector('text=Dashboard');
  await tp.locator('aside a', { hasText: 'Clientes' }).click();
  await tp.getByRole('button', { name: 'Nuevo Cliente' }).click();
  const hb = tp.locator('label:has-text("Tasa de Interés") button[aria-label=Ayuda]');
  await hb.tap();
  await tp.waitForTimeout(200);
  check('b) Tooltip abre con toque (tap)', 'touchscreen.tap en ?', 'visible', (await tp.getByRole('tooltip').count()) > 0 ? 'visible' : 'oculto');
  await tp.getByRole('heading', { name: 'Nuevo Cliente' }).tap();
  await tp.waitForTimeout(200);
  check('b) Tooltip se cierra al tocar fuera', 'tap fuera', 'oculto', (await tp.getByRole('tooltip').count()) > 0 ? 'visible' : 'oculto');
  await tctx.close();
}

log('>> migracion');
// ───────────────────────── Migración de datos con formato anterior
{
  const mctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, locale: 'es-PE', timezoneId: 'America/Lima' });
  const mp = await mctx.newPage();
  mp.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[migracion console.error] ${m.text()}`); });
  mp.on('pageerror', (e) => consoleErrors.push(`[migracion pageerror] ${e.message}`));
  const iso = (s) => new Date(s).toISOString();
  const viejo = {
    version: '1.0.0',
    superAdmins: [{ id: 'sa-001', username: 'superadmin', passwordHash: 'admin123', email: 'sa@x.app', creadoEn: iso('2026-01-01') }],
    tiendas: [{ id: 'tienda-001', nombre: 'Bodega Antigua', giro: 'Bodega', activa: true, creadaEn: iso('2026-01-01'), adminId: 'admin-001' }],
    usuarios: [{ id: 'admin-001', tiendaId: 'tienda-001', rol: 'admin_tienda', username: 'admin', passwordHash: 'tienda123', nombreCompleto: 'Admin Viejo', activo: true, creadoEn: iso('2026-01-01') }],
    clientes: [{ id: 'cli-old', tiendaId: 'tienda-001', nombreCompleto: 'Pedro Antiguo', dni: '11112222', username: 'pedro', passwordHash: 'pedro123',
      tipoTasa: 'TNA', tasaInteres: 0.24, tasaMoratoria: 0.36, limiteCredito: 500, maxMeses: 6, diaCorte: 20, diaPago: 26, saldoUtilizado: 0, activo: true, creadoEn: iso('2026-01-01') }],
    productos: [{ id: 'prod-old', tiendaId: 'tienda-001', descripcion: 'Producto viejo', unidad: 'unidad', precioContado: 100, precioCredito: 110, permiteCuotas: true, activo: true, creadoEn: iso('2026-01-01') }],
    transacciones: [{ id: 'tx-old-111111', tiendaId: 'tienda-001', clienteId: 'cli-old', fechaCompra: iso('2026-06-10'),
      items: [{ productoId: 'prod-old', descripcion: 'Producto viejo', cantidad: 1, precioUnitario: 110, subtotal: 110 }],
      montoOriginal: 110, tipoTasa: 'TNA', tasaInteres: 0.24, tasaMoratoria: 0.36, modalidadPago: 'cuotas', numeroCuotas: 2,
      fechaCorte: iso('2026-06-20'), fechaPrimerPago: iso('2026-06-26'), diasGracia: 16, capitalConGracia: 112, cuotaMensual: 57,
      cronograma: [
        { numeroCuota: 1, fechaVencimiento: iso('2026-06-26'), saldoInicial: 112, interes: 2.24, capital: 54.76, cuota: 57, mora: 0, totalPagar: 57, estado: 'pendiente' },
        { numeroCuota: 2, fechaVencimiento: iso('2026-07-26'), saldoInicial: 57.24, interes: 1.14, capital: 55.86, cuota: 57, mora: 0, totalPagar: 57, estado: 'pendiente' },
      ], estado: 'vigente', creadoEn: iso('2026-06-10') }],
    pagos: [],
    ultimaActualizacion: iso('2026-06-10'),
  };
  await mp.goto(BASE + '/login');
  await mp.evaluate((d) => localStorage.setItem('cdc_data', JSON.stringify(d)), viejo);
  await mp.goto(BASE + '/login');
  const L = async (u, p) => {
    await mp.getByPlaceholder('Nombre de usuario').fill(u);
    await mp.locator('input[type=password]').fill(p);
    await mp.locator('button[type=submit]').click();
    await mp.waitForURL((url) => !url.pathname.includes('login'));
  };
  await L('admin', 'tienda123');
  log('>> mig login ok');
  const bodyOk = async (txt) => mp.waitForSelector(`text=${txt}`, { timeout: 5000 }).then(() => true).catch(() => false);
  let ok1 = await bodyOk('Dashboard');
  await mp.locator('aside a', { hasText: 'Clientes' }).click();
  await mp.waitForSelector('h1:has-text("Gestión de Clientes")');
  ok1 = ok1 && (await bodyOk('Pedro Antiguo'));
  const filaPedro = await mp.locator('tr:has-text("Pedro Antiguo")').innerText();
  const monedaOk = /S\/ 500\.00/.test(filaPedro);
  await mp.locator('aside a', { hasText: 'Productos' }).click();
  ok1 = ok1 && (await bodyOk('Producto viejo'));
  await mp.locator('aside a', { hasText: 'Punto de Venta' }).click();
  ok1 = ok1 && (await bodyOk('Punto de Venta'));
  await mp.locator('aside a', { hasText: 'Estado de Cuenta' }).click();
  await mp.waitForSelector('h1:has-text("Estado de Cuenta")');
  {
    const v = await mp.locator('select.input option:has-text("Pedro")').first().getAttribute('value');
    await mp.locator('select.input').first().selectOption(v);
  }
  log('>> mig EC');
  await mp.locator('div.card.overflow-hidden .card-header').first().click();
  const txtEC = await mp.locator('main').innerText();
  const okEC = /Intereses por mora/.test(txtEC) && /TCEA/.test(txtEC) && /S\/ /.test(txtEC);
  check('Migración: admin recorre dashboard/clientes/productos/POS/estado de cuenta', 'JSON formato anterior (sin moneda, capitalización, tcea, fechaPrimerPago)', 'sin errores y datos visibles', ok1 && okEC ? 'sin errores y datos visibles' : 'falla', ok1 && okEC);
  check('Migración: cliente antiguo asume moneda PEN', 'fila de Clientes', 'S/ 500.00', filaPedro.replace(/\s+/g, ' '), monedaOk);
  const mig = await mp.evaluate(() => JSON.parse(localStorage.getItem('cdc_data')));
  await mp.locator('aside a', { hasText: 'Dashboard' }).click();
  await mp.getByText('Cerrar Sesión').click();
  await mp.waitForURL(/login/);
  await L('pedro', 'pedro123');
  const okCl = await bodyOk('Hola, Pedro');
  await mp.locator('aside a', { hasText: 'Estado de Cuenta' }).click();
  const okCl2 = await bodyOk('Mi Estado de Cuenta');
  const clTxt2 = await mp.locator('main').innerText();
  check('Migración: cliente antiguo ve su cuenta', 'login pedro/pedro123', 'dashboard y estado de cuenta cargan', okCl && okCl2 && /Pago|cuotas/.test(clTxt2) ? 'cargan' : 'falla', okCl && okCl2);
  log('migrado → cliente:', JSON.stringify({ moneda: mig.clientes[0].moneda, cap: mig.clientes[0].capitalizacion }), 'tx:', JSON.stringify({ pagoCiclo: mig.transacciones[0].fechaPagoCiclo, primeraCuota: mig.transacciones[0].fechaPrimeraCuota }));
  await mctx.close();
}

fs.writeFileSync(`${SP}/results.json`, JSON.stringify({ results, consoleErrors }, null, 2));
log('\nconsole errors:', consoleErrors.length);
consoleErrors.forEach((e) => log(' ', e));
log('FALLAS:', results.filter((r) => !r.ok).length, 'de', results.length);
await browser.close();
