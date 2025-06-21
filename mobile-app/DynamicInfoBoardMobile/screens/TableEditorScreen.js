import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';

// Use 10.0.2.2 for localhost when running in Android emulator connecting to a server on the host machine.
// For iOS simulator, it would be http://localhost:3000
// Users should change this IP based on their development setup.
import { TouchableOpacity } from 'react-native-gesture-handler'; // Added for tappable headers
const BACKEND_URL = 'http://10.0.2.2:3000';
const ROWS_PER_PAGE = 10; // Define rows per page for TV display

const TableEditorScreen = ({ route }) => {
  const { displayId } = route.params;
  // tableData now stores the SLICE for TV, fullTableData stores the complete data for mobile editing
  const [fullTableData, setFullTableData] = useState({ headers: [], rows: [] });
  const [tableData, setTableData] = useState({ headers: [], rows: [] }); // This will be the slice for the TV
  const [isLoading, setIsLoading] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [currentPage, setCurrentPage] = useState(1);

  // Sample initial data structure - this would typically be fetched or start empty
  // Let's make it larger to test pagination
  const initialTableData = {
    headers: ["ID", "Name", "Value"],
    rows: Array.from({ length: 25 }, (_, i) => [`${i + 1}`, `Item ${i + 1}`, `Value ${Math.floor(Math.random() * 1000)}`])
  };

  const sliceTableData = useCallback((page, data, rowsPerPage) => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const slicedRows = data.rows.slice(start, end);
    return { headers: data.headers, rows: slicedRows };
  }, []);

  useEffect(() => {
    setFullTableData(initialTableData);
    // Alert.alert("Table Editor", `Editing for Display ID: ${displayId}`);
  }, [displayId]);

  // Update the displayed slice (tableData) whenever fullTableData or currentPage changes
  useEffect(() => {
    if (fullTableData.headers.length > 0 || fullTableData.rows.length > 0) {
      const newSlice = sliceTableData(currentPage, fullTableData, ROWS_PER_PAGE);
      setTableData(newSlice);
      setIsModified(true); // Mark as modified when page changes, so "Send to TV" is enabled
    }
  }, [fullTableData, currentPage, sliceTableData]);


  const handleSendDataToTV = async () => {
    // isModified check is still relevant if user wants to send specific page without other data changes
    setIsLoading(true);
    try {
      // We send the `tableData` which is already the current page's slice
      console.log(`Attempting to send data to TV (Page ${currentPage}): ${BACKEND_URL}/display/${displayId}`, tableData);
      const response = await fetch(`${BACKEND_URL}/display/${displayId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tableData: tableData }),
      });

      const responseData = await response.json();

      if (response.ok) {
        Alert.alert('Data Sent', responseData.message || `Page ${currentPage} data sent to TV successfully.`);
        setIsModified(false); // Reset modification status after successful send
      } else {
        Alert.alert('Send Failed', responseData.message || 'Could not send data to the TV. Check server response.');
      }
    } catch (error) {
      console.error("Send data error:", error);
      Alert.alert('Send Error', error.message || 'An error occurred while sending data. Check your network connection and backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCellChange = (rowIndex, cellIndex, text) => {
    // IMPORTANT: All modifications should happen to fullTableData
    const newFullRows = [...fullTableData.rows];
    newFullRows[rowIndex][cellIndex] = text;
    setFullTableData({ ...fullTableData, rows: newFullRows });
    setIsModified(true);
  };

  const handleSortColumn = (columnIndex) => {
    let direction = 'ascending';
    if (sortConfig.key === columnIndex && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key: columnIndex, direction });

    // Sort fullTableData
    setFullTableData(prevData => {
      const sortedRows = [...prevData.rows].sort((a, b) => {
        const valA = a[columnIndex] || "";
        const valB = b[columnIndex] || "";
        if (valA < valB) {
          return direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
      return { ...prevData, rows: sortedRows };
    });
    setIsModified(true);
  };

  const handleHeaderChange = (headerIndex, text) => {
    // IMPORTANT: All modifications should happen to fullTableData
    const newHeaders = [...fullTableData.headers];
    newHeaders[headerIndex] = text;
    setFullTableData({ ...fullTableData, headers: newHeaders });
    setIsModified(true);
  };

  const handleAddRow = () => {
    // Add to fullTableData
    setFullTableData(prevData => {
      const numCells = prevData.headers.length > 0 ? prevData.headers.length : (prevData.rows[0]?.length || 1);
      const newRow = Array(numCells).fill("");
      return {
        ...prevData,
        rows: [...prevData.rows, newRow]
      };
    });
    setIsModified(true);
  };

  const handleAddColumn = () => {
    // Add to fullTableData
    setFullTableData(prevData => {
      const newHeaderName = `Col ${prevData.headers.length + 1}`;
      const newHeaders = [...prevData.headers, newHeaderName];

      let newRows;
      if (prevData.rows.length === 0) {
         newRows = [Array(newHeaders.length).fill("")];
      } else {
        newRows = prevData.rows.map(row => [...row, ""]);
      }

      return {
        headers: newHeaders,
        rows: newRows
      };
    });
    setIsModified(true);
  };

  const totalRows = fullTableData.rows.length;
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  // For mobile display, we still show all rows from fullTableData
  const mobileDisplayData = fullTableData;

  const startRowForDisplay = (currentPage - 1) * ROWS_PER_PAGE + 1;
  const endRowForDisplay = Math.min(currentPage * ROWS_PER_PAGE, totalRows);


  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Table Editor (Mobile)</Text>
      <Text style={styles.displayIdText}>Display ID: {displayId}</Text>

      <View style={styles.controlsContainer}>
        <Button title="Add Row" onPress={handleAddRow} />
        <Button title="Add Column" onPress={handleAddColumn} />
      </View>

      {/* Mobile app still views/edits the full table */}
      <Text style={styles.subTitle}>Full Data (Editing View)</Text>
      <View style={styles.table}>
        {/* Headers */}
        <View style={styles.tableRow}>
          {mobileDisplayData.headers.map((header, index) => (
            <TouchableOpacity key={`header-touch-${index}`} style={styles.tableHeaderTouchable} onPress={() => handleSortColumn(index)}>
              <TextInput
                key={`header-input-${index}`}
                style={[styles.tableHeader, styles.cellInput, styles.headerInput]}
                value={header}
                onChangeText={(text) => handleHeaderChange(index, text)}
                // pointerEvents="none" // Keep editable for headers
              />
              <Text style={styles.sortIndicator}>
                {sortConfig.key === index ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Rows - Mobile app still shows all rows for editing */}
        {mobileDisplayData.rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.tableRow}>
            {row.map((cell, cellIndex) => (
              <TextInput
                key={`cell-${rowIndex}-${cellIndex}`}
                style={[styles.tableCell, styles.cellInput]}
                value={cell}
                onChangeText={(text) => handleCellChange(rowIndex, cellIndex, text)}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={styles.paginationContainer}>
        <Text style={styles.subTitle}>TV Display Pagination</Text>
        <View style={styles.paginationControls}>
            <Button title="Previous" onPress={handlePreviousPage} disabled={currentPage === 1} />
            <Text style={styles.pageInfo}>
                Page {currentPage} of {totalPages} (Rows {totalRows > 0 ? startRowForDisplay : 0}-{endRowForDisplay} of {totalRows})
            </Text>
            <Button title="Next" onPress={handleNextPage} disabled={currentPage === totalPages || totalRows === 0} />
        </View>
      </View>


      <Button
        title={isLoading ? 'Sending...' : `Send Page ${currentPage} to TV`}
        onPress={handleSendDataToTV}
        disabled={isLoading || !isModified}
      />
      <Text style={styles.note}>
        Mobile editor shows all data. Use pagination controls above to select the page sent to the TV.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#fff',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  displayIdText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
    marginBottom: 15,
  },
  table: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeaderTouchable: {
    flex: 1,
    flexDirection: 'row', // To align TextInput and sort indicator
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderWidth: 0.5,
    borderColor: '#ccc',
    padding: 8,
  },
  tableHeader: {
    fontWeight: 'bold',
    textAlign: 'center',
    // flex: 1, // Removed to allow sort indicator to share space
    // borderWidth: 0, // Handled by TouchableOpacity
    // backgroundColor: 'transparent', // Handled by TouchableOpacity
  },
  headerInput: { // Specific style for header TextInput if needed, inherits cellInput
    padding: 0, // Remove default padding if it misaligns text
    margin: 0, // Remove default margin
    flexShrink: 1, // Allow text input to shrink to fit text
  },
  sortIndicator: {
    marginLeft: 5, // Space between text and indicator
    fontSize: 12,
  },
  tableCell: {
    flex: 1,
    padding: 8,
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  cellInput: { // Style for TextInput used as cell/header
    minHeight: 40, // Ensure TextInput is tappable
  },
  note: {
    marginTop: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#777',
  },
});

export default TableEditorScreen;
