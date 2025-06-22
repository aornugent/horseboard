import { create } from 'zustand';
// import { Alert } from 'react-native'; // No longer needed directly for pushDataToTV
import Toast from 'react-native-toast-message';

const ROWS_PER_PAGE = 10; // Define rows per page for TV display, matches TableEditorScreen

const useTableStore = create((set, get) => ({
  // State
  fullTableData: { headers: [], rows: [] }, // Holds the complete dataset
  sortConfig: { key: null, direction: 'ascending' }, // { key: columnIndex, direction: 'ascending' | 'descending' }
  currentPageForTV: 1, // Current page number for the TV display slice
  rowsPerPageForTV: ROWS_PER_PAGE,
  isModified: false, // Tracks if data has changed since last successful send to TV
  isLoading: false, // For async operations like sending data to TV

  // Actions
  setInitialData: (data) => {
    // Expects data in { headers: [], rows: [] } format
    // Example: const initialTableData = {
    //   headers: ["ID", "Name", "Value"],
    //   rows: Array.from({ length: 25 }, (_, i) => [`${i + 1}`, `Item ${i + 1}`, `Value ${Math.floor(Math.random() * 1000)}`])
    // };
    set({ fullTableData: data, isModified: false, currentPageForTV: 1 });
  },

  editCell: (rowIndex, cellIndex, value) => {
    set((state) => {
      const newRows = [...state.fullTableData.rows];
      // Ensure row and cell exist (defensive)
      if (newRows[rowIndex] && typeof newRows[rowIndex][cellIndex] !== 'undefined') {
        newRows[rowIndex][cellIndex] = value;
        return { fullTableData: { ...state.fullTableData, rows: newRows }, isModified: true };
      }
      return {}; // No change if indices are out of bounds
    });
  },

  editHeader: (headerIndex, value) => {
    set((state) => {
      const newHeaders = [...state.fullTableData.headers];
      if (typeof newHeaders[headerIndex] !== 'undefined') {
        newHeaders[headerIndex] = value;
        return { fullTableData: { ...state.fullTableData, headers: newHeaders }, isModified: true };
      }
      return {};
    });
  },

  sortData: (columnIndex) => {
    set((state) => {
      let direction = 'ascending';
      if (state.sortConfig.key === columnIndex && state.sortConfig.direction === 'ascending') {
        direction = 'descending';
      }

      const sortedRows = [...state.fullTableData.rows].sort((a, b) => {
        const valA = a[columnIndex] || ""; // Handle undefined or null gracefully
        const valB = b[columnIndex] || "";

        // Attempt numeric sort if both are numbers, otherwise string sort
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);

        let comparison = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
            comparison = numA < numB ? -1 : (numA > numB ? 1 : 0);
        } else {
            comparison = String(valA).localeCompare(String(valB), undefined, {numeric: true, sensitivity: 'base'});
        }

        return direction === 'ascending' ? comparison : -comparison;
      });

      return {
        fullTableData: { ...state.fullTableData, rows: sortedRows },
        sortConfig: { key: columnIndex, direction },
        isModified: true,
      };
    });
  },

  setCurrentPageForTV: (page) => {
    set((state) => {
      const totalRows = state.fullTableData.rows.length;
      const totalPages = Math.ceil(totalRows / state.rowsPerPageForTV) || 1;
      const newPage = Math.max(1, Math.min(page, totalPages));
      return { currentPageForTV: newPage, isModified: true }; // Changing page implies user might want to send this new view
    });
  },

  addRow: () => {
    set((state) => {
      const numCells = state.fullTableData.headers.length > 0 ? state.fullTableData.headers.length : (state.fullTableData.rows[0]?.length || 1);
      const newRow = Array(numCells).fill("");
      return {
        fullTableData: { ...state.fullTableData, rows: [...state.fullTableData.rows, newRow] },
        isModified: true,
      };
    });
  },

  addColumn: () => {
    set((state) => {
      const newHeaderName = `Col ${state.fullTableData.headers.length + 1}`;
      const newHeaders = [...state.fullTableData.headers, newHeaderName];

      let newRows;
      if (state.fullTableData.rows.length === 0) {
         // If there are no rows, and we add a column, we should add a row with one cell for the new column
         // Or, if headers define columns, add a row with cells for all headers
         newRows = [Array(newHeaders.length).fill("")];
      } else {
        newRows = state.fullTableData.rows.map(row => [...row, ""]);
      }

      return {
        fullTableData: { headers: newHeaders, rows: newRows },
        isModified: true,
      };
    });
  },

  // Async action to push data to TV
  pushDataToTV: async (displayId, backendUrl) => {
    const { fullTableData, currentPageForTV, rowsPerPageForTV } = get();
    set({ isLoading: true });

    const start = (currentPageForTV - 1) * rowsPerPageForTV;
    const end = start + rowsPerPageForTV;
    const tvSliceData = {
      headers: fullTableData.headers,
      rows: fullTableData.rows.slice(start, end),
    };

    try {
      console.log(`Attempting to send data to TV (Page ${currentPageForTV}): ${backendUrl}/display/${displayId}`, tvSliceData);
      const response = await fetch(`${backendUrl}/display/${displayId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tableData: tvSliceData }), // Backend expects { tableData: ... }
      });

      const responseData = await response.json();

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Data Sent',
          text2: responseData.message || `Page ${currentPageForTV} data sent to TV successfully.`,
        });
        set({ isModified: false }); // Reset modification status after successful send
      } else {
        Toast.show({
          type: 'error',
          text1: 'Send Failed',
          text2: responseData.message || 'Could not send data to the TV. Check server response.',
        });
      }
    } catch (error) {
      console.error("Send data error:", error);
      Toast.show({
        type: 'error',
        text1: 'Send Error',
        text2: error.message || 'An error occurred while sending data. Check network and server.',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // Selector to get current page slice for TV (can be used if needed outside pushDataToTV)
  getCurrentTVSlice: () => {
    const { fullTableData, currentPageForTV, rowsPerPageForTV } = get();
    const start = (currentPageForTV - 1) * rowsPerPageForTV;
    const end = start + rowsPerPageForTV;
    return {
      headers: fullTableData.headers,
      rows: fullTableData.rows.slice(start, end),
    };
  },

  // Selector to get total pages for TV
  getTotalTVPages: () => {
    const { fullTableData, rowsPerPageForTV } = get();
    return Math.ceil(fullTableData.rows.length / rowsPerPageForTV) || 1;
  }
}));

export default useTableStore;
