import { useState } from 'react';
import type { AppAlertButton } from '../components/AppAlert';

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
}

const HIDDEN: AlertState = { visible: false, title: '' };

export function useAppAlert() {
  const [alertState, setAlertState] = useState<AlertState>(HIDDEN);

  const showAlert = (title: string, message?: string, buttons?: AppAlertButton[]) => {
    setAlertState({ visible: true, title, message, buttons });
  };

  const hideAlert = () => setAlertState(HIDDEN);

  return { alertState, showAlert, hideAlert };
}
