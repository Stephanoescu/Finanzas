// ============================================================
// CUADERNO DIGITAL DE CRÉDITOS — STORE GLOBAL (Zustand)
// useAppStore.ts
// ============================================================

import { create } from 'zustand';
import type { SesionActiva } from '../types/models';
import {
  autenticar,
  leerDatos,
} from '../utils/storage';
import type { CredencialesLogin, ResultadoLogin } from '../utils/storage';

// ─── ESTADO ──────────────────────────────────────────────────

interface AppState {
  // Sesión
  sesion: SesionActiva | null;
  isLoading: boolean;

  // Simulador de fecha (Time Travel)
  fechaSimulada: Date | null;      // null = usa Date.now() real
  usandoFechaSimulada: boolean;

  // Acciones de sesión
  login: (creds: CredencialesLogin) => ResultadoLogin;
  logout: () => void;

  // Acciones de fecha simulada
  setFechaSimulada: (fecha: Date | null) => void;
  getFechaActual: () => Date;     // Retorna fecha simulada o real

  // Refresco de datos (para forzar re-renders cuando localStorage cambia)
  dataVersion: number;
  refrescarDatos: () => void;
}

// ─── STORE ───────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  sesion: null,
  isLoading: false,
  fechaSimulada: null,
  usandoFechaSimulada: false,
  dataVersion: 0,

  // ── Login ──
  login: (creds: CredencialesLogin): ResultadoLogin => {
    const result = autenticar(creds);
    if (result.exito && result.rol && result.userId) {
      set({
        sesion: {
          userId: result.userId,
          tiendaId: result.tiendaId,
          rol: result.rol,
          nombreCompleto: result.nombreCompleto ?? '',
        },
      });
    }
    return result;
  },

  // ── Logout ──
  logout: () => {
    set({ sesion: null });
  },

  // ── Fecha simulada ──
  setFechaSimulada: (fecha: Date | null) => {
    set({
      fechaSimulada: fecha,
      usandoFechaSimulada: fecha !== null,
    });
  },

  getFechaActual: (): Date => {
    const { fechaSimulada } = get();
    return fechaSimulada ?? new Date();
  },

  // ── Refrescar datos ──
  refrescarDatos: () => {
    set((state) => ({ dataVersion: state.dataVersion + 1 }));
  },
}));

// ─── HOOK DE CONVENIENCIA: Datos actuales ────────────────────

import { useMemo } from 'react';

/**
 * Hook que lee todos los datos de localStorage y los retorna.
 * Se actualiza automáticamente cuando se llama refrescarDatos().
 */
export function useAppData() {
  const dataVersion = useAppStore((s) => s.dataVersion);

  return useMemo(() => {
    return leerDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);
}
