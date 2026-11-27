# Resultados de la prueba manual automatizada (Playwright + Chromium, 1366×820)

Fecha de ejecución: 2026-11-27 · Rama `fix/linea-disponible` · `npm run dev` en http://localhost:5173

Las pruebas se ejecutan con `scripts/e2e-capturas.mjs` (ver README del script). Cada fila compara el valor esperado del enunciado con el valor leído en pantalla (o en `localStorage` cuando se indica).

| # | Caso | Entrada | Valor esperado | Valor que muestra la app | ¿Coincide? |
|---|------|---------|----------------|--------------------------|:---:|
| 1 | a) Tasa máxima BCRP persiste | Tiendas → editar → 90 → guardar → reabrir | 90 | 90 | ✅ Sí |
| 2 | a) tasaMaxBCRP guardada (decimal) | localStorage tiendas[0].tasaMaxBCRP | 0.9 | 0.9 | ✅ Sí |
| 3 | b) Tooltip "?" abre con hover | mouse sobre ? | visible | visible | ✅ Sí |
| 4 | b) Tooltip se cierra al quitar el mouse | mouse fuera | oculto | oculto | ✅ Sí |
| 5 | b) Tooltip abre con foco de teclado | focus() | visible | visible | ✅ Sí |
| 6 | b) Escape cierra tooltip abierto por foco | Escape tras foco | oculto | oculto | ✅ Sí |
| 7 | b) Tooltip abre y queda fijo con click | click en ? | visible | visible | ✅ Sí |
| 8 | b) Escape cierra tooltip fijado | Escape tras click | oculto | oculto | ✅ Sí |
| 9 | b) Escape cierra tooltip abierto por hover | Escape tras hover | oculto | oculto | ✅ Sí |
| 10 | b) Día de pago = día de corte → error | corte 20, pago 20 | error "distinto del día de corte" | El día de pago debe ser distinto del día de corte. | ✅ Sí |
| 11 | b) TEA 95 % > tope 90 % → error | tasa compensatoria TEA 95 % | error "supera la tasa máxima BCRP" | La tasa compensatoria equivale a una TEA de 95.0000%, que supera la tasa máxima BCRP de la tienda (90.0000%). | ✅ Sí |
| 12 | b) Mora TEA 95 % > tope 90 % → error | tasa moratoria TEA 95 % | error "supera la tasa máxima BCRP" | La tasa moratoria equivale a una TEA de 95.0000%, que supera la tasa máxima BCRP de la tienda (90.0000%). | ✅ Sí |
| 13 | b) María guardada | TEA 30 / mora 50 / PEN / 1000 / 6 / 20 / 26 | TEA 0.3 / 0.5 / PEN / 1000 / 6 / 20 / 26 | TEA 0.3 / 0.5 / PEN / 1000 / 6 / 20 / 26 | ✅ Sí |
| 14 | b) José guardado | TNA 24 cap 30 / mora 36 / PEN / 300 / 3 / 15 / 5 | TNA 0.24 cap30 / 0.36 / PEN / 300 / 3 / 15 / 5 | TNA 0.24 cap30 / 0.36 / PEN / 300 / 3 / 15 / 5 | ✅ Sí |
| 15 | c) 4 productos creados | Arroz, Aceite, Cocina, Balón | 4 | 4 | ✅ Sí |
| 16 | c) Cocina: precios y cuotas | 420 / 450 / permite cuotas | 420/450/true | 420/450/true | ✅ Sí |
| 17 | c) Solo Cocina permite cuotas | Arroz, Aceite, Balón sin cuotas | 1 | 1 | ✅ Sí |
| 18 | c) Imagen de Cocina guardada reducida (data URL JPEG) | archivo PNG 400×300 | data:image/jpeg | data:image/jpeg | ✅ Sí |
| 19 | c) Imagen visible en tabla de productos | img naturalWidth>0 | true | true | ✅ Sí |
| 20 | d) Monto de compra | 1 Cocina a gas (precio crédito) | S/ 450.00 | S/ 450.00 | ✅ Sí |
| 21 | d) Días de gracia | compra 15/09/2026, corte 20, pago 26 | 11 días | 11 días | ✅ Sí |
| 22 | d) Capital con gracia C′ | 450 × (1+TED)^11, TEA 30 % | S/ 453.62 | S/ 453.62 | ✅ Sí |
| 23 | d) Cuota mensual (3 cuotas) | método francés, TEM de TEA 30 % | S/ 157.94 | S/ 157.94 | ✅ Sí |
| 24 | d) Vencimientos | 3 cuotas | 26/10/2026, 26/11/2026, 26/12/2026 | 26/10/2026, 26/11/2026, 26/12/2026 | ✅ Sí |
| 25 | d) TCEA ≈ TEA | TIR de los flujos → 360 días | 30.0000000% | 30.0000000% | ✅ Sí |
| 26 | d) Venta confirmada y guardada | confirmar | 1 crédito, 3 cuotas, vigente | 1 crédito, 3 cuotas, vigente | ✅ Sí |
| 27 | e) Monto 2 Arroz + 2 Aceite (contado) | 2×25 + 2×11 | S/ 72.00 | S/ 72.00 | ✅ Sí |
| 28 | e) Vencimiento fin de mes | compra 10/11/2026, corte 20, pago 26 | 26/11/2026 | 26/11/2026 | ✅ Sí |
| 29 | e) Días | 10/11 → 26/11 | 16 días | 16 días | ✅ Sí |
| 30 | e) Total a pagar | 72 × (1+TED)^16 | S/ 72.84 | S/ 72.84 | ✅ Sí |
| 31 | f) Opción Cuotas deshabilitada | carrito Arroz + Cocina | disabled | disabled | ✅ Sí |
| 32 | f) Motivo mostrado | texto de ayuda | menciona "Arroz extra 5 kg" | No se puede financiar en cuotas: Arroz extra 5 kg no permite cuotas. Quítelo(s) del carrit | ✅ Sí |
| 33 | g) Bloqueo por exceso de línea | José, 1 Cocina (S/ 450), línea 300 | Disponible S/ 300.00, Exceso S/ 150.00 | Excede el límite de crédito. Disponible: S/ 300.00. Exceso: S/ 150.00 | ✅ Sí |
| 34 | g) No se genera vista previa | bloqueo | sin vista previa | sin vista previa | ✅ Sí |
| 35 | h) Ítem "Intereses por mora" (fin de mes) | 9 días de atraso (26/11 → 05/12) sobre 72.84, TEA mora 50 % | Intereses por mora S/ 0.74 | Intereses por mora S/ 0.74 | ✅ Sí |
| 36 | h) Cuota fin de mes vencida | vence 26/11, hoy 05/12 | Vencida | Vencida | ✅ Sí |
| 37 | h) El pago pide confirmación | clic en Pagar | mensaje con "pago COMPLETO" y "No se admiten pagos parciales" | Se registrará el pago COMPLETO de la cuota 1: S/ 73.58 (cuota S/ 72.84 + mora S/ 0.74). No se admiten pagos parciales. ¿Continuar? | ✅ Sí |
| 38 | h) Si se cancela no se registra pago | confirm → Cancelar | 0 | 0 | ✅ Sí |
| 39 | h) No hay campo de monto (sin pago parcial) | inputs numéricos en la tarjeta del crédito | 0 | 0 | ✅ Sí |
| 40 | h) Se registra 1 pago | confirmar | 1 | 1 | ✅ Sí |
| 41 | h) Pago: total | 72.84 cuota + 0.74 mora | 73.58 | 73.58 | ✅ Sí |
| 42 | h) Pago: desglose mora → interés → capital | prelación | mora 0.74 / interés 0.84 / capital 72 | mora 0.74 / interés 0.84 / capital 72 | ✅ Sí |
| 43 | h) Crédito pasa a Liquidado | única cuota pagada | liquidado | liquidado | ✅ Sí |
| 44 | h) Badge "Liquidado" en pantalla | tarjeta del crédito | Liquidado | Liquidado | ✅ Sí |
| 45 | h) Total a pagar global no suma la mora ya pagada | cocina 473.83 deuda + 8.89 mora pendiente (el crédito liquidado aporta 0) | S/ 482.72 | S/ 482.72 | ✅ Sí |
| 46 | F9) Estado de cuenta: línea utilizada = capital pendiente | María: C′ de la cocina sin pagos; el crédito liquidado aporta 0 | S/ 453.62 | S/ 453.62 | ✅ Sí |
| 47 | F9) Estado de cuenta: línea disponible | 1,000 − 453.62 (intereses y mora no consumen línea) | S/ 546.38 | S/ 546.38 | ✅ Sí |
| 48 | F9) Punto de venta: línea disponible | María seleccionada | S/ 546.38 | S/ 546.38 | ✅ Sí |
| 49 | F9) Dashboard del cliente: línea disponible | login maria | S/ 546.38 | S/ 546.38 | ✅ Sí |
| 50 | F9) Mismo disponible en Estado de cuenta, Dashboard del cliente y Punto de venta | EC S/ 546.38 / CL S/ 546.38 / PV S/ 546.38 | iguales | iguales | ✅ Sí |
| 51 | i) Total a pagar del cliente coincide con el del admin | estado de cuenta de maria | S/ 482.72 | S/ 482.72 | ✅ Sí |
| 52 | i) Cliente ve moneda S/ | estado de cuenta de maria | montos con "S/" | montos con "S/" | ✅ Sí |
| 53 | i) Cliente ve TCEA | estado de cuenta | TCEA presente | TCEA presente | ✅ Sí |
| 54 | i) Cliente ve "Intereses por mora" y compensatorio | estado de cuenta | ambos presentes | ambos presentes | ✅ Sí |
| 55 | i) Cliente ve el crédito liquidado | estado de cuenta | Liquidado | Liquidado | ✅ Sí |
| 56 | b) Tooltip abre con toque (tap) | touchscreen.tap en ? | visible | visible | ✅ Sí |
| 57 | b) Tooltip se cierra al tocar fuera | tap fuera | oculto | oculto | ✅ Sí |
| 58 | Migración: admin recorre dashboard/clientes/productos/POS/estado de cuenta | JSON formato anterior (sin moneda, capitalización, tcea, fechaPrimerPago) | sin errores y datos visibles | sin errores y datos visibles | ✅ Sí |
| 59 | Migración: cliente antiguo asume moneda PEN | fila de Clientes | S/ 500.00 | Pedro Antiguo 11112222 - TNA 24.00% S/ 500.00 20 / 26 Activo EditarEliminar | ✅ Sí |
| 60 | Migración: cliente antiguo ve su cuenta | login pedro/pedro123 | dashboard y estado de cuenta cargan | cargan | ✅ Sí |

