import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReportDownloadControl } from '../ReportDownloadModal';

describe('ReportDownloadControl', () => {
  it('keeps format choices behind one download action', async () => {
    const onDownload = vi.fn().mockResolvedValue(true);

    render(
      <ReportDownloadControl
        title="Descargar cierre"
        subtitle="Elige un formato"
        isExporting={false}
        onDownload={onDownload}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Excel (xlsx)' }));

    await waitFor(() => expect(onDownload).toHaveBeenCalledWith('xlsx'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the format dialog open when the export is not completed', async () => {
    const onDownload = vi.fn().mockResolvedValue(false);

    render(
      <ReportDownloadControl
        title="Descargar pagos"
        isExporting={false}
        onDownload={onDownload}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    await waitFor(() => expect(onDownload).toHaveBeenCalledWith('pdf'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
