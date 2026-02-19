import { fireEvent, render, screen } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';

import { DataTable } from '@/components/organisms/DataTable';

interface RowData {
  name: string;
  value: number;
}

const columns: ColumnDef<RowData, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: 'value',
    header: 'Value',
    cell: ({ row }) => row.original.value.toString(),
  },
];

describe('DataTable', () => {
  it('renders columns and data', () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { name: 'Alpha', value: 2 },
          { name: 'Beta', value: 1 },
        ]}
      />
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('toggles sort on header click', () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { name: 'Alpha', value: 2 },
          { name: 'Beta', value: 1 },
        ]}
      />
    );

    const valueHeaderButton = screen.getByRole('button', { name: 'Value' });
    fireEvent.click(valueHeaderButton);
    expect(valueHeaderButton).toHaveTextContent('▼');
    fireEvent.click(valueHeaderButton);
    expect(valueHeaderButton).toHaveTextContent('▲');
  });
});
