import React from 'react';
import { Store, Users, FileText, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppData } from '../../store/useAppStore';

const SADashboard: React.FC = () => {
  const { tiendas, clientes, transacciones, usuarios } = useAppData();

  const totalTiendas = tiendas.length;
  const tiendasActivas = tiendas.filter((t: any) => t.activa).length;
  const totalClientes = clientes.length;
  const totalTransacciones = transacciones.length;

  const getAdminName = (adminId?: string) => {
    if (!adminId) return 'Sin admin';
    const admin = usuarios.find((u: any) => u.id === adminId);
    return admin ? admin.nombreCompleto : 'Desconocido';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Panel SuperAdmin</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Tiendas</p>
              <p className="stat-value">{totalTiendas}</p>
            </div>
            <Store className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Tiendas Activas</p>
              <p className="stat-value">{tiendasActivas}</p>
            </div>
            <Activity className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Clientes</p>
              <p className="stat-value">{totalClientes}</p>
            </div>
            <Users className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Transacciones</p>
              <p className="stat-value">{totalTransacciones}</p>
            </div>
            <FileText className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Tiendas Registradas</h2>
          <Link to="/superadmin/tiendas" className="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium">
            Ver todas
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        <div className="card-body p-0">
          <div className="table-wrapper">
            <table className="table w-full">
              <thead>
                <tr className="text-left border-b bg-gray-50">
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Giro</th>
                  <th className="p-4">Admin</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tiendas.slice(0, 5).map((tienda: any) => (
                  <tr key={tienda.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{tienda.nombre}</td>
                    <td className="p-4 text-gray-600">{tienda.giro}</td>
                    <td className="p-4 text-gray-600">{getAdminName(tienda.adminId)}</td>
                    <td className="p-4">
                      <span className={tienda.activa ? 'badge-green' : 'badge-red'}>
                        {tienda.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link to="/superadmin/tiendas" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Administrar
                      </Link>
                    </td>
                  </tr>
                ))}
                {tiendas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No hay tiendas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SADashboard;
