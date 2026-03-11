import { useState, useEffect, useRef } from 'react'

const STEPS = [
  { id: 'extract',  label: 'Extracting requirements', detail: 'Parsing job description',       durationMs: 15000 },
  { id: 'map',      label: 'Mapping to your resume',  detail: 'Finding best matches',           durationMs: 15000 },
  { id: 'tailor',   label: 'Tailoring content',       detail: 'Writing your tailored resume',   durationMs: 40000 },
  { id: 'validate', label: 'Validating & scoring',    detail: 'ATS check + fact verification',  durationMs: 20000 },
]

export default function StepProgress({ active }) {
  const [currentStep, setCurrentStep] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!active) {
      setCurrentStep(0)
      clearTimeout(timerRef.current)
      return
    }

    let stepIdx = 0
    function advance() {
      stepIdx += 1
      if (stepIdx < STEPS.length) {
        setCurrentStep(stepIdx)
        timerRef.current = setTimeout(advance, STEPS[stepIdx].durationMs)
      }
    }

    setCurrentStep(0)
    timerRef.current = setTimeout(advance, STEPS[0].durationMs)
    return () => clearTimeout(timerRef.current)
  }, [active])

  if (!active) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-4">
      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const isDone    = idx < currentStep
          const isActive  = idx === currentStep
          const isPending = idx > currentStep

          return (
            <div key={step.id} className="flex items-start gap-3">
              <div className="shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center">
                {isDone && (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isActive && (
                  <svg className="animate-spin w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                {isPending && (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium leading-tight ${
                  isDone   ? 'text-green-700' :
                  isActive ? 'text-blue-700'  :
                             'text-gray-400'
                }`}>
                  {step.label}
                </p>
                {isActive && (
                  <p className="text-xs text-blue-500 mt-0.5">{step.detail}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