**60 de 60 comprobaciones coinciden.** Errores `console.error` / `pageerror` durante todos los flujos: **0**.

## Notas
- La captura `12_ec_pago_confirmacion.png` usa una réplica en DOM del cuadro `window.confirm` (los diálogos nativos no se pueden capturar). El texto es el mensaje real que genera la app; la comprobación del diálogo nativo real (mensaje y cancelación) está en la fila "El pago pide confirmación".
- En el paso (h) la cocina de María (cuotas 26/10 y 26/11) también está vencida al 05/12/2026: mora 7.28 + 1.61 = 8.89. Solo se paga el crédito de fin de mes; el total a pagar restante es S/ 473.83 + S/ 8.89 = S/ 482.72.
- Línea disponible (F9): las tres pantallas usan `calcularLineaDisponible` (línea − capital pendiente de amortizar de los créditos no liquidados ni castigados). Al 05/12/2026 María tiene la cocina sin pagos (capital pendiente C′ = 453.62) y el pago único ya liquidado, así que el disponible es S/ 546.38 en el Estado de cuenta, el Dashboard del cliente y el Punto de venta. Antes de este cambio el Estado de cuenta y el Dashboard restaban las cuotas con interés (473.83) y mostraban S/ 526.17. El "Total a pagar" (S/ 482.72, cuotas + mora) no cambia.
- La migración se probó cargando un JSON con el formato anterior (cliente sin `moneda`/`capitalizacion`, crédito con `fechaPrimerPago` y sin `tcea`); se migra en memoria al leer y se persiste en el siguiente guardado.
