// ============================================================
// CUADERNO DIGITAL DE CRÉDITOS — CAPA DE PERSISTENCIA
// storage.ts — Wrapper tipado sobre localStorage
// ============================================================

import type {
  AppData,
  SuperAdmin,
  Tienda,
  Usuario,
  Cliente,
  Producto,
  Transaccion,
  Pago,
} from '../types/models';

const STORAGE_KEY = 'cdc_data';
const CURRENT_VERSION = '1.0.0';

// ─── DATOS INICIALES (Seed) ──────────────────────────────────

function crearDatosIniciales(): AppData {
  const ahora = new Date().toISOString();

  const superAdminId = 'sa-001';
  const tiendaId = 'tienda-001';
  const adminId = 'admin-001';

  const superAdmin: SuperAdmin = {
    id: superAdminId,
    username: 'superadmin',
    // Password: "admin123" — en demo guardamos en claro; en prod usar hash
    passwordHash: 'admin123',
    email: 'superadmin@cuadernocreditos.app',
    creadoEn: ahora,
  };

  const tienda: Tienda = {
    id: tiendaId,
    nombre: 'Bodega La Esquina',
    giro: 'Bodega',
    direccion: 'Jr. Las Flores 123',
    telefono: '987654321',
    activa: true,
    creadaEn: ahora,
    adminId: adminId,
  };

  const adminTienda: Usuario = {
    id: adminId,
    tiendaId: tiendaId,
    rol: 'admin_tienda',
    username: 'admin',
    // Password: "tienda123"
    passwordHash: 'tienda123',
    nombreCompleto: 'Administrador Principal',
    activo: true,
    creadoEn: ahora,
  };

  return {
    version: CURRENT_VERSION,
    superAdmins: [superAdmin],
    tiendas: [tienda],
    usuarios: [adminTienda],
    clientes: [],
    productos: [],
    transacciones: [],
    pagos: [],
    ultimaActualizacion: ahora,
  };
}

// ─── LECTURA Y ESCRITURA ─────────────────────────────────────

export function leerDatos(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const datos = crearDatosIniciales();
      guardarDatos(datos);
      return datos;
    }
    const parsed = JSON.parse(raw) as AppData;
    // Migración futura: if (parsed.version !== CURRENT_VERSION) migrate(parsed)
    return parsed;
  } catch (error) {
    console.error('[CDC] Error al leer localStorage, reiniciando datos:', error);
    const datos = crearDatosIniciales();
    guardarDatos(datos);
    return datos;
  }
}

export function guardarDatos(datos: AppData): void {
  try {
    datos.ultimaActualizacion = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
  } catch (error) {
    console.error('[CDC] Error al guardar en localStorage:', error);
    throw new Error('No se pudo guardar los datos. El almacenamiento puede estar lleno.');
  }
}

// ─── HELPERS POR ENTIDAD ─────────────────────────────────────



// ── SuperAdmin ──
export const storageSupAdmin = {
  listar: (): SuperAdmin[] => leerDatos().superAdmins,
  guardar: (item: SuperAdmin) => {
    const datos = leerDatos();
    const idx = datos.superAdmins.findIndex((x) => x.id === item.id);
    if (idx >= 0) datos.superAdmins[idx] = item;
    else datos.superAdmins.push(item);
    guardarDatos(datos);
  },
  eliminar: (id: string) => {
    const datos = leerDatos();
    datos.superAdmins = datos.superAdmins.filter((x) => x.id !== id);
    guardarDatos(datos);
  },
};

// ── Tiendas ──
export const storageTiendas = {
  listar: (): Tienda[] => leerDatos().tiendas,
  porId: (id: string): Tienda | undefined =>
    leerDatos().tiendas.find((x) => x.id === id),
  guardar: (item: Tienda) => {
    const datos = leerDatos();
    const idx = datos.tiendas.findIndex((x) => x.id === item.id);
    if (idx >= 0) datos.tiendas[idx] = item;
    else datos.tiendas.push(item);
    guardarDatos(datos);
  },
  eliminar: (id: string) => {
    const datos = leerDatos();
    datos.tiendas = datos.tiendas.filter((x) => x.id !== id);
    guardarDatos(datos);
  },
};

// ── Usuarios (Admins de Tienda) ──
export const storageUsuarios = {
  listar: (): Usuario[] => leerDatos().usuarios,
  porId: (id: string): Usuario | undefined =>
    leerDatos().usuarios.find((x) => x.id === id),
  porTienda: (tiendaId: string): Usuario[] =>
    leerDatos().usuarios.filter((x) => x.tiendaId === tiendaId),
  porUsername: (username: string): Usuario | undefined =>
    leerDatos().usuarios.find((x) => x.username === username),
  guardar: (item: Usuario) => {
    const datos = leerDatos();
    const idx = datos.usuarios.findIndex((x) => x.id === item.id);
    if (idx >= 0) datos.usuarios[idx] = item;
    else datos.usuarios.push(item);
    guardarDatos(datos);
  },
  eliminar: (id: string) => {
    const datos = leerDatos();
    datos.usuarios = datos.usuarios.filter((x) => x.id !== id);
    guardarDatos(datos);
  },
};

