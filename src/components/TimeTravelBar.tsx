import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Clock, CalendarClock, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TimeTravelBar() {
  const { fechaSimulada, usandoFechaSimulada, setFechaSimulada, getFechaActual } = useAppStore();
  const [editando, setEditando] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const fechaActual = getFechaActual();

  const handleActivar = () => {
    // Formatea la fecha actual para el input datetime-local
    const now = getFechaActual();
    setInputValue(format(now, "yyyy-MM-dd'T'HH:mm"));
    setEditando(true);
  };

  const handleGuardar = () => {
    if (inputValue) {
      setFechaSimulada(new Date(inputValue));
    }
    setEditando(false);
  };

  const handleDesactivar = () => {
    setFechaSimulada(null);
    setEditando(false);
  };

  return (
    <div
      className={`border-b px-4 py-2 flex items-center gap-3 text-sm ${
        usandoFechaSimulada
          ? 'bg-warning-50 border-warning-500 text-warning-700'
          : 'bg-white border-gray-200 text-gray-500'
      }`}
    >
      <CalendarClock className="w-4 h-4 flex-shrink-0" />

      {!editando ? (
        <>
          <span className="flex items-center gap-1.5">
            {usandoFechaSimulada ? (
              <>
                <span className="font-semibold">⏰ Fecha simulada:</span>
                <span className="font-mono font-semibold">
                  {format(fechaActual, "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                </span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Fecha del sistema:{' '}
                  <span className="font-medium text-gray-700">
                    {format(fechaActual, "d 'de' MMMM yyyy", { locale: es })}
                  </span>
                </span>
              </>
            )}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleActivar}
              className="text-xs px-2 py-1 rounded border border-current opacity-70 hover:opacity-100 transition-opacity"
            >
              {usandoFechaSimulada ? 'Cambiar fecha' : 'Simular fecha'}
            </button>
            {usandoFechaSimulada && (
              <button
                onClick={handleDesactivar}
                className="text-xs px-2 py-1 rounded border border-current opacity-70 hover:opacity-100 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Usar fecha real
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <span className="font-medium">Fecha a simular:</span>
          <input
            type="datetime-local"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="text-sm border border-warning-500 rounded px-2 py-0.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-warning-500"
          />
          <button
            onClick={handleGuardar}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-warning-500 text-white rounded hover:bg-warning-700"
          >
            <Check className="w-3 h-3" /> Aplicar
          </button>
          <button
            onClick={() => setEditando(false)}
            className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-100"
          >
            <X className="w-3 h-3" /> Cancelar
          </button>
        </>
      )}
    </div>
  );
}

