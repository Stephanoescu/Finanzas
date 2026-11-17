import { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Ícono "?" con tooltip accesible: se abre por hover, foco de teclado o toque,
 * y se cierra con Escape o al tocar fuera. Se posiciona con `fixed` para no
 * quedar recortado por modales con scroll.
 */
export default function HelpTip({ text }: { text: string }) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const abierto = hover || pinned;

  useEffect(() => {
    if (!abierto || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const ancho = 256;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - ancho / 2), window.innerWidth - ancho - 8);
    setPos({ top: r.bottom + 6, left });
  }, [abierto]);

  // Escape cierra el tooltip en cualquier modo (hover, foco o fijado)
  useEffect(() => {
    if (!abierto) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setHover(false);
      setPinned(false);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [abierto]);

  useEffect(() => {
    if (!pinned) return;
    const cerrar = (e: Event) => {
      if (e instanceof MouseEvent || e instanceof TouchEvent) {
        if (btnRef.current?.contains(e.target as Node)) return;
      }
      setPinned(false);
    };
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('touchstart', cerrar);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('touchstart', cerrar);
    };
  }, [pinned]);

  return (
    <span className="inline-flex align-middle ml-1">
      <button
        ref={btnRef}
        type="button"
        aria-label="Ayuda"
        aria-describedby={abierto ? id : undefined}
        aria-expanded={abierto}
        className="text-gray-400 hover:text-primary-600 focus:text-primary-600 focus:outline-none"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={(e) => {
          e.preventDefault();
          setPinned((p) => !p);
        }}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {abierto && pos && (
        <span
          id={id}
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 256 }}
          className="z-[100] rounded-lg bg-gray-900 text-white text-xs font-normal normal-case leading-snug p-2.5 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
