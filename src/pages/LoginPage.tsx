import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { BookOpen, Lock, User, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Pequeño delay para simular async
    await new Promise((r) => setTimeout(r, 400));

    const result = login({ username, password });
    setLoading(false);

    if (result.exito) {
      if (result.rol === 'superadmin') navigate('/superadmin');
      else if (result.rol === 'admin_tienda') navigate('/admin');
      else navigate('/cliente');
    } else {
      setError(result.error ?? 'Error de autenticación');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4 backdrop-blur-sm">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Cuaderno de Créditos</h1>
          <p className="text-primary-200 mt-1 text-sm">Sistema de crédito para pequeños comercios</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Iniciar Sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  className="input pl-9"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-danger-700 bg-danger-50 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Verificando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          {/* Hint para demo */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-600">Cuentas demo:</p>
            <p>SuperAdmin: <code className="font-mono">superadmin / admin123</code></p>
            <p>Admin Tienda: <code className="font-mono">admin / tienda123</code></p>
            <p className="italic">Los clientes son creados por el admin de la tienda.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

