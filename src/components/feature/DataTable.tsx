import { ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, Download } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

interface Column<T> {
  header: string;
  accessorKey: keyof T | string;
  cell?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  title?: string;
}

export function DataTable<T>({ data, columns, searchPlaceholder = "Search...", title }: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {title && <h3 className="text-lg font-medium mr-4">{title}</h3>}
          <Button variant="outline" size="icon">
            <SlidersHorizontal size={16} />
          </Button>
          <Button variant="outline" size="icon">
            <Download size={16} />
          </Button>
        </div>
      </div>

      {/* Table Content */}
      <div className="rounded-md border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input type="checkbox" className="rounded border-input" />
                </th>
                {columns.map((col, i) => (
                  <th key={i} className="px-4 py-3 font-medium tracking-wider">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="h-32 text-center text-muted-foreground">
                    No results found.
                  </td>
                </tr>
              ) : (
                data.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-input" />
                    </td>
                    {columns.map((col, colIndex) => (
                      <td key={colIndex} className="px-4 py-3 text-foreground">
                        {col.cell ? col.cell(row) : String((row as any)[col.accessorKey] || "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Mock */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing 1 to {Math.min(10, data.length)} of {data.length} entries
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft size={16} />
            <span className="sr-only">Previous</span>
          </Button>
          <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
            1
          </Button>
          <Button variant="outline" size="sm">
            2
          </Button>
          <Button variant="outline" size="sm">
            3
          </Button>
          <Button variant="outline" size="sm">
            <ChevronRight size={16} />
            <span className="sr-only">Next</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
