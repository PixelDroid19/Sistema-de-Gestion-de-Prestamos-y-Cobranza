import React, { useState } from 'react';
import { ArrowLeft, Save, User, Phone, MapPin, Mail, CreditCard, Briefcase, Loader2 } from 'lucide-react';
import { useCustomers } from '../services/customerService';

export default function NewCustomer({ onBack }: { onBack: () => void }) {
  const { createCustomer } = useCustomers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    documentId: '',
    status: 'active',
    phone: '',
    email: '',
    address: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createCustomer.mutateAsync(formData);
      onBack();
    } catch (error) {
      console.error('Error creating customer:', error);
      // Handle error (e.g., show toast)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-bg-surface border border-border-subtle rounded-lg hover:bg-hover-bg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold">Nuevo Cliente</h2>
            <p className="text-sm text-text-secondary mt-1">Registrar un nuevo perfil de prestatario en el sistema.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg text-sm font-medium border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors">
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar Cliente
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col gap-6">
          {/* Section 1: Personal Info */}
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <h3 className="text-lg font-medium mb-6 flex items-center gap-2 border-b border-border-subtle pb-4">
              <User size={20} className="text-blue-500"/> Información Personal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Nombres</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Ej. Juan" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Apellidos</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Ej. Pérez" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">DNI / Identificación</label>
                <div className="relative">
                  <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="text" name="documentId" value={formData.documentId} onChange={handleChange} required className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Ej. 12345678" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Estado</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer">
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="pending">Pendiente</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Address */}
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <h3 className="text-lg font-medium mb-6 flex items-center gap-2 border-b border-border-subtle pb-4">
              <MapPin size={20} className="text-emerald-500"/> Contacto y Dirección
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Teléfono</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="+1 234 567 890" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Correo Electrónico</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="correo@ejemplo.com" />
                </div>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-sm font-medium text-text-secondary">Dirección Completa</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-text-secondary" />
                  <textarea name="address" value={formData.address} onChange={handleChange} rows={3} className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none" placeholder="Calle Principal 123, Ciudad, Provincia, Código Postal"></textarea>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
