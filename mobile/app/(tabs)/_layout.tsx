import { Tabs } from 'expo-router';
import { FileText, Search, MessageSquare, GitBranch, Grid } from 'lucide-react-native';
import { colors, tabBarHeight } from '@/constants/theme';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabBarHeight + (Platform.OS === 'ios' ? 20 : 0),
          paddingBottom: Platform.OS === 'ios' ? 20 : 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Notes',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'AI Chat',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="graph"
        options={{
          title: 'Graph',
          tabBarIcon: ({ color, size }) => <GitBranch color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Grid color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
