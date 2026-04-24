import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, Calculator, User, DollarSign, Calendar, Percent, FileText, Loader2 } from 'lucide-react';
import { useLoans } from '../services/loanService';
import { useCustomers } from '../services/customerService';
import { useAssociates } from '../services/associateService';
import { toast } from '../lib/toast';
import { extractValidationErrors } from '../services/apiErrors';
import { useConfig } from '../services/configService';

export default function NewCredit({ onBack }: { onBack: () => void }) {
  const { createLoan, simulateLoan } = useLoans();
  const { data: customersData } = useCustomers({ pageSize: 100 });
  const { data: associatesData } = useAssociates({ pageSize: 100 });
  const { ratePolicies, lateFeePolicies } = useConfig();
  const formId = 'new-credit-form';
  
  const customers = Array.isArray(customersData?.data?.customers)
    ? customersData.data.customers
    : Array.isArray(customersData?.data)
      ? customersData.data
      : [];
  const associates = Array.isArray(associatesData?.data?.associates)
    ? associatesData.data.associates
    : Array.isArray(associatesData?.data)
      ? associatesData.data
      : [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    customerId: '',
    associateId: '',
    amount: '',
    interestRate: '',
    termMonths: '',
    lateFeeMode: 'SIMPLE',
    annualLateFeeRate: '',
  });

  const [simulation, setSimulation] = useState<any>(null);
  const resolvedRatePolicy = useMemo<any>(() => {
    const amount = Number(formData.amount || 0);
    return ratePolicies
      .filter((policy: any) => policy.isActive)
      .filter((policy: any) => {
        if (!amount) return true;
        if (policy.minAmount != null && amount < Number(policy.minAmount)) return false;
        if (policy.maxAmount != null && amount > Number(policy.maxAmount)) return false;
        return true;
      })
      .sort((left: any, right: any) => Number(left.priority || 100) - Number(right.priority || 100))[0] || null;
  }, [formData.amount, ratePolicies]);
  const resolvedLateFeePolicy = useMemo<any>(() => (
    lateFeePolicies
      .filter((policy: any) => policy.isActive)
      .sort((left: any, right: any) => Number(left.priority || 100) - Number(right.priority || 100))[0] || null
  ), [lateFeePolicies]);

  useEffect(() => {
    setFormData((current) => {
      const next = { ...current };
      if (!current.interestRate && resolvedRatePolicy?.annualEffectiveRate != null) {
        next.interestRate = String(resolvedRatePolicy.annualEffectiveRate);
      }
      if (!current.annualLateFeeRate && resolvedLateFeePolicy?.annualEffectiveRate != null) {
        next.annualLateFeeRate = String(resolvedLateFeePolicy.annualEffectiveRate);
      }
      if (resolvedLateFeePolicy?.lateFeeMode && current.lateFeeMode === 'SIMPLE') {
        next.lateFeeMode = String(resolvedLateFeePolicy.lateFeeMode);
      }
      return next;
    });
  }, [resolvedLateFeePolicy, resolvedRatePolicy]);

  const getDisplayName = (entity: any) => {
    if (entity?.name) return entity.name;

    const composedName = [entity?.firstName, entity?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return composedName || entity?.email || `#${entity?.id}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field error when user modifies the field
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const calculateSimulation = async () => {
    const amount = parseFloat(formData.amount) || 0;
    const rate = parseFloat(formData.interestRate) || 0;
    const months = parseInt(formData.termMonths) || 0;

    if (amount <= 0 || rate <= 0 || months <= 0) {
      setSimulation(null);
      return;
    }

    setIsSimulating(true);
    try {
      const result = await simulateLoan.mutateAsync({
        amount,
        interestRate: rate,
        termMonths: months,
        lateFeeMode: formData.lateFeeMode,
        annualLateFeeRate: parseFloat(formData.annualLateFeeRate || '0'),
      });
      setSimulation(result?.data?.calculation ?? result?.data?.simulation ?? null);
    } catch (error: any) {
      console.error('Error in simulation', error);
      toast.apiErrorSafe(error, { domain: 'credits', action: 'credit.simulate' });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createLoan.mutateAsync({
        customerId: parseInt(formData.customerId),
        associateId: formData.associateId ? parseInt(formData.associateId) : undefined,
        amount: parseFloat(formData.amount),
        interestRate: parseFloat(formData.interestRate),
        termMonths: parseInt(formData.termMonths),
        lateFeeMode: formData.lateFeeMode,
        annualLateFeeRate: parseFloat(formData.annualLateFeeRate || '0'),
      });
      toast.success({ description: 'Crédito registrado correctamente.' });
      onBack();
    } catch (error: any) {
      console.error('Error creating loan:', error);

      const validationErrors = extractValidationErrors(error);
      if (validationErrors.length > 0) {
        const fieldErrs: Record<string, string> = {};
        validationErrors.forEach((err: any) => {
          fieldErrs[err.field] = err.message;
        });
        setFieldErrors(fieldErrs);
        toast.validationErrors(validationErrors);
      } else {
        toast.apiErrorSafe(error, { domain: 'credits', action: 'credit.create' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-bg-surface border border-border-subtle rounded-lg hover:bg-hover-bg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold">Nuevo Crédito</h2>
            <p className="text-sm text-text-secondary mt-1">Configurar y validar un nuevo crédito con la fórmula activa.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg text-sm font-medium border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors">
            Cancelar
          </button>
          <button 
            type="submit"
            form={formId}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Registrar Crédito
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Form */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Section 1: Client */}
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
                <h3 className="text-lg font-medium mb-6 flex items-center gap-2 border-b border-border-subtle pb-4">
                  <User size={20} className="text-blue-500"/> Prestatario
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-secondary">Seleccionar Cliente</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <select name="customerId" value={formData.customerId} onChange={handleChange} required className={`w-full bg-bg-base border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:ring-1 transition-all appearance-none cursor-pointer ${fieldErrors.customerId ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-border-subtle focus:border-blue-500 focus:ring-blue-500'}`}>
                        <option value="">Buscar cliente por nombre o ID...</option>
                        {customers.map((c: any) => (
                          <option key={c.id} value={c.id}>{getDisplayName(c)} (CUS-{String(c.id).substring(0, 8)})</option>
                        ))}
                      </select>
                    </div>
                    {fieldErrors.customerId && (
                      <span className="text-xs text-red-500">{fieldErrors.customerId}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-secondary">Socio Asignado (Opcional)</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <select name="associateId" value={formData.associateId} onChange={handleChange} className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer">
                        <option value="">Seleccionar socio...</option>
                        {associates.map((a: any) => (
                          <option key={a.id} value={a.id}>{getDisplayName(a)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Loan Details */}
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
                <h3 className="text-lg font-medium mb-6 flex items-center gap-2 border-b border-border-subtle pb-4">
                  <FileText size={20} className="text-emerald-500"/> Detalles del Préstamo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-secondary">Monto del Préstamo</label>
                    <div className="relative">
                      <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <input type="number" name="amount" value={formData.amount} onChange={handleChange} onBlur={calculateSimulation} required className={`w-full bg-bg-base border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:ring-1 transition-all ${fieldErrors.amount ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-border-subtle focus:border-blue-500 focus:ring-blue-500'}`} placeholder="0.00" />
                    </div>
                    {fieldErrors.amount && (
                      <span className="text-xs text-red-500">{fieldErrors.amount}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-secondary">Tasa de Interés Anual (%)</label>
                    <div className="relative">
                      <Percent size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <input type="number" name="interestRate" value={formData.interestRate} onChange={handleChange} onBlur={calculateSimulation} required className={`w-full bg-bg-base border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:ring-1 transition-all ${fieldErrors.interestRate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-border-subtle focus:border-blue-500 focus:ring-blue-500'}`} placeholder="15" />
                    </div>
                    {fieldErrors.interestRate && (
                      <span className="text-xs text-red-500">{fieldErrors.interestRate}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-secondary">Plazo (Meses)</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <input type="number" name="termMonths" value={formData.termMonths} onChange={handleChange} onBlur={calculateSimulation} required className={`w-full bg-bg-base border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:ring-1 transition-all ${fieldErrors.termMonths ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-border-subtle focus:border-blue-500 focus:ring-blue-500'}`} placeholder="12" />
                    </div>
                    {fieldErrors.termMonths && (
                      <span className="text-xs text-red-500">{fieldErrors.termMonths}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-secondary">Modo de Mora</label>
                    <div className="relative">
                      <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <select name="lateFeeMode" value={formData.lateFeeMode} onChange={handleChange} className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer">
                        <option value="SIMPLE">Interés simple</option>
                        <option value="COMPOUND">Interés compuesto</option>
                        <option value="FLAT">Cargo fijo</option>
                        <option value="TIERED">Escalonado</option>
                      </select>
                    </div>
                    <p className="text-xs text-text-secondary">
                      La originación usa el cronograma mensual definido por la fórmula activa del workbench.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text-secondary">Tasa de Mora Anual (%)</label>
                    <div className="relative">
                      <Percent size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <input
                        type="number"
                        name="annualLateFeeRate"
                        value={formData.annualLateFeeRate}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        placeholder="0"
                      />
                    </div>
                    {resolvedLateFeePolicy && (
                      <p className="text-xs text-text-secondary">Sugerida por política: {resolvedLateFeePolicy.label}</p>
                    )}
                  </div>
                </div>
                {resolvedRatePolicy && (
                  <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Política aplicada: {resolvedRatePolicy.label} · {resolvedRatePolicy.annualEffectiveRate}% EA
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Right Column - Credit calculation preview */}
          <div className="lg:col-span-1">
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 sticky top-6">
              <h3 className="text-lg font-medium mb-6 flex items-center gap-2 border-b border-border-subtle pb-4">
                <Calculator size={20} className="text-blue-500" /> Cálculo del crédito
              </h3>
              
              <button 
                type="button" 
                onClick={calculateSimulation}
                disabled={isSimulating}
                className="w-full mb-6 bg-brand-primary/10 text-brand-primary px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-primary/20 transition-colors flex justify-center items-center gap-2"
              >
                {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                Calcular crédito
              </button>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-border-subtle">
                  <span className="text-sm text-text-secondary">Capital</span>
                  <span className="font-medium text-text-primary">{formatCurrency(simulation?.summary?.totalPrincipal || Number(formData.amount) || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border-subtle">
                  <span className="text-sm text-text-secondary">Interés Total</span>
                  <span className="font-medium text-text-primary">{formatCurrency(simulation?.summary?.totalInterest || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border-subtle">
                  <span className="text-sm text-text-secondary">Tasa Anual</span>
                  <span className="font-medium text-text-primary">{formData.interestRate || 0}%</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border-subtle">
                  <span className="text-sm text-text-secondary">Número de Cuotas</span>
                  <span className="font-medium text-text-primary">{simulation?.schedule?.length || Number(formData.termMonths) || 0}</span>
                </div>
                <div className="flex justify-between items-center py-4 bg-brand-primary/5 -mx-6 px-6 mt-6 mb-2 border-y border-brand-primary/10">
                  <span className="font-medium text-brand-primary">Cuota calculada</span>
                  <span className="text-xl font-bold text-brand-primary">{formatCurrency(simulation?.summary?.installmentAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-medium text-text-primary">Total a Pagar</span>
                  <span className="text-lg font-bold text-text-primary">{formatCurrency(simulation?.summary?.totalPayable || 0)}</span>
                </div>
              </div>

              {simulation?.schedule && (
                <div className="mt-6 pt-4 border-t border-border-subtle">
                  <p className="text-sm text-text-secondary text-center">Cálculo validado con la fórmula activa.</p>
                  {simulation.graphVersionId != null && (
                    <p className="text-xs text-text-secondary text-center mt-1">
                      Fórmula v{simulation.graphVersionId}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
