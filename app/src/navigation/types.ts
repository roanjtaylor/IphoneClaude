// Typed route params for the native-stack navigator.
export type RootStackParamList = {
  ConversationList: undefined;
  Chat: { conversationId: string; title?: string };
  Settings: undefined;
  ImageViewer: { uri: string };
  Projects: undefined;
  ProjectDetail: { projectId: string; title?: string };
};
