import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { BACKEND_URL } from '../src/config';
import useTableStore from '../src/store/tableStore'; // Import the Zustand store

// ROWS_PER_PAGE is now managed within the store (rowsPerPageForTV)

const TableEditorScreen = ({ route }) => {
  const { displayId } = route.params;

  // Get state and actions from Zustand store
  const {
    fullTableData,
    sortConfig,
    currentPageForTV,
    rowsPerPageForTV,
    isModified,
    isLoading,
    setInitialData,
    editCell,
    editHeader,
    sortData,
    setCurrentPageForTV,
    addRow,
    addColumn,
    pushDataToTV,
    getTotalTVPages, // Use selector for total pages
  } = useTableStore();

  // Sample initial data structure - this would typically be fetched or start empty
  // For now, we'll set it in useEffect once.
  // In a real app, you might fetch this data based on displayId or other criteria.
  useEffect(() => {
    const initialSampleData = {
      headers: ["ID", "Name", "Value", "Category"],
      rows: Array.from({ length: 25 }, (_, i) => [
        `${i + 1}`,
        `Item Name ${i + 1}`,
        `${Math.floor(Math.random() * 1000)}`,
        i % 2 === 0 ? 'Alpha' : 'Beta'
      ])
    };
    setInitialData(initialSampleData);
  }, [setInitialData, displayId]); // displayId dependency if initial data depends on it

  const handleSendData = () => {
    pushDataToTV(displayId, BACKEND_URL);
  };

  // Pagination calculations
  const totalRows = fullTableData.rows.length;
  const totalTVPages = getTotalTVPages(); // Use selector

  const handlePreviousPage = () => {
    setCurrentPageForTV(currentPageForTV - 1);
  };

  const handleNextPage = () => {
    setCurrentPageForTV(currentPageForTV + 1);
  };

  const startRowForTVDisplay = (currentPageForTV - 1) * rowsPerPageForTV + 1;
  const endRowForTVDisplay = Math.min(currentPageForTV * rowsPerPageForTV, totalRows);

  // The mobile app always displays and edits the fullTableData
  const mobileDisplayData = fullTableData;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Table Editor (Mobile)</Text>
      <Text style={styles.displayIdText}>Display ID: {displayId}</Text>

      <View style={styles.controlsContainer}>
        <Button title="Add Row" onPress={addRow} />
        <Button title="Add Column" onPress={addColumn} />
      </View>

      <Text style={styles.subTitle}>Full Data (Editing View)</Text>
      {mobileDisplayData && mobileDisplayData.headers && mobileDisplayData.rows ? (
        <View style={styles.table}>
          {/* Headers */}
          <View style={styles.tableRow}>
            {mobileDisplayData.headers.map((header, index) => (
              <TouchableOpacity key={`header-touch-${index}`} style={styles.tableHeaderTouchable} onPress={() => sortData(index)}>
                <TextInput
                  key={`header-input-${index}`}
                  style={[styles.tableHeader, styles.cellInput, styles.headerInput]}
                  value={header}
                  onChangeText={(text) => editHeader(index, text)}
                  placeholder={`H${index + 1}`}
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
                  value={String(cell)} // Ensure value is a string for TextInput
                  onChangeText={(text) => editCell(rowIndex, cellIndex, text)}
                  placeholder="Edit"
                />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <Text>Loading data or no data to display...</Text>
      )}

      <View style={styles.paginationContainer}>
        <Text style={styles.subTitle}>TV Display Pagination</Text>
        <View style={styles.paginationControls}>
            <Button title="Previous" onPress={handlePreviousPage} disabled={currentPageForTV === 1} />
            <Text style={styles.pageInfo}>
                Page {currentPageForTV} of {totalTVPages} (Rows {totalRows > 0 ? startRowForTVDisplay : 0}-{endRowForTVDisplay} of {totalRows})
            </Text>
            <Button title="Next" onPress={handleNextPage} disabled={currentPageForTV === totalTVPages || totalRows === 0} />
        </View>
      </View>

      <Button
        title={isLoading ? 'Sending...' : `Send Page ${currentPageForTV} to TV`}
        onPress={handleSendData}
        disabled={isLoading || !isModified} // isModified is true if data changed or page changed
      />
      <Text style={styles.note}>
        Mobile editor shows all data. Use pagination controls above to select the page sent to the TV.
        Sending to TV will send only the selected page.
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
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
    textAlign: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderWidth: 0.5,
    borderColor: '#ccc',
    paddingVertical: 8, // Adjusted padding
    paddingHorizontal: 4, // Adjusted padding
  },
  tableHeader: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerInput: {
    padding: 0,
    margin: 0,
    flexShrink: 1,
    textAlignVertical: 'center', // Android specific
  },
  sortIndicator: {
    marginLeft: 3, // Reduced space
    fontSize: 12,
  },
  tableCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  cellInput: {
    minHeight: 40,
    paddingHorizontal: 8, // Ensure text is not touching borders
    paddingVertical: 5,   // Ensure text is not touching borders
    textAlignVertical: 'center', // Android specific
  },
  paginationContainer: {
    marginTop: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '90%', // Control width of pagination bar
  },
  pageInfo: {
    fontSize: 14,
    marginHorizontal: 10,
  },
  note: {
    marginTop: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#777',
    paddingBottom: 20, // Ensure space at the bottom of scrollview
  },
});

export default TableEditorScreen;
