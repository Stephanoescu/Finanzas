import React, { useState } from 'react';
import { useAppStore, useAppData } from '../../store/useAppStore';
import { storageClientes, generarId } from '../../utils/storage';
import { Cliente, TipoTasa } from '../../types/models';

export default function ATClientes() {
  const { sesion, refrescarDatos } = useAppStore();
  const { clientes } = useAppData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  // Form state
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [passwordHash, setPasswordHash] = useState('');
  const [tipoTasa, setTipoTasa] = useState<TipoTasa>('TNA');
  const [tasaInteres, setTasaInteres] = useState('');
  const [tasaMoratoria, setTasaMoratoria] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  const [maxMeses, setMaxMeses] = useState('');
  const [diaCorte, setDiaCorte] = useState('');
  const [diaPago, setDiaPago] = useState('');

  if (!sesion || !sesion.tiendaId) {
    return <div>Acceso denegado</div>;
  }

  const clientesTienda = clientes.filter((c) => c.tiendaId === sesion.tiendaId);

  const handleOpenModal = (cliente?: Cliente) => {
    if (cliente) {
      setEditingCliente(cliente);
      setNombreCompleto(cliente.nombreCompleto);
      setDni(cliente.dni || '');
      setTelefono(cliente.telefono || '');
      setDireccion(cliente.direccion || '');
      setEmail(cliente.email || '');
      setUsername(cliente.username);
      setPasswordHash(cliente.passwordHash);
      setTipoTasa(cliente.tipoTasa);
      setTasaInteres((cliente.tasaInteres * 100).toString());
      setTasaMoratoria((cliente.tasaMoratoria * 100).toString());
      setLimiteCredito(cliente.limiteCredito.toString());
      setMaxMeses(cliente.maxMeses.toString());
      setDiaCorte(cliente.diaCorte.toString());
      setDiaPago(cliente.diaPago.toString());
    } else {
      setEditingCliente(null);
      setNombreCompleto('');
      setDni('');
      setTelefono('');
      setDireccion('');
      setEmail('');
      setUsername('');
      setPasswordHash('');
      setTipoTasa('TNA');
      setTasaInteres('');
      setTasaMoratoria('');
      setLimiteCredito('');
      setMaxMeses('');
      setDiaCorte('');
      setDiaPago('');
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newCliente: Cliente = {
      id: editingCliente ? editingCliente.id : generarId('cli'),
      tiendaId: sesion.tiendaId!,
      nombreCompleto,
      dni,
      telefono,
      direccion,
      email,
      username,
      passwordHash,
      tipoTasa,
      tasaInteres: parseFloat(tasaInteres) / 100 || 0,
      tasaMoratoria: parseFloat(tasaMoratoria) / 100 || 0,
      limiteCredito: parseFloat(limiteCredito) || 0,
      maxMeses: parseInt(maxMeses) || 1,
      diaCorte: parseInt(diaCorte) || 1,
      diaPago: parseInt(diaPago) || 1,
      saldoUtilizado: editingCliente ? editingCliente.saldoUtilizado : 0,
      activo: editingCliente ? editingCliente.activo : true,
      creadoEn: editingCliente ? editingCliente.creadoEn : new Date().toISOString(),
    };

    storageClientes.guardar(newCliente);
    refrescarDatos();
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
      storageClientes.eliminar(id);
      refrescarDatos();
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Gestión de Clientes</h1>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          Nuevo Cliente
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Lista de Clientes</h2>
        </div>
        <div className="card-body">
          {clientesTienda.length === 0 ? (
            <p className="text-gray-500">No hay clientes registrados.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>DNI</th>
                    <th>Teléfono</th>
                    <th>Tasa</th>
                    <th>Límite Crédito</th>
                    <th>Día Corte/Pago</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesTienda.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nombreCompleto}</td>
                      <td>{c.dni || '-'}</td>
                      <td>{c.telefono || '-'}</td>
                      <td>
                        {c.tipoTasa} {(c.tasaInteres * 100).toFixed(2)}%
                      </td>
                      <td>S/ {c.limiteCredito.toFixed(2)}</td>
                      <td>
                        {c.diaCorte} / {c.diaPago}
                      </td>
                      <td>
                        {c.activo ? (
                          <span className="badge-green">Activo</span>
                        ) : (
                          <span className="badge-red">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleOpenModal(c)}
                          className="btn-secondary mr-2"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="btn-danger"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="card-header flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500">
                &times;
              </button>
            </div>
            <div className="card-body">
              <form onSubmit={handleSave}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nombre Completo *</label>
                    <input
                      required
                      className="input w-full"
                      value={nombreCompleto}
                      onChange={(e) => setNombreCompleto(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">DNI</label>
                    <input
                      className="input w-full"
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <input
                      className="input w-full"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Dirección</label>
                    <input
                      className="input w-full"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      className="input w-full"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Usuario *</label>
                    <input
                      required
                      className="input w-full"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Contraseña *</label>
                    <input
                      required
                      className="input w-full"
                      type="password"
                      value={passwordHash}
                      onChange={(e) => setPasswordHash(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Tipo de Tasa *</label>
                    <select
                      className="input w-full"
                      value={tipoTasa}
                      onChange={(e) => setTipoTasa(e.target.value as TipoTasa)}
                    >
                      <option value="TNA">TNA (Nominal Anual)</option>
                      <option value="TEA">TEA (Efectiva Anual)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Tasa de Interés (%) *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="input w-full"
                      value={tasaInteres}
                      onChange={(e) => setTasaInteres(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Tasa Moratoria (%) *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="input w-full"
                      value={tasaMoratoria}
                      onChange={(e) => setTasaMoratoria(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Límite de Crédito *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="input w-full"
                      value={limiteCredito}
                      onChange={(e) => setLimiteCredito(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Meses Máximos *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="24"
                      className="input w-full"
                      value={maxMeses}
                      onChange={(e) => setMaxMeses(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Día de Corte *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="28"
                      className="input w-full"
                      value={diaCorte}
                      onChange={(e) => setDiaCorte(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Día de Pago *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="28"
                      className="input w-full"
                      value={diaPago}
                      onChange={(e) => setDiaPago(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button type="button" onClick={handleCloseModal} className="btn-secondary mr-2">
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
