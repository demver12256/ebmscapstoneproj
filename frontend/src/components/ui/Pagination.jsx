import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({ 
  currentPage = 1, 
  totalPages = 1, 
  onPageChange, 
  totalItems = 0,
  itemsPerPage = 10,
  onItemsPerPageChange,
  pageSizeOptions = [5, 10, 20, 50],
  startIndex = 0,
  endIndex = 0,
  alwaysShow = false,
}) {
  const safeTotalPages = Math.max(1, totalPages || 1);

  const handlePreviousPage = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < safeTotalPages) onPageChange(currentPage + 1);
  };

  const handleFirstPage = () => {
    onPageChange(1);
  };

  const handleLastPage = () => {
    onPageChange(safeTotalPages);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (safeTotalPages <= maxPagesToShow) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(safeTotalPages, currentPage + 2);
      
      if (currentPage <= 3) {
        end = maxPagesToShow;
      }
      if (currentPage >= safeTotalPages - 2) {
        start = safeTotalPages - maxPagesToShow + 1;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  // If alwaysShow is false, preserve original behavior of hiding when <= 1 page
  if (!alwaysShow && totalPages <= 1) return null;

  const startDisplay = totalItems === 0 ? 0 : startIndex + 1;
  const endDisplay = Math.min(endIndex, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs sm:text-sm">
          Ipinapakita ang <span className="font-bold text-slate-900">{startDisplay}</span> hanggang{' '}
          <span className="font-bold text-slate-900">{endDisplay}</span> ng{' '}
          <span className="font-bold text-slate-900">{totalItems}</span> anunsyo
        </div>

        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Bawat pahina:</span>
            <select
              value={itemsPerPage || 10}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          onClick={handleFirstPage}
          disabled={currentPage <= 1}
          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Unang pahina"
        >
          <ChevronsLeft className="w-4 h-4 text-slate-600" />
        </button>

        {/* Previous Page */}
        <button
          onClick={handlePreviousPage}
          disabled={currentPage <= 1}
          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Nakaraang pahina"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>

        {/* Page Numbers */}
        {pageNumbers[0] > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors"
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
            onClick={() => onPageChange(pageNum)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${
              currentPage === pageNum
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {pageNum}
          </button>
        ))}

        {pageNumbers[pageNumbers.length - 1] < safeTotalPages && (
          <>
            {pageNumbers[pageNumbers.length - 1] < safeTotalPages - 1 && (
              <span className="px-1 text-slate-400 font-bold">...</span>
            )}
            <button
              onClick={() => onPageChange(safeTotalPages)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors"
            >
              {safeTotalPages}
            </button>
          </>
        )}

        {/* Next Page */}
        <button
          onClick={handleNextPage}
          disabled={currentPage >= safeTotalPages}
          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Susunod na pahina"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>

        {/* Last Page */}
        <button
          onClick={handleLastPage}
          disabled={currentPage >= safeTotalPages}
          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Huling pahina"
        >
          <ChevronsRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>
    </div>
  );
}
