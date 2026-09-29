/** Call status shared by the phone buttons and the Call Centre page. Does not load Amazon Connect. */
let callUi = { phase: 'idle', name: '', phone: '', startedAt: null, message: '' }
const callUiListeners = new Set()

export function publishCallUi(patch) {
  callUi = { ...callUi, ...patch }
  for (const listener of callUiListeners) listener(callUi)
}

export function subscribeCallUi(listener) {
  callUiListeners.add(listener)
  listener(callUi)
  return () => callUiListeners.delete(listener)
}

export function readCallUi() {
  return callUi
}
