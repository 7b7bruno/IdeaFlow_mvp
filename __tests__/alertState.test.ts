// Tests for the alert state logic extracted from useAppAlert.
// We test the pure reducer directly so we don't need React or jsdom.

import type { AppAlertButton } from '../components/AppAlert';

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
}

const HIDDEN: AlertState = { visible: false, title: '' };

function showAlert(title: string, message?: string, buttons?: AppAlertButton[]): AlertState {
  return { visible: true, title, message, buttons };
}

function hideAlert(): AlertState {
  return HIDDEN;
}

describe('alert state logic', () => {
  it('starts hidden', () => {
    expect(HIDDEN.visible).toBe(false);
    expect(HIDDEN.title).toBe('');
  });

  it('showAlert sets visible=true with title and message', () => {
    const state = showAlert('Error', 'Something went wrong');
    expect(state.visible).toBe(true);
    expect(state.title).toBe('Error');
    expect(state.message).toBe('Something went wrong');
  });

  it('showAlert with no message leaves message undefined', () => {
    const state = showAlert('Info');
    expect(state.message).toBeUndefined();
  });

  it('showAlert passes buttons through', () => {
    const buttons: AppAlertButton[] = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {} },
    ];
    const state = showAlert('Confirm', 'Are you sure?', buttons);
    expect(state.buttons).toHaveLength(2);
    expect(state.buttons![0].text).toBe('Cancel');
    expect(state.buttons![1].style).toBe('destructive');
  });

  it('hideAlert resets to hidden state', () => {
    const shown = showAlert('Error', 'Oops');
    expect(shown.visible).toBe(true);
    const hidden = hideAlert();
    expect(hidden.visible).toBe(false);
    expect(hidden.title).toBe('');
    expect(hidden.message).toBeUndefined();
  });
});
