import { useUiStore } from '@/stores/ui'
import ToastItem from './ToastItem'

/**
 * Toast stack. Subscribes to ui.toasts and renders each as a ToastItem.
 * (Was ToastContainer.vue with <transition-group>; see ToastItem for the
 * animation note.)
 */
export default function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts)
  const dismissToast = useUiStore((s) => s.dismissToast)

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </div>
  )
}