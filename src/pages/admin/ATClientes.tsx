import React, { useState } from 'react';
import { useAppStore, useAppData } from '../../store/useAppStore';
import { storageClientes, generarId } from '../../utils/storage';
import { Cliente, TipoTasa, Moneda } from '../../types/models';
import { calcularTEA, formatearMoneda, formatearTasa } from '../../utils/financeUtils';
import HelpTip from '../../components/HelpTip';

export default function ATClientes() {
  const { sesion, refrescarDatos } = useAppStore();
  const { clientes, tiendas } = useAppData();

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
  const [moneda, setMoneda] = useState<Moneda>('PEN');
  const [tipoTasa, setTipoTasa] = useState<TipoTasa>('TNA');
  const [capitalizacion, setCapitalizacion] = useState('30');
  const [error, setError] = useState('');
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
      setMoneda(cliente.moneda ?? 'PEN');
      setTipoTasa(cliente.tipoTasa);
      setCapitalizacion(String(cliente.capitalizacion ?? 30));
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
      setMoneda('PEN');
      setTipoTasa('TNA');
      setCapitalizacion('30');
      setTasaInteres('');
      setTasaMoratoria('');
      setLimiteCredito('');
      setMaxMeses('');
      setDiaCorte('');
      setDiaPago('');
    }
    setError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const interes = parseFloat(tasaInteres) / 100;
    const moratoria = parseFloat(tasaMoratoria) / 100;
    const cap = parseInt(capitalizacion) || 30;
    const dCorte = parseInt(diaCorte);
    const dPago = parseInt(diaPago);

    if (!(interes >= 0) || !(moratoria >= 0)) {
      setError('Las tasas deben ser números mayores o iguales a 0.');
      return;
    }
    if (dCorte === dPago) {
      setError('El día de pago debe ser distinto del día de corte.');
      return;
    }
    // Tope de tasas: se compara en TEA equivalente contra la tasa máxima BCRP de la tienda
    const tienda = tiendas.find((t) => t.id === sesion.tiendaId);
    const tope = tienda?.tasaMaxBCRP;
    if (tope !== undefined && tope > 0) {
      const teaInteres = calcularTEA(interes, tipoTasa, cap);
      const teaMora = calcularTEA(moratoria, tipoTasa, cap);
      if (teaInteres > tope) {
        setError(`La tasa compensatoria equivale a una TEA de ${formatearTasa(teaInteres, 4)}, que supera la tasa máxima BCRP de la tienda (${formatearTasa(tope, 4)}).`);
        return;
      }
      if (teaMora > tope) {
        setError(`La tasa moratoria equivale a una TEA de ${formatearTasa(teaMora, 4)}, que supera la tasa máxima BCRP de la tienda (${formatearTasa(tope, 4)}).`);
        return;
      }
    }
    setError('');

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
      moneda,
      tipoTasa,
      capitalizacion: cap,
      tasaInteres: interes || 0,
      tasaMoratoria: moratoria || 0,
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
                      <td>{formatearMoneda(c.limiteCredito, c.moneda)}</td>
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
                    <label className="label">Nombre Completo *<HelpTip text="Nombres y apellidos del cliente tal como aparecerán en su estado de cuenta. Es solo informativo; no afecta el cálculo." /></label>
                    <input
                      required
                      className="input w-full"
                      value={nombreCompleto}
                      onChange={(e) => setNombreCompleto(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">DNI<HelpTip text="Documento de identidad (8 dígitos en Perú). Solo sirve para identificar al cliente; no afecta el cálculo." /></label>
                    <input
                      className="input w-full"
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Teléfono<HelpTip text="Número de contacto para cobranza. Es solo informativo." /></label>
                    <input
                      className="input w-full"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Dirección<HelpTip text="Domicilio del cliente. Es solo informativo." /></label>
                    <input
                      className="input w-full"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Email<HelpTip text="Correo de contacto. Es solo informativo." /></label>
                    <input
                      type="email"
                      className="input w-full"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Usuario *<HelpTip text="Nombre de usuario con el que el cliente ingresa a ver su estado de cuenta. Debe ser único." /></label>
                    <input
                      required
                      className="input w-full"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Contraseña *<HelpTip text="Clave de acceso del cliente a su cuenta." /></label>
                    <input
                      required
                      className="input w-full"
                      type="password"
                      value={passwordHash}
                      onChange={(e) => setPasswordHash(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Moneda *<HelpTip text="Moneda de la línea y de todas las operaciones de este cliente (S/ para soles, US$ para dólares). Solo cambia el símbolo mostrado; los montos se ingresan y calculan en esa moneda." /></label>
                    <select
                      className="input w-full"
                      value={moneda}
                      onChange={(e) => setMoneda(e.target.value as Moneda)}
                    >
                      <option value="PEN">PEN (Soles, S/)</option>
                      <option value="USD">USD (Dólares, US$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Tipo de Tasa *<HelpTip text="TEA: tasa efectiva anual, ya incluye la capitalización. TNA: tasa nominal anual, requiere indicar cada cuánto se capitaliza. Ambas se convierten a tasa diaria y mensual con una misma fórmula." /></label>
                    <select
                      className="input w-full"
                      value={tipoTasa}
                      onChange={(e) => setTipoTasa(e.target.value as TipoTasa)}
                    >
                      <option value="TNA">TNA (Nominal Anual)</option>
                      <option value="TEA">TEA (Efectiva Anual)</option>
                    </select>
                  </div>
                  {tipoTasa === 'TNA' && (
                    <div>
                      <label className="label">Capitalización de la TNA *<HelpTip text="Días de cada período de capitalización de la TNA: 1 = diaria, 30 = mensual. Se usa en TEP(n días) = (1 + TNA/m)^(n/d) − 1, con d = días del período y m = 360/d. Ej.: TNA 24 % mensual → TEM 2 %." /></label>
                      <select
                        className="input w-full"
                        value={capitalizacion}
                        onChange={(e) => setCapitalizacion(e.target.value)}
                      >
                        <option value="1">Diaria (1 día)</option>
                        <option value="15">Quincenal (15 días)</option>
                        <option value="30">Mensual (30 días)</option>
                        <option value="60">Bimestral (60 días)</option>
                        <option value="90">Trimestral (90 días)</option>
                        <option value="180">Semestral (180 días)</option>
                        <option value="360">Anual (360 días)</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="label">Tasa de Interés (%) *<HelpTip text="Tasa anual pactada (compensatoria), en porcentaje (ej. 30 = 30 %). Si es TNA, indique su capitalización. Se convierte a TEM con (1+TEA)^(30/360) − 1 y a TED con (1+TEA)^(1/360) − 1. No puede superar la tasa máxima BCRP de la tienda." /></label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-full"
                      value={tasaInteres}
                      onChange={(e) => setTasaInteres(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Tasa Moratoria (%) *<HelpTip text="Tasa anual que se cobra por cada día de atraso, en porcentaje. Mora = cuota × [(1+TEA)^(días/360) − 1], sobre días exactos de atraso. No puede superar la tasa máxima BCRP de la tienda." /></label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-full"
                      value={tasaMoratoria}
                      onChange={(e) => setTasaMoratoria(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Límite de Crédito *<HelpTip text="Monto máximo de deuda de capital pendiente que el cliente puede mantener, en la moneda del cliente. Una compra que lo excede se rechaza." /></label>
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
                    <label className="label">Meses Máximos *<HelpTip text="Número máximo de cuotas mensuales (1 a 24) que se le pueden ofrecer en el punto de venta." /></label>
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
                    <label className="label">Día de Corte *<HelpTip text="Día del mes (1–28) en que cierra el ciclo de facturación. Las compras hasta ese día se pagan en el ciclo actual; las posteriores, en el siguiente." /></label>
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
                    <label className="label">Día de Pago *<HelpTip text="Día del mes (1–28) en que vence el pago del ciclo; debe ser distinto del día de corte. La deuda se capitaliza hasta esa fecha y la primera cuota vence un mes después." /></label>
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
                {error && (
                  <p className="mt-4 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">{error}</p>
                )}
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
