import { create } from 'zustand'
import { hapticNotification } from '@/utils/telegram'

let toastSeq = 0
let promptSeq = 0

/**
 * UI store: ephemeral state shared across views.
 * - toasts: stack of short notifications
 * - confirm: a single pending confirm dialog (Promise-based)
 * - prompt: a single pending text-input dialog (Promise-based)
 *
 * ── Porting note: immutable updates ─────────────────────────────────
 * In Vue we mutated arrays in place: toasts.value.push(t). Zustand state
 * is immutable like React — never mutate, always replace:
 *     push   → set({ toasts: [...get().toasts, t] })
 *     filter → set({ toasts: get().toasts.filter(...) })
 * Same rule you'd follow with useState. The Promise-based confirm/prompt
 * pattern carries over unchanged — the dialog object just lives in state.
 * ─────────────────────────────────────────────────────────────────────
 */
export const useUiStore = create((set, get) => ({
  toasts: [],
  confirmDialog: null,
  promptDialog: null,
  diagnosticsOpen: false,
  // Number of full-screen sheets/overlays currently open (e.g. the order
  // details sheet). The floating "Взять заказ" CTA hides while > 0 so it
  // can't overlap or be tapped through the sheet's own buttons.
  overlayCount: 0,

  pushOverlay: () => set({ overlayCount: get().overlayCount + 1 }),
  popOverlay: () => set({ overlayCount: Math.max(0, get().overlayCount - 1) }),

  /**
   * Show a toast. type: 'success' | 'error' | 'info' | 'warning'
   * Optional `action`: { label, handler } adds a tappable link next to
   * the message. Returns the toast id so callers can dismiss it early.
   */
  toast: (message, { type = 'info', duration = 3000, action = null } = {}) => {
    const id = ++toastSeq
    set({ toasts: [...get().toasts, { id, message, type, action }] })

    if (type === 'success') hapticNotification('success')
    else if (type === 'error') hapticNotification('error')
    else if (type === 'warning') hapticNotification('warning')

    if (duration > 0) {
      setTimeout(() => get().dismissToast(id), duration)
    }
    return id
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  // === Diagnostics panel (globally openable from any toast) ===
  openDiagnostics: () => set({ diagnosticsOpen: true }),
  closeDiagnostics: () => set({ diagnosticsOpen: false }),

  // Convenience helpers
  toastSuccess: (msg, opts) => get().toast(msg, { ...opts, type: 'success' }),
  // Errors are sticky-ish (5s) and offer a "Логи" link so the user can
  // surface diagnostic info to support when we can't reproduce the issue.
  toastError: (msg, opts) =>
    get().toast(msg, {
      duration: 5000,
      ...opts,
      type: 'error',
      action: opts?.action ?? {
        label: 'Логи',
        handler: () => get().openDiagnostics(),
      },
    }),
  toastInfo: (msg, opts) => get().toast(msg, { ...opts, type: 'info' }),
  toastWarning: (msg, opts) => get().toast(msg, { ...opts, type: 'warning' }),

  /**
   * Promise-based confirm dialog. The ConfirmDialog component renders from
   * confirmDialog state and calls resolveConfirm() when the user picks.
   */
  confirm: ({
    title = 'Подтвердите',
    message = '',
    confirmText = 'OK',
    cancelText = 'Отмена',
    danger = false,
  } = {}) =>
    new Promise((resolve) => {
      set({
        confirmDialog: {
          title,
          message,
          confirmText,
          cancelText,
          danger,
          resolve,
        },
      })
    }),

  resolveConfirm: (result) => {
    const dialog = get().confirmDialog
    if (!dialog) return
    dialog.resolve(result)
    set({ confirmDialog: null })
  },

  /**
   * Promise-based text-input dialog. Returns the entered string on confirm,
   * or null if the user cancelled.
   */
  prompt: ({
    title = 'Введите значение',
    initial = '',
    placeholder = '',
    multiline = false,
    rows = 4,
    inputType = 'text',
    inputMode = 'text',
    maxLength = 2000,
    confirmText = 'Сохранить',
    cancelText = 'Отмена',
    required = false,
  } = {}) =>
    new Promise((resolve) => {
      set({
        promptDialog: {
          // Unique per-open token — lets the PromptHost component use it as a
          // React key so the modal remounts (and reseeds its input) on each
          // new prompt. Cheaper/cleaner than tagging the object later.
          _token: ++promptSeq,
          title,
          initial,
          placeholder,
          multiline,
          rows,
          inputType,
          inputMode,
          maxLength,
          confirmText,
          cancelText,
          required,
          resolve,
        },
      })
    }),

  resolvePrompt: (result) => {
    const dialog = get().promptDialog
    if (!dialog) return
    dialog.resolve(result)
    set({ promptDialog: null })
  },
}))
