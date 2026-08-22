import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Table({ columns, data = [], itemsPerPage: initialItemsPerPage = 10, onRowClick, showPageSizeOptions = true }) {
  const [pageSize, setPageSize] = useState(initialItemsPerPage);
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Auto-correct current page if data shrinks or pageSize changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalItems, totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = data.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handleFirstPage = () => {
    setCurrentPage(1);
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages);
  };

  const handlePageClick = (pageNum) => {
    setCurrentPage(pageNum);
  };

  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      
      if (currentPage <= 3) {
        end = maxPagesToShow;
      }
      if (currentPage >= totalPages - 2) {
        start = totalPages - maxPagesToShow + 1;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {columns.map((column, idx) => (
                <th 
                  key={column.accessor || idx} 
                  className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIdx) => (
                <tr 
                  key={row.id || rowIdx} 
                  onClick={(e) => {
                    if (e.target.closest('button, a, input, select, textarea')) return;
                    if (onRowClick) onRowClick(row);
                  }}
                  className={`hover:bg-blue-50/60 transition-colors duration-100 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((column, colIdx) => (
                    <td 
                      key={`${row.id || rowIdx}-${column.accessor || colIdx}`} 
                      className="px-4 py-3.5 text-slate-700 text-xs font-medium"
                    >
                      {column.cell ? column.cell(row) : row[column.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400 font-medium">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Enhanced Interactive Pagination Bar */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-2 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <div>
              Showing <span className="font-bold text-slate-900">{totalItems === 0 ? 0 : startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-900">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-900">{totalItems}</span> results
            </div>

            {showPageSizeOptions && (
              <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-200">
                <span className="text-slate-500 font-medium">Show:</span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              onClick={handleFirstPage}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4 text-slate-600" />
            </button>

            {/* Previous Page */}
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>

            {/* Page Number Buttons */}
            {pageNumbers[0] > 1 && (
              <>
                <button
                  onClick={() => handlePageClick(1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition shadow-2xs"
                >
                  1
                </button>
                {pageNumbers[0] > 2 && (
                  <span className="px-1 text-slate-400 font-bold">...</span>
                )}
              </>
            )}

            {pageNumbers.map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => handlePageClick(pageNum)}
                className={`min-w-[32px] px-2.5 py-1.5 rounded-lg border text-xs font-bold transition shadow-2xs ${
                  currentPage === pageNum
                    ? 'bg-[#00338D] border-[#00338D] text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pageNum}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-slate-400 font-bold">...</span>
                )}
                <button
                  onClick={() => handlePageClick(totalPages)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition shadow-2xs"
                >
                  {totalPages}
                </button>
              </>
            )}

            {/* Next Page */}
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>

            {/* Last Page */}
            <button
              onClick={handleLastPage}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
