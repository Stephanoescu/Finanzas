import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Store } from 'lucide-react';
import { useAppStore, useAppData } from '../../store/useAppStore';
import { storageTiendas, storageUsuarios, generarId } from '../../utils/storage';
import { Tienda, Usuario } from '../../types/models';
import HelpTip from '../../components/HelpTip';

const SATiendas: React.FC = () => {
  const { refrescarDatos } = useAppStore();
  const { tiendas, usuarios } = useAppData();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTienda, setEditingTienda] = useState<Tienda | null>(null);
  
  // Form state
  const [nombre, setNombre] = useState('');
  const [giro, setGiro] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tasaMaxBCRP, setTasaMaxBCRP] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminNombreCompleto, setAdminNombreCompleto] = useState('');

  const resetForm = () => {
    setNombre('');
    setGiro('');
    setDireccion('');
    setTelefono('');
    setTasaMaxBCRP('');
    setAdminUsername('');
    setAdminPassword('');
    setAdminNombreCompleto('');
    setEditingTienda(null);
  };

  const openModal = (tienda?: Tienda) => {
    resetForm();
    if (tienda) {
      setEditingTienda(tienda);
      setNombre(tienda.nombre);
      setGiro(tienda.giro);
      setDireccion(tienda.direccion || '');
      setTelefono(tienda.telefono || '');
      setTasaMaxBCRP(tienda.tasaMaxBCRP !== undefined ? String(+(tienda.tasaMaxBCRP * 100).toFixed(6)) : '');
      
      const admin = usuarios.find((u: Usuario) => u.id === tienda.adminId);
      if (admin) {
        setAdminUsername(admin.username);
        setAdminPassword('');
        setAdminNombreCompleto(admin.nombreCompleto);
      }
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ahora = new Date().toISOString();
    const tope = tasaMaxBCRP.trim() === '' ? undefined : parseFloat(tasaMaxBCRP) / 100;
    
    if (editingTienda) {
      // Update existing tienda
      const updatedTienda: Tienda = {
        ...editingTienda,
        nombre,
        giro,
        direccion,
        telefono,
        tasaMaxBCRP: tope,
      };
      
      storageTiendas.guardar(updatedTienda);
      
      // Update Admin if changes were made
      const admin = usuarios.find((u: Usuario) => u.id === editingTienda.adminId);
      if (admin) {
        const updatedAdmin: Usuario = {
          ...admin,
          username: adminUsername,
          nombreCompleto: adminNombreCompleto,
          ...(adminPassword ? { passwordHash: adminPassword } : {}),
        };
        storageUsuarios.guardar(updatedAdmin);
      }
    } else {
      // Create new admin user
      const adminId = generarId('admin');
      const tiendaId = generarId('tienda');

      const newAdmin: Usuario = {
        id: adminId,
        username: adminUsername,
        passwordHash: adminPassword,
        rol: 'admin_tienda',
        nombreCompleto: adminNombreCompleto,
        tiendaId: tiendaId,
        activo: true,
        creadoEn: ahora,
      };
      
      // Create new tienda
      const newTienda: Tienda = {
        id: tiendaId,
        nombre,
        giro,
        direccion,
        telefono,
        tasaMaxBCRP: tope,
        adminId: adminId,
        activa: true,
        creadaEn: ahora,
      };
      
      storageUsuarios.guardar(newAdmin);
      storageTiendas.guardar(newTienda);
    }
    
    refrescarDatos();
    closeModal();
  };

  const handleDelete = (tiendaId: string, adminId?: string) => {
    if (window.confirm('¿Está seguro de eliminar esta tienda? Esta acción no se puede deshacer.')) {
      storageTiendas.eliminar(tiendaId);
      if (adminId) {
        storageUsuarios.eliminar(adminId);
      }
      refrescarDatos();
    }
  };

  const toggleEstado = (tienda: Tienda) => {
    const updatedTienda: Tienda = {
      ...tienda,
      activa: !tienda.activa,
    };
    storageTiendas.guardar(updatedTienda);
    refrescarDatos();
  };

  const getAdminDetails = (adminId?: string) => {
    if (!adminId) return { username: 'N/A', nombre: 'N/A' };
    const admin = usuarios.find((u: Usuario) => u.id === adminId);
    return admin ? { username: admin.username, nombre: admin.nombreCompleto } : { username: 'Desconocido', nombre: 'Desconocido' };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Tiendas</h1>
        <button onClick={() => openModal()} className="btn-primary flex items-center">
          <Plus className="w-5 h-5 mr-2" />
          Nueva Tienda
        </button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-wrapper">
            <table className="table w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Giro</th>
                  <th className="p-4">Dirección</th>
                  <th className="p-4">Admin Usuario</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tiendas.map((tienda: Tienda) => {
                  const adminDetails = getAdminDetails(tienda.adminId);
                  return (
                    <tr key={tienda.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900 flex items-center">
                        <Store className="w-5 h-5 mr-2 text-gray-400" />
                        {tienda.nombre}
                      </td>
                      <td className="p-4 text-gray-600">{tienda.giro}</td>
                      <td className="p-4 text-gray-600">{tienda.direccion || '-'}</td>
                      <td className="p-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{adminDetails.nombre}</p>
                          <p className="text-gray-500">@{adminDetails.username}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => toggleEstado(tienda)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${tienda.activa ? 'badge-green hover:bg-green-200' : 'badge-red hover:bg-red-200'}`}
                        >
                          {tienda.activa ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button onClick={() => openModal(tienda)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(tienda.id, tienda.adminId)} className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors inline-flex">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {tiendas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No hay tiendas registradas. Haga clic en "Nueva Tienda" para comenzar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">
                {editingTienda ? 'Editar Tienda' : 'Nueva Tienda'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Datos de la Tienda</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label block text-sm font-medium text-gray-700 mb-1">Nombre de la Tienda<HelpTip text="Nombre comercial del negocio. Aparece en el panel del cliente. No afecta el cálculo." /></label>
                    <input 
                      type="text" 
                      className="input w-full border border-gray-300 rounded-md px-3 py-2" 
                      value={nombre} 
                      onChange={(e) => setNombre(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="label block text-sm font-medium text-gray-700 mb-1">Giro (Ej. Bodega, Carnicería)<HelpTip text="Rubro del negocio (bodega, carnicería, peluquería…). Es solo informativo." /></label>
                    <input 
                      type="text" 
                      className="input w-full border border-gray-300 rounded-md px-3 py-2" 
                      value={giro} 
                      onChange={(e) => setGiro(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label block text-sm font-medium text-gray-700 mb-1">Dirección (Opcional)<HelpTip text="Dirección del local. Es solo informativo." /></label>
                    <input 
                      type="text" 
                      className="input w-full border border-gray-300 rounded-md px-3 py-2" 
                      value={direccion} 
                      onChange={(e) => setDireccion(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="label block text-sm font-medium text-gray-700 mb-1">Teléfono (Opcional)<HelpTip text="Teléfono de contacto de la tienda. Es solo informativo." /></label>
                    <input 
                      type="tel" 
                      className="input w-full border border-gray-300 rounded-md px-3 py-2" 
                      value={telefono} 
                      onChange={(e) => setTelefono(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="label block text-sm font-medium text-gray-700 mb-1">Tasa máxima BCRP (TEA %)<HelpTip text="Tope legal de tasas, en TEA porcentual (ej. 90 = 90 %). Las tasas compensatoria y moratoria de los clientes de esta tienda, expresadas en TEA, no pueden superarlo. Déjelo vacío para no aplicar tope." /></label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input w-full border border-gray-300 rounded-md px-3 py-2"
                      value={tasaMaxBCRP}
                      onChange={(e) => setTasaMaxBCRP(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Administrador de la Tienda</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="label block text-sm font-medium text-gray-700 mb-1">Nombre Completo del Admin<HelpTip text="Nombre de la persona que administra la tienda. Es solo informativo." /></label>
                    <input 
                      type="text" 
                      className="input w-full border border-gray-300 rounded-md px-3 py-2" 
                      value={adminNombreCompleto} 
                      onChange={(e) => setAdminNombreCompleto(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="label block text-sm font-medium text-gray-700 mb-1">Usuario de Acceso<HelpTip text="Usuario con el que el administrador inicia sesión. Debe ser único." /></label>
                    <input 
                      type="text" 
                      className="input w-full border border-gray-300 rounded-md px-3 py-2" 
                      value={adminUsername} 
                      onChange={(e) => setAdminUsername(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="label block text-sm font-medium text-gray-700 mb-1">
                      Contraseña {editingTienda && <span className="text-xs font-normal text-gray-500">(Opcional)</span>}<HelpTip text="Clave de acceso del administrador. Al editar, déjela vacía para conservar la actual." />
                    </label>
                    <input 
                      type="password" 
                      className="input w-full border border-gray-300 rounded-md px-3 py-2" 
                      value={adminPassword} 
                      onChange={(e) => setAdminPassword(e.target.value)} 
                      required={!editingTienda} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onClick={closeModal} className="btn-secondary px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  {editingTienda ? 'Guardar Cambios' : 'Crear Tienda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SATiendas;
