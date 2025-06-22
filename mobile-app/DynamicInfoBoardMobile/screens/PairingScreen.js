import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import Toast from 'react-native-toast-message';

// Use 10.0.2.2 for localhost when running in Android emulator connecting to a server on the host machine.
// For iOS simulator, it would be http://localhost:3000
// Users should change this IP based on their development setup.
import { BACKEND_URL } from '../src/config';

const PairingScreen = ({ navigation }) => {
  const [pairingCode, setPairingCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePairing = async () => {
    if (pairingCode.length !== 6 || !/^\d+$/.test(pairingCode)) {
      Alert.alert('Invalid Code', 'Pairing code must be a 6-digit number.');
      return;
    }
    setIsLoading(true);
    try {
      console.log(`Attempting to pair with code: ${pairingCode} at ${BACKEND_URL}/pair`);
      const response = await fetch(`${BACKEND_URL}/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayId: pairingCode }),
      });

      const responseData = await response.json();

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Pairing Successful',
          text2: responseData.message || `Successfully paired with display ${pairingCode}.`,
        });
        navigation.navigate('TableEditor', { displayId: pairingCode });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Pairing Failed',
          text2: responseData.message || 'Could not pair with the display. Check the code or server.',
        });
      }
    } catch (error) {
      console.error("Pairing error:", error);
      Toast.show({
        type: 'error',
        text1: 'Pairing Error',
        text2: error.message || 'An error occurred. Check network and server.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Pairing Code</Text>
      <Text style={styles.instructions}>
        Enter the 6-digit code displayed on your TV screen.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 123456"
        value={pairingCode}
        onChangeText={setPairingCode}
        keyboardType="number-pad"
        maxLength={6}
      />
      <Button
        title={isLoading ? 'Connecting...' : 'Connect to TV'}
        onPress={handlePairing}
        disabled={isLoading || pairingCode.length !== 6}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  input: {
    width: '80%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
});

export default PairingScreen;
