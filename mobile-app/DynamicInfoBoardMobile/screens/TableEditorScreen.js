import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';

// Use 10.0.2.2 for localhost when running in Android emulator connecting to a server on the host machine.
// For iOS simulator, it would be http://localhost:3000
// Users should change this IP based on their development setup.
const BACKEND_URL = 'http://10.0.2.2:3000';

const TableEditorScreen = ({ route }) => {
  const { displayId } = route.params;
  const [tableData, setTableData] = useState({ headers: [], rows: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isModified, setIsModified] = useState(false);

  // Sample initial data structure - this would typically be fetched or start empty
  const initialTableData = {
    headers: ["Column 1", "Column 2", "Column 3"],
    rows: [
      ["Row1Cell1", "Row1Cell2", "Row1Cell3"],
      ["Row2Cell1", "Row2Cell2", "Row2Cell3"],
    ]
  };

  useEffect(() => {
    // In a real app, you might fetch initial data for the displayId here
    // For MVP Task 2.6, we'll start with a hardcoded structure and allow modification
    setTableData(initialTableData);
    // Alert.alert("Table Editor", `Editing for Display ID: ${displayId}`);
  }, [displayId]);

  const handleSendDataToTV = async () => {
    if (!isModified && !Object.keys(tableData).length === 0) { // Allow sending initial data even if not "modified" by user yet
        // Alert.alert("No Changes", "You haven't made any changes to send.");
        // return;
        // For MVP, let's allow sending the initial data or any data present.
        // The isModified flag is more for UI feedback on the button.
    }
    setIsLoading(true);
    try {
      console.log(`Attempting to send data to TV: ${BACKEND_URL}/display/${displayId}`, tableData);
      const response = await fetch(`${BACKEND_URL}/display/${displayId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tableData: tableData }), // Ensure data is nested under tableData key as expected by backend
      });

      const responseData = await response.json();

      if (response.ok) {
        Alert.alert('Data Sent', responseData.message || 'Table data sent to TV successfully.');
        setIsModified(false); // Reset modification status
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

  // Basic handler for cell edit - very simplified for now
  const handleCellChange = (rowIndex, cellIndex, text) => {
    const newRows = [...tableData.rows];
    newRows[rowIndex][cellIndex] = text;
    setTableData({ ...tableData, rows: newRows });
    setIsModified(true);
  };

  // Basic handler for header edit - very simplified
  const handleHeaderChange = (headerIndex, text) => {
    const newHeaders = [...tableData.headers];
    newHeaders[headerIndex] = text;
    setTableData({ ...tableData, headers: newHeaders });
    setIsModified(true);
  };


  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Table Editor</Text>
      <Text style={styles.displayIdText}>Display ID: {displayId}</Text>

      <View style={styles.table}>
        {/* Headers */}
        <View style={styles.tableRow}>
          {tableData.headers.map((header, index) => (
            <TextInput
              key={`header-${index}`}
              style={[styles.tableHeader, styles.cellInput]}
              value={header}
              onChangeText={(text) => handleHeaderChange(index, text)}
            />
          ))}
        </View>
        {/* Rows */}
        {tableData.rows.map((row, rowIndex) => (
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

      <Button
        title={isLoading ? 'Sending...' : 'Send Data to TV'}
        onPress={handleSendDataToTV}
        disabled={isLoading || !isModified} // Only enable if modified
      />
      <Text style={styles.note}>
        Note: This is a very basic editor for MVP. Features like adding/removing rows/columns, sorting, etc., are for future phases.
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
  tableHeader: {
    flex: 1,
    padding: 8,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    borderWidth: 0.5,
    borderColor: '#ccc',
    textAlign: 'center',
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
