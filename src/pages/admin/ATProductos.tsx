import React, { useState } from 'react';
import { useAppStore, useAppData } from '../../store/useAppStore';
import { storageProductos, generarId } from '../../utils/storage';
import { Producto } from '../../types/models';

export default function ATProductos() {
  const { sesion, refrescarDatos } = useAppStore();
  const { productos } = useAppData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);

  // Form state
  const [descripcion, setDescripcion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [marca, setMarca] = useState('');
  const [unidad, setUnidad] = useState('');
  const [precioContado, setPrecioContado] = useState('');
  const [precioCredito, setPrecioCredito] = useState('');
  const [permiteCuotas, setPermiteCuotas] = useState(false);
  const [activo, setActivo] = useState(true);

  if (!sesion || !sesion.tiendaId) {
    return <div>Acceso denegado</div>;
  }

  // filter explicitly by store (ignoring active check so admin can see all)
  const productosTienda = productos.filter((p) => p.tiendaId === sesion.tiendaId);

  const handleOpenModal = (producto?: Producto) => {
    if (producto) {
      setEditingProducto(producto);
      setDescripcion(producto.descripcion);
      setProveedor(producto.proveedor || '');
      setMarca(producto.marca || '');
      setUnidad(producto.unidad);
      setPrecioContado(producto.precioContado.toString());
      setPrecioCredito(producto.precioCredito.toString());
      setPermiteCuotas(producto.permiteCuotas);
      setActivo(producto.activo);
    } else {
      setEditingProducto(null);
      setDescripcion('');
      setProveedor('');
      setMarca('');
      setUnidad('');
      setPrecioContado('');
      setPrecioCredito('');
      setPermiteCuotas(false);
      setActivo(true);
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newProducto: Producto = {
      id: editingProducto ? editingProducto.id : generarId('prod'),
      tiendaId: sesion.tiendaId!,
      descripcion,
      proveedor,
      marca,
      unidad,
      precioContado: parseFloat(precioContado) || 0,
      precioCredito: parseFloat(precioCredito) || 0,
      permiteCuotas,
      activo,
      creadoEn: editingProducto ? editingProducto.creadoEn : new Date().toISOString(),
    };

    storageProductos.guardar(newProducto);
    refrescarDatos();
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este producto?')) {
      storageProductos.eliminar(id);
      refrescarDatos();
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Catálogo de Productos</h1>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          Nuevo Producto
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Lista de Productos</h2>
        </div>
        <div className="card-body">
          {productosTienda.length === 0 ? (
            <p className="text-gray-500">No hay productos registrados.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Proveedor</th>
                    <th>Marca</th>
                    <th>Unidad</th>
                    <th>Precio Contado</th>
                    <th>Precio Crédito</th>
                    <th>Cuotas</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosTienda.map((p) => (
                    <tr key={p.id}>
                      <td>{p.descripcion}</td>
                      <td>{p.proveedor || '-'}</td>
                      <td>{p.marca || '-'}</td>
                      <td>{p.unidad}</td>
                      <td>S/ {p.precioContado.toFixed(2)}</td>
                      <td>S/ {p.precioCredito.toFixed(2)}</td>
                      <td>
                        {p.permiteCuotas ? (
                          <span className="badge-green">Sí</span>
                        ) : (
                          <span className="badge-yellow">No</span>
                        )}
                      </td>
                      <td>
                        {p.activo ? (
                          <span className="badge-green">Activo</span>
                        ) : (
                          <span className="badge-red">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleOpenModal(p)}
                          className="btn-secondary mr-2"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
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
          <div className="card w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="card-header flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500">
                &times;
              </button>
            </div>
            <div className="card-body">
              <form onSubmit={handleSave}>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="label">Descripción *</label>
                    <input
                      required
                      className="input w-full"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Proveedor</label>
                    <input
                      className="input w-full"
                      value={proveedor}
                      onChange={(e) => setProveedor(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Marca</label>
                    <input
                      className="input w-full"
                      value={marca}
                      onChange={(e) => setMarca(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Unidad *</label>
                    <input
                      required
                      className="input w-full"
                      value={unidad}
                      onChange={(e) => setUnidad(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Precio Contado *</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="input w-full"
                        value={precioContado}
                        onChange={(e) => setPrecioContado(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Precio Crédito *</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="input w-full"
                        value={precioCredito}
                        onChange={(e) => setPrecioCredito(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 mt-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={permiteCuotas}
                        onChange={(e) => setPermiteCuotas(e.target.checked)}
                      />
                      <span>Permite Cuotas</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={(e) => setActivo(e.target.checked)}
                      />
                      <span>Activo</span>
                    </label>
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
