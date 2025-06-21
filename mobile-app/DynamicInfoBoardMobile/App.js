import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import PairingScreen from './screens/PairingScreen';
import TableEditorScreen from './screens/TableEditorScreen';

const Stack = createStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Pairing">
        <Stack.Screen
          name="Pairing"
          component={PairingScreen}
          options={{ title: 'Pair with TV' }}
        />
        <Stack.Screen
          name="TableEditor"
          component={TableEditorScreen}
          options={{ title: 'Edit Table' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
