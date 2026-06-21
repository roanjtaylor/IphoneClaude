// Native-stack navigator: Conversation list → Chat → Settings, themed dark.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { ConversationListScreen } from '../screens/ConversationListScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ImageViewerScreen } from '../screens/ImageViewerScreen';
import { ProjectsListScreen } from '../screens/ProjectsListScreen';
import { ProjectDetailScreen } from '../screens/ProjectDetailScreen';
import { GoogleMeetScreen } from '../screens/GoogleMeetScreen';
import { useTheme } from '../state/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.textStrong },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{ title: 'Claude' }}
      />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Projects" component={ProjectsListScreen} options={{ title: 'Projects' }} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Project' }} />
      <Stack.Screen
        name="GoogleMeet"
        component={GoogleMeetScreen}
        options={{ title: 'Google Meet' }}
      />
      <Stack.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
