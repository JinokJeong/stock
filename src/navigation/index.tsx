// 네비게이션 — BottomTab 5개 + Stack (StockDetail 모달)
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { colors } from '../theme/colors';
import { DashboardScreen } from '../screens/DashboardScreen';
import { RecommendScreen } from '../screens/RecommendScreen';
import { ThemeScreen } from '../screens/ThemeScreen';
import { AlertBuilderScreen } from '../screens/AlertBuilderScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StockDetailScreen } from '../screens/StockDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_ICONS: Record<string, string> = {
  Dashboard:    '◈',
  Recommend:    '★',
  Theme:        '⚡',
  AlertBuilder: '🔔',
  Settings:     '⚙',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18, color: focused ? colors.accent : colors.text3 }}>
        {TAB_ICONS[name]}
      </Text>
    </View>
  );
}

function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg2,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontSize: 10, marginTop: -2 },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: '대시보드' }}
      />
      <Tab.Screen
        name="Recommend"
        component={RecommendScreen}
        options={{ tabBarLabel: '추천 종목' }}
      />
      <Tab.Screen
        name="Theme"
        component={ThemeScreen}
        options={{ tabBarLabel: '테마' }}
      />
      <Tab.Screen
        name="AlertBuilder"
        component={AlertBuilderScreen}
        options={{ tabBarLabel: '알림' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: '설정' }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigation() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.accent,
          background: colors.bg,
          card: colors.bg2,
          text: colors.text,
          border: colors.border,
          notification: colors.down,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: 'normal' as const },
          medium: { fontFamily: 'System', fontWeight: '500' as const },
          bold: { fontFamily: 'System', fontWeight: '700' as const },
          heavy: { fontFamily: 'System', fontWeight: '900' as const },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={BottomTabs} />
        <Stack.Screen
          name="StockDetail"
          component={StockDetailScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
