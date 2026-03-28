import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, TrendingUp, RefreshCw, Download } from 'lucide-react';
import { useAssociateDetails, useAssociates } from '../services/associateService';
import { toast } from '../lib/toast';

export default function AssociateDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const associateId = Number(id);

  const { data: associatesData } = useAssociates({ limit: 100 });
  const associates = Array.isArray(associatesData?.data?.associates)
    ? associatesData.data.associates
    : Array.isArray(associatesData?.data)
      ? associatesData.data
      : [];
  const associate = associates.find((a: any) => Number(a.id) === associateId);

  const { portal, isLoading, createContribution, createDistribution, createReinvestment } = useAssociateDetails(associateId);

  const [showModal, setShowModal] = useState<'contribution' | 'distribution' | 'reinvestment' | null>(null);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center text-text-secondary">Cargando portal del socio...</div>;
  }

  if (!associate) {
    return (
      <div className="p-8 text-center text-text-secondary">
        <p>Socio no encontrado.</p>
        <button onClick={() => navigate('/associates')} className="mt-4 text-brand-primary">Volver a socios</button>
      </div>
    );
  }

  const associateName = (typeof associate?.name === 'string' && associate.name.trim())
    ? associate.name.trim()
    : [associate?.firstName, associate?.lastName].filter(Boolean).join(' ').trim() || 'Socio sin nombre';

  const portalSummary = portal?.summary;
  const totalContributions = portalSummary?.totalContributed ?? portal?.totalContributions ?? 0;
  const totalDistributions = portalSummary?.totalDistributed ?? portal?.totalDistributions ?? 0;
  const activeLoansCount = portalSummary?.activeLoanCount ?? portal?.activeLoansCount ?? 0;
  const participatedLoans = Array.isArray(portal?.loans) ? portal.loans : [];

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setIsSubmitting(true);
    try {
      const payload = { amount: parseFloat(amount), date: new Date().toISOString() };
      
      if (showModal === 'contribution') {
        await createContribution.mutateAsync(payload);
      } else if (showModal === 'distribution') {
        await createDistribution.mutateAsync(payload);
      } else if (showModal === 'reinvestment') {
        await createReinvestment.mutateAsync(payload);
      }
      
      setShowModal(null);
      setAmount('');
      toast.success({ title: 'Operación registrada exitosamente' });
    } catch (error) {
      toast.error({ title: 'Error al registrar la operación' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/associates')}
            className="p-2 hover:bg-hover-bg rounded-xl text-text-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Portal del Socio</h1>
            <p className="text-sm text-text-secondary">{associateName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowModal('contribution')} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            <Wallet size={16} /> Aportar
          </button>
          <button onClick={() => setShowModal('distribution')} className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors">
            <Download size={16} /> Retirar Ganancias
          </button>
          <button onClick={() => setShowModal('reinvestment')} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <RefreshCw size={16} /> Reinvertir
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Capital Total Aportado</h3>
          <p className="text-2xl font-semibold mt-1">${totalContributions.toLocaleString()}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Ganancias Distribuidas</h3>
          <p className="text-2xl font-semibold mt-1 text-emerald-600">${totalDistributions.toLocaleString()}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Préstamos Activos</h3>
          <p className="text-2xl font-semibold mt-1">{activeLoansCount}</p>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">Préstamos Participados</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">ID Préstamo</th>
                <th className="pb-3 font-medium">Monto Original</th>
                <th className="pb-3 font-medium">Interés Total</th>
                <th className="pb-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {participatedLoans.map((loan: any) => (
                <tr key={loan.id} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4 font-mono">{String(loan.id).substring(0, 8)}</td>
                  <td className="py-4 font-medium">${loan.amount.toLocaleString()}</td>
                  <td className="py-4 text-emerald-600">${loan.totalInterest?.toLocaleString() || '0'}</td>
                  <td className="py-4">
                    <span className="px-2 py-1 bg-status-info-bg text-status-info rounded-full text-xs">
                      {loan.status}
                    </span>
                  </td>
                </tr>
              ))}
              {participatedLoans.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-text-secondary">No participa en ningún préstamo activo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-2xl w-full max-w-md p-6 border border-border-subtle">
            <h3 className="text-xl font-bold mb-4">
              {showModal === 'contribution' ? 'Registrar Aporte de Capital' :
               showModal === 'distribution' ? 'Distribuir Ganancias' :
               'Reinvertir Ganancias'}
            </h3>
            <form onSubmit={handleAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Monto</label>
                <input 
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(null)}
                  className="flex-1 py-2 border border-border-subtle rounded-lg hover:bg-hover-bg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
