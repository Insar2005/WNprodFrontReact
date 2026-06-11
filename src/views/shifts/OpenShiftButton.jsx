import { useWorkplaceStore } from '@/stores/workplace'
import { formatMoney } from '@/utils/format'

/**
 * Shown when no shift is open. Previews the workplace's pay settings
 * (snapshotted into the shift at open time) + the open button.
 * (Was OpenShiftButton.vue.) $emit('open-shift') → onOpen().
 */
export default function OpenShiftButton({ opening = false, onOpen }) {
  const current = useWorkplaceStore((s) => s.current())
  const shiftTypeDefault = current?.shift_type_default ?? 'fixed'
  const serviceDefault = current?.service_percent_default ?? 0
  const payDefault = current?.pay_for_shift_default ?? 0
  const currency = current?.currency ?? 'RUB'

  return (
    <div className="osb-block">
      <div className="osb-content">
        <h3 className="osb-title">Смена не открыта</h3>
        <p className="osb-text">
          Откройте смену, чтобы принимать заказы.
          <br />
          Все настройки заведения будут зафиксированы в момент открытия.
        </p>

        {current && (
          <div className="osb-snapshot">
            <div className="osb-snapshot-row">
              <span className="osb-snapshot-label">Тип оплаты</span>
              <span className="osb-snapshot-value">
                {shiftTypeDefault === 'percent' ? 'Процент' : 'Фикс'}
              </span>
            </div>
            {shiftTypeDefault === 'percent' ? (
              <div className="osb-snapshot-row">
                <span className="osb-snapshot-label">Процент</span>
                <span className="osb-snapshot-value">{serviceDefault}%</span>
              </div>
            ) : (
              <div className="osb-snapshot-row">
                <span className="osb-snapshot-label">Ставка</span>
                <span className="osb-snapshot-value">
                  {formatMoney(payDefault, currency)}
                </span>
              </div>
            )}
          </div>
        )}

        <button className="osb-open" disabled={opening} onClick={() => onOpen?.()}>
          {opening ? 'Открываем…' : '▶ Открыть смену'}
        </button>
      </div>
    </div>
  )
}