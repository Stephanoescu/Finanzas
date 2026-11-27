# 📒 Cuaderno Digital de Créditos

Sistema de gestión de créditos directos para pequeños comercios (bodegas, carnicerías, peluquerías, etc.).

## 🚀 Demo

Abre `http://localhost:5173/` tras ejecutar el servidor de desarrollo.

**Cuentas de acceso demo:**
| Rol | Usuario | Contraseña |
|---|---|---|
| Super Admin | `superadmin` | `admin123` |
| Admin Tienda | `admin` | `tienda123` |
| Cliente | (creado por el Admin) | (configurable) |

---

## 🛠️ Stack Técnico

- **React 19** + **TypeScript** (Vite)
- **Tailwind CSS v4**
- **Zustand** — manejo de estado global
- **React Router v6** — navegación SPA
- **date-fns** — manipulación de fechas
- **lucide-react** — iconografía
- **100% Frontend** — persistencia en `localStorage` (sin backend)

---

## 📐 Matemáticas Financieras Implementadas

Convención: año de 360 días, meses de 30 días, método francés vencido simple ordinario, tasas en decimal.

### Una sola fórmula de conversión de tasas

```
TEA:  TEP(n días) = (1 + TEA)^(n/360) − 1
TNA:  TEP(n días) = (1 + TNA/m)^(n/d) − 1,   m = 360/d
```

`d` es el campo **capitalización** del cliente (días por período: 1 = diaria, 30 = mensual; por defecto 30).
TED = TEP(1), TEM = TEP(30), TEA = TEP(360) y la TED moratoria usa la misma fórmula con la tasa moratoria.
Ej.: TNA 24 % capitalizable mensualmente → TEM = 2.0000000 %, TEA = 26.8241795 %.

| Cálculo | Fórmula |
|---|---|
| Días de gracia | días calendario entre compra y fecha de pago del ciclo (se ignora la hora) |
| Capitalización gracia | `C' = Monto × (1 + TED)^días_gracia` |
| Pago único | `M = Monto × (1 + TED)^días`, vence en la fecha de pago del ciclo |
| Cuota (método francés) | `R = C' × TEM(1+TEM)^n / ((1+TEM)^n − 1)`; la última cuota absorbe el redondeo |
| Interés moratorio | `Mora = Cuota × [(1 + TED_mora)^días_atraso − 1]` (días exactos) |
| TCEA | TIR diaria de los flujos (−monto en la compra, cuotas a `días_gracia + 30·k`), `TCEA = (1 + TIRd)^360 − 1` |
| Línea disponible (F9) | `Disponible = Línea − Σ capital pendiente de amortizar` de los créditos no liquidados ni castigados (`calcularLineaDisponible`). Intereses y mora no consumen línea; es el mismo número en el punto de venta, el estado de cuenta y el dashboard del cliente |

### Fechas

- **Fecha de pago del ciclo** (`fechaPagoCiclo`): hasta donde se capitaliza la deuda.
- **Fecha de la primera cuota** (`fechaPrimeraCuota`): un mes después de la fecha de pago del ciclo; la cuota *k* vence en `fechaPagoCiclo + k meses`.
- Pago único / fin de mes: vence en la fecha de pago del ciclo.
- Ejemplo del enunciado: compra 15/09, corte 20, pago 26 → 11 días de gracia, cuotas el 26/10, 26/11 y 26/12.

### Pagos

Solo se paga la **cuota completa** (cuota + mora a la fecha), sin pagos parciales. Cada pago crea un registro `Pago` con
el desglose en orden de prelación **mora → interés compensatorio → capital**, y la cuota queda con su mora congelada
(`mora`, `montoPagado`, `fechaPago`).

### Validaciones y topes

- Punto de venta: "Cuotas" solo si todos los productos del carrito tienen `permiteCuotas`.
- Cliente: día de pago ≠ día de corte; tasas ≥ 0.
- Tienda: **tasa máxima BCRP (TEA %)**; las tasas compensatoria y moratoria del cliente (en su TEA equivalente) no pueden superarla.

### Campos nuevos

| Entidad | Campo | Descripción |
|---|---|---|
| Cliente | `moneda` | `'PEN'` (por defecto) o `'USD'`; define el símbolo en todos sus montos |
| Cliente | `capitalizacion` | Días por período de capitalización de la TNA (por defecto 30) |
| Producto | `imagenUrl` | URL o imagen subida (reducida y guardada como data URL) |
| Tienda | `tasaMaxBCRP` | Tope de tasas, TEA decimal |
| Transacción | `fechaPagoCiclo`, `fechaPrimeraCuota`, `tcea`, `moneda`, `capitalizacion` | Reemplazan a `fechaPrimerPago` |

Los datos guardados con versiones anteriores se migran al leerlos (moneda PEN, capitalización 30, `fechaPrimerPago` → `fechaPagoCiclo`).

### Ayuda y presentación

Cada campo de los formularios de Cliente, Producto, Tienda y Punto de venta tiene un ícono "?" (`HelpTip`) con tooltip por hover, foco o toque.
Las tasas (TED, TEM, TCEA) se muestran con 7 decimales y los montos con 2.

---

## 🏗️ Estructura del Proyecto

```
src/
├── types/models.ts          # Interfaces TypeScript de todas las entidades
├── utils/
│   ├── financeUtils.ts      # Módulo de matemáticas financieras
│   ├── financeUtils.test.ts # Pruebas (vitest)
│   ├── imagen.ts            # Reducción de imágenes a data URL
│   └── storage.ts           # Capa de persistencia localStorage
├── store/useAppStore.ts     # Zustand store (sesión + time travel)
├── layouts/                 # Layouts por rol (SuperAdmin, Admin, Cliente)
├── pages/
│   ├── superadmin/          # Dashboard y CRUD de tiendas
│   ├── admin/               # Dashboard, clientes, productos, POS, estado de cuenta
│   └── cliente/             # Vista solo lectura del cliente
└── components/
    ├── HelpTip.tsx          # Ícono "?" con tooltip de ayuda por campo
    └── TimeTravelBar.tsx    # Simulador de fecha para testing
```

---

## ▶️ Instalación y desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Build para producción
npm run build

# Pruebas
npx vitest run
```

> En Windows, ejecuta las pruebas desde una ruta con la unidad en mayúscula (`C:\...`). Si la terminal abre la carpeta como `c:\...`, vitest carga dos copias de sí mismo y falla con "Vitest failed to find the current suite".

---

## 🌐 Deploy en Vercel

```bash
npm run build
# Sube la carpeta dist/ o conecta el repo directamente a Vercel
```

Agrega un `vercel.json` para el enrutamiento SPA:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## 🔑 Roles y Permisos

| Módulo | SuperAdmin | Admin Tienda | Cliente |
|---|---|---|---|
| CRUD Tiendas | ✅ | ❌ | ❌ |
| CRUD Productos | ❌ | ✅ | ❌ |
| CRUD Clientes | ❌ | ✅ | ❌ |
| Punto de Venta | ❌ | ✅ | ❌ |
| Estado de Cuenta | ❌ | ✅ (todos) | ✅ (solo el suyo) |
| Simulador de Fecha | ✅ | ✅ | ❌ |

---

## ⏰ Simulador de Tiempo (Time Travel)

La barra superior permite cambiar la "fecha actual del sistema" para testear:
- Cierres de corte (día 20 → día 26)
- Cálculo de mora por días exactos de atraso
- Validación de períodos de gracia

---

*Desarrollado con React + Vite + Tailwind CSS v4. Sin backend, 100% localStorage.*
