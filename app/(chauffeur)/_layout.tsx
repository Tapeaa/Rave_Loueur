import { Stack } from 'expo-router';

export default function ChauffeurLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Accueil' }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="redirect" options={{ headerShown: false }} />
      <Stack.Screen name="course-en-cours" />
      <Stack.Screen name="courses" />
      <Stack.Screen name="gains" />
      <Stack.Screen name="profil" />
      <Stack.Screen name="conditions-utilisation" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="course-details/[id]" />
    </Stack>
  );
}