// ── Clientes ──
export const storageClientes = {
  listar: (): Cliente[] => leerDatos().clientes,
  porId: (id: string): Cliente | undefined =>
    leerDatos().clientes.find((x) => x.id === id),
  porTienda: (tiendaId: string): Cliente[] =>
    leerDatos().clientes.filter((x) => x.tiendaId === tiendaId),
  porUsername: (username: string): Cliente | undefined =>
    leerDatos().clientes.find((x) => x.username === username),
  guardar: (item: Cliente) => {
    const datos = leerDatos();
    const idx = datos.clientes.findIndex((x) => x.id === item.id);
    if (idx >= 0) datos.clientes[idx] = item;
    else datos.clientes.push(item);
    guardarDatos(datos);
  },
  eliminar: (id: string) => {
    const datos = leerDatos();
    datos.clientes = datos.clientes.filter((x) => x.id !== id);
    guardarDatos(datos);
  },
};

// ── Productos ──
export const storageProductos = {
  listar: (): Producto[] => leerDatos().productos,
  porId: (id: string): Producto | undefined =>
    leerDatos().productos.find((x) => x.id === id),
  porTienda: (tiendaId: string): Producto[] =>
    leerDatos().productos.filter((x) => x.tiendaId === tiendaId && x.activo),
  guardar: (item: Producto) => {
    const datos = leerDatos();
    const idx = datos.productos.findIndex((x) => x.id === item.id);
    if (idx >= 0) datos.productos[idx] = item;
    else datos.productos.push(item);
    guardarDatos(datos);
  },
  eliminar: (id: string) => {
    const datos = leerDatos();
    datos.productos = datos.productos.filter((x) => x.id !== id);
    guardarDatos(datos);
  },
};

// ── Transacciones ──
export const storageTransacciones = {
  listar: (): Transaccion[] => leerDatos().transacciones,
  porId: (id: string): Transaccion | undefined =>
    leerDatos().transacciones.find((x) => x.id === id),
  porCliente: (clienteId: string): Transaccion[] =>
    leerDatos().transacciones.filter((x) => x.clienteId === clienteId),
  porTienda: (tiendaId: string): Transaccion[] =>
    leerDatos().transacciones.filter((x) => x.tiendaId === tiendaId),
  vigentes: (clienteId: string): Transaccion[] =>
    leerDatos().transacciones.filter(
      (x) => x.clienteId === clienteId && x.estado !== 'liquidado' && x.estado !== 'castigado'
    ),
  guardar: (item: Transaccion) => {
    const datos = leerDatos();
    const idx = datos.transacciones.findIndex((x) => x.id === item.id);
    if (idx >= 0) datos.transacciones[idx] = item;
    else datos.transacciones.push(item);
    guardarDatos(datos);
  },
  eliminar: (id: string) => {
    const datos = leerDatos();
    datos.transacciones = datos.transacciones.filter((x) => x.id !== id);
    guardarDatos(datos);
  },
};

// ── Pagos ──
export const storagePagos = {
  listar: (): Pago[] => leerDatos().pagos,
  porTransaccion: (transaccionId: string): Pago[] =>
    leerDatos().pagos.filter((x) => x.transaccionId === transaccionId),
  porCliente: (clienteId: string): Pago[] =>
    leerDatos().pagos.filter((x) => x.clienteId === clienteId),
  guardar: (item: Pago) => {
    const datos = leerDatos();
    const idx = datos.pagos.findIndex((x) => x.id === item.id);
    if (idx >= 0) datos.pagos[idx] = item;
    else datos.pagos.push(item);
    guardarDatos(datos);
  },
  eliminar: (id: string) => {
    const datos = leerDatos();
    datos.pagos = datos.pagos.filter((x) => x.id !== id);
    guardarDatos(datos);
  },
};

// ─── AUTENTICACIÓN SIMULADA ──────────────────────────────────

export interface CredencialesLogin {
  username: string;
  password: string;
}

export interface ResultadoLogin {
  exito: boolean;
  rol?: 'superadmin' | 'admin_tienda' | 'cliente';
  userId?: string;
  tiendaId?: string;
  nombreCompleto?: string;
  error?: string;
}

export function autenticar(creds: CredencialesLogin): ResultadoLogin {
  const datos = leerDatos();
  const { username, password } = creds;

  // 1. Buscar SuperAdmin
  const sa = datos.superAdmins.find(
    (x) => x.username === username && x.passwordHash === password
  );
  if (sa) {
    return {
      exito: true,
      rol: 'superadmin',
      userId: sa.id,
      nombreCompleto: 'Super Administrador',
    };
  }

  // 2. Buscar AdminTienda
  const admin = datos.usuarios.find(
    (x) => x.username === username && x.passwordHash === password && x.activo
  );
  if (admin) {
    return {
      exito: true,
      rol: 'admin_tienda',
      userId: admin.id,
      tiendaId: admin.tiendaId,
      nombreCompleto: admin.nombreCompleto,
    };
  }

  // 3. Buscar Cliente
  const cliente = datos.clientes.find(
    (x) => x.username === username && x.passwordHash === password && x.activo
  );
  if (cliente) {
    return {
      exito: true,
      rol: 'cliente',
      userId: cliente.id,
      tiendaId: cliente.tiendaId,
      nombreCompleto: cliente.nombreCompleto,
    };
  }

  return { exito: false, error: 'Usuario o contraseña incorrectos' };
}

// ─── UTILIDADES ──────────────────────────────────────────────

export function generarId(prefijo = 'id'): string {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function exportarJSON(): string {
  return JSON.stringify(leerDatos(), null, 2);
}

export function importarJSON(jsonStr: string): void {
  try {
    const datos = JSON.parse(jsonStr) as AppData;
    guardarDatos(datos);
  } catch {
    throw new Error('El archivo JSON no es válido');
  }
}

export function resetearDatos(): void {
  localStorage.removeItem(STORAGE_KEY);
}
