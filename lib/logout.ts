import { removeDriverSessionId, secureStorage } from './api';
import { addDriverTag, removeExternalId } from './onesignal';
import { disconnectSocket } from './socket';
import { queryClient } from './queryClient';

export async function logoutDriver(): Promise<void> {
  addDriverTag('status', 'offline');
  removeExternalId();
  try {
    await secureStorage.deleteItem('driverExternalId');
  } catch {}
  await removeDriverSessionId();
  disconnectSocket();
  queryClient.clear();
}
