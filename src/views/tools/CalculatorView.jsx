import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/styles/calculator.css'

/**
 * Full-screen calculator: + − × ÷, decimals, delete one char, clear the
 * line. History (last 20, persisted) is hidden behind the clock button in
 * the top-right corner and opens as a bottom sheet.
 *
 * Operator precedence (× ÷ before + −) is handled by a tiny two-pass
 * evaluator (no eval()), so e.g. "2 + 3 × 4" = 14.
 */

const HISTORY_KEY = 'wn-calc-history'
const HISTORY_LIMIT = 20

/** Load persisted history (last 20). Tolerates corrupt/missing storage. */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(0, HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

/** Round to 3 decimals (0.001 precision), then render with a comma decimal. */
function formatNumber(n) {
  const r = Math.round((n + Number.EPSILON) * 1000) / 1000
  return String(r).replace('.', ',')
}

/**
 * Evaluate a display expression (using × ÷ − , symbols).
 * Returns a Number, or null on an invalid expression / division by zero.
 */
function evaluate(raw) {
  const s = raw
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '.')

  // Tokenize into numbers and operators (supports a leading unary minus
  // and a minus right after another operator).
  const tokens = []
  let num = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if ((c >= '0' && c <= '9') || c === '.') {
      num += c
    } else if ('+-*/'.includes(c)) {
      const prev = tokens[tokens.length - 1]
      if (c === '-' && num === '' && (tokens.length === 0 || typeof prev === 'string')) {
        num = '-' // unary minus
      } else {
        if (num !== '' && num !== '-') tokens.push(parseFloat(num))
        num = ''
        tokens.push(c)
      }
    }
  }
  if (num !== '' && num !== '-') tokens.push(parseFloat(num))
  if (tokens.length === 0 || typeof tokens[0] !== 'number') return null

  // Pass 1: × and ÷
  const pass1 = [tokens[0]]
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]
    const val = tokens[i + 1]
    if (typeof val !== 'number') return null
    if (op === '*') pass1.push(pass1.pop() * val)
    else if (op === '/') {
      if (val === 0) return null
      pass1.push(pass1.pop() / val)
    } else {
      pass1.push(op, val)
    }
  }

  // Pass 2: + and −
  let result = pass1[0]
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i]
    const val = pass1[i + 1]
    if (op === '+') result += val
    else if (op === '-') result -= val
  }

  return Number.isFinite(result) ? result : null
}

const OPERATORS = ['÷', '×', '−', '+']
const isOp = (ch) => OPERATORS.includes(ch)

function IconBack(props) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

