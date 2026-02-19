import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';

import { EmptyState } from '@/components/StateIndicators';
import { cn } from '@/lib/utils';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDetail?: string;
  onRowClick?: (row: TData) => void;
  stickyHeader?: boolean;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data',
  emptyDetail,
  onRowClick,
  stickyHeader = false,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!isLoading && data.length === 0) {
    return <EmptyState message={emptyMessage} detail={emptyDetail} />;
  }

  const columnCount = Math.max(columns.length, 1);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-900">
      <table className="w-full text-left">
        <thead
          className={cn(
            'border-b border-zinc-700 bg-zinc-800/50 text-xs font-medium tracking-wider text-zinc-500 uppercase',
            stickyHeader && 'sticky top-0 z-10'
          )}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sort = header.column.getIsSorted();
                return (
                  <th key={header.id} className="px-3 py-2">
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex cursor-pointer items-center gap-1"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sort === 'asc' && <span>▲</span>}
                        {sort === 'desc' && <span>▼</span>}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, rowIdx) => (
                <tr
                  key={`skeleton-${rowIdx}`}
                  className="border-b border-zinc-700/50 last:border-0"
                >
                  {Array.from({ length: columnCount }).map((__, colIdx) => (
                    <td key={`skeleton-${rowIdx}-${colIdx}`} className="px-3 py-2">
                      <div className="h-4 animate-pulse rounded bg-zinc-800" />
                    </td>
                  ))}
                </tr>
              ))
            : table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-b border-zinc-700/50 transition-colors last:border-0 hover:bg-zinc-800/50',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 text-sm text-zinc-100">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
