import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainScreen from './screens/MainScreen';
import IdeasListScreen from './screens/IdeasListScreen';
import IdeaDetailScreen from './screens/IdeaDetailScreen';
import SettingsScreen from './screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Main" 
          component={MainScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="IdeasList" 
          component={IdeasListScreen}
          options={{ 
            title: 'Your Ideas',
            headerBackTitleVisible: false,
          }}
        />
        <Stack.Screen
          name="IdeaDetail"
          component={IdeaDetailScreen}
          options={{
            title: 'Idea Details',
            headerBackTitleVisible: false,
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            headerBackTitleVisible: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}