function IconClock(props) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export default function CalculatorView() {
  const navigate = useNavigate()
  const [expr, setExpr] = useState('')
  const [justEvaluated, setJustEvaluated] = useState(false)
  const [history, setHistory] = useState(loadHistory)
  const [showHistory, setShowHistory] = useState(false)

  // Persist history (last 20) whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)))
    } catch {
      /* storage full / unavailable — history just won't persist */
    }
  }, [history])

  const lastChar = expr.slice(-1)

  const pressDigit = useCallback(
    (d) => {
      setExpr((prev) => (justEvaluated ? d : prev + d))
      setJustEvaluated(false)
    },
    [justEvaluated],
  )

  const pressComma = useCallback(() => {
    setExpr((prev) => {
      const base = justEvaluated ? '' : prev
      const segment = base.split(/[÷×−+]/).pop()
      if (segment.includes(',')) return base
      if (segment === '') return base + '0,'
      return base + ','
    })
    setJustEvaluated(false)
  }, [justEvaluated])

  const pressOperator = useCallback((op) => {
    setExpr((prev) => {
      if (prev === '') return op === '−' ? '−' : prev
      if (isOp(prev.slice(-1))) return prev.slice(0, -1) + op
      return prev + op
    })
    setJustEvaluated(false)
  }, [])

  const backspace = useCallback(() => {
    setExpr((prev) => prev.slice(0, -1))
    setJustEvaluated(false)
  }, [])

  const clearAll = useCallback(() => {
    setExpr('')
    setJustEvaluated(false)
  }, [])

  const equals = useCallback(() => {
    if (expr === '' || isOp(lastChar)) return
    const result = evaluate(expr)
    if (result === null) return
    const formatted = formatNumber(result)
    setHistory((prev) => [{ expr, result: formatted }, ...prev].slice(0, HISTORY_LIMIT))
    setExpr(formatted)
    setJustEvaluated(true)
  }, [expr, lastChar])

  const clearHistory = useCallback(() => setHistory([]), [])

  // Tap a past result to continue working with it.
  const applyHistoryResult = (value) => {
    setExpr(value)
    setJustEvaluated(true)
    setShowHistory(false)
  }

  return (
    <div className="page calc-page calc-page--full">
      <header className="sub-header calc-header">
        <button className="back-btn" onClick={() => navigate('/tools')} aria-label="Назад">
          <IconBack />
        </button>
        <h1 className="sub-title">Калькулятор</h1>
        <button
          className={
            showHistory
              ? 'calc-history-btn calc-history-btn--close'
              : 'calc-history-btn'
          }
          onClick={() => setShowHistory((v) => !v)}
          aria-label={showHistory ? 'Закрыть историю' : 'История'}
        >
          {showHistory ? '×' : <IconClock />}
        </button>
      </header>

      <div className="calc calc--full">
        <div className="calc-display" aria-live="polite">
          <span className="calc-expr">{expr || '0'}</span>
        </div>

        <div className="calc-keys">
          <button className="calc-key calc-key--fn" onClick={clearAll}>
            C
          </button>
          <button className="calc-key calc-key--fn" onClick={backspace} aria-label="Стереть символ">
            ⌫
          </button>
          <button className="calc-key calc-key--op" onClick={() => pressOperator('÷')}>
            ÷
          </button>
          <button className="calc-key calc-key--op" onClick={() => pressOperator('×')}>
            ×
          </button>

          <button className="calc-key" onClick={() => pressDigit('7')}>7</button>
          <button className="calc-key" onClick={() => pressDigit('8')}>8</button>
          <button className="calc-key" onClick={() => pressDigit('9')}>9</button>
          <button className="calc-key calc-key--op" onClick={() => pressOperator('−')}>
            −
          </button>

          <button className="calc-key" onClick={() => pressDigit('4')}>4</button>
          <button className="calc-key" onClick={() => pressDigit('5')}>5</button>
          <button className="calc-key" onClick={() => pressDigit('6')}>6</button>
          <button className="calc-key calc-key--op" onClick={() => pressOperator('+')}>
            +
          </button>

          <button className="calc-key" onClick={() => pressDigit('1')}>1</button>
          <button className="calc-key" onClick={() => pressDigit('2')}>2</button>
          <button className="calc-key" onClick={() => pressDigit('3')}>3</button>
          <button className="calc-key calc-key--equals" onClick={equals}>
            =
          </button>

          <button className="calc-key calc-key--zero" onClick={() => pressDigit('0')}>
            0
          </button>
          <button className="calc-key" onClick={pressComma}>,</button>
        </div>
      </div>

      {showHistory && (
        <div className="calc-hist-overlay" onClick={() => setShowHistory(false)}>
          <div className="calc-hist-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calc-hist-head">
              <span className="calc-history-title">История</span>
              {history.length > 0 && (
                <button className="calc-history-clear" onClick={clearHistory}>
                  Очистить
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="calc-history-empty">Пока пусто</p>
            ) : (
              <ul className="calc-history-list">
                {history.map((h, i) => (
                  <li key={i}>
                    <button
                      className="calc-history-item"
                      onClick={() => applyHistoryResult(h.result)}
                    >
                      <span className="calc-history-expr">{h.expr}</span>
                      <span className="calc-history-eq">= {h.result}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
