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

- **React 18** + **TypeScript** (Vite)
- **Tailwind CSS v4**
- **Zustand** — manejo de estado global
- **React Router v6** — navegación SPA
- **date-fns** — manipulación de fechas
- **lucide-react** — iconografía
- **100% Frontend** — persistencia en `localStorage` (sin backend)

---

## 📐 Matemáticas Financieras Implementadas

| Cálculo | Fórmula |
|---|---|
| TNA → TED | `TED = TNA / 360` |
| TEA → TED | `TED = (1 + TEA)^(1/360) - 1` |
| TNA → TEM | `TEM = TNA / 12` |
| TEA → TEM | `TEM = (1 + TEA)^(30/360) - 1` |
| Interés compuesto diario | `M = C × (1 + TED)^días` |
| Capitalización gracia | `C' = Monto × (1 + TED)^días_gracia` |
| Método Francés (cuota) | `R = C' × [TEM×(1+TEM)^n] / [(1+TEM)^n-1]` |
| Interés moratorio | `Mora = Cuota × [(1+TED_mora)^días_mora - 1]` |

---

## 🏗️ Estructura del Proyecto

```
src/
├── types/models.ts          # Interfaces TypeScript de todas las entidades
├── utils/
│   ├── financeUtils.ts      # Módulo de matemáticas financieras
│   └── storage.ts           # Capa de persistencia localStorage
├── store/useAppStore.ts     # Zustand store (sesión + time travel)
├── layouts/                 # Layouts por rol (SuperAdmin, Admin, Cliente)
├── pages/
│   ├── superadmin/          # Dashboard y CRUD de tiendas
│   ├── admin/               # Dashboard, clientes, productos, POS, estado de cuenta
│   └── cliente/             # Vista solo lectura del cliente
└── components/
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
```

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
