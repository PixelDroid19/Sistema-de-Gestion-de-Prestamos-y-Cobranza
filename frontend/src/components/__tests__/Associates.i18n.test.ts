import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const associatesSource = readFileSync(path.join(process.cwd(), 'src/components/Associates.tsx'), 'utf8');

describe('Associates i18n contracts', () => {
  it('keeps visible list labels and states in i18n dictionaries', () => {
    [
      'Resumen operativo de socios inversionistas',
      'Capital aportado',
      'Aportes registrados',
      'Interés estimado',
      'Compromiso mensual aprox.',
      'Socios activos',
      'Habilitados / visibles',
      'Participación',
      'Distribución completa',
      'Porcentaje configurado',
      'Buscar socio',
      'Buscar por nombre, correo o teléfono…',
      'Filtra socios activos o inactivos dentro de la operación.',
      'Todos los estados',
      'Cargando socios…',
      'Error al cargar socios.',
      'No hay socios registrados.',
      'Nombre del socio',
      'Estado del socio dentro de la plataforma.',
      'Porcentaje pactado para distribuir rentabilidad',
      'Interés pactado',
      'Tasa mensual o anual que se reconoce',
      'Acciones',
      'No tiene permiso para exportar información de socios.',
    ].forEach((text) => {
      expect(associatesSource).not.toContain(text);
    });
    expect(associatesSource).not.toContain('substring(0, 8)');
  });
});
