import React, { useState, useEffect } from 'react'
import { X, ArrowRight } from 'lucide-react'

const PAD = 10
const TOOLTIP_WIDTH = 300

export default function OnboardingTour({ steps, onComplete, onSkip }) {
    const [step, setStep] = useState(0)
    const [rect, setRect] = useState(null)

    const current = steps[step]

    useEffect(() => {
        setStep(0)
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    useEffect(() => {
        if (!current?.target) { setRect(null); return }
        const el = document.querySelector(`[data-tour="${current.target}"]`)
        const update = () => {
            const el2 = document.querySelector(`[data-tour="${current.target}"]`)
            if (el2) setRect(el2.getBoundingClientRect())
        }
        update()
        window.addEventListener('resize', update)
        window.addEventListener('scroll', update, true)
        const handleTargetClick = () => {
            if (step < steps.length - 1) setStep(s => s + 1)
            else onComplete()
        }
        if (el) el.addEventListener('click', handleTargetClick)
        return () => {
            window.removeEventListener('resize', update)
            window.removeEventListener('scroll', update, true)
            if (el) el.removeEventListener('click', handleTargetClick)
        }
    }, [step, current?.target])

    const handlePrimary = () => {
        if (current.onClick) current.onClick()
        if (step < steps.length - 1) setStep(s => s + 1)
        else onComplete()
    }

    const quad = (top, left, width, height) => ({
        position: 'fixed', zIndex: 9000,
        top, left, width, height,
        background: 'rgba(0,0,0,0.55)',
        pointerEvents: 'all',
    })

    let tooltipStyle = {
        position: 'fixed', zIndex: 9001,
        background: 'white', borderRadius: '12px',
        padding: '1.25rem', width: `${TOOLTIP_WIDTH}px`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        pointerEvents: 'all',
    }
    let arrowLeft = null

    if (rect) {
        const centerX = rect.left + rect.width / 2
        let left = centerX - TOOLTIP_WIDTH / 2
        left = Math.max(16, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 16))
        tooltipStyle = { ...tooltipStyle, top: rect.bottom + PAD + 12, left }
        arrowLeft = Math.max(12, Math.min(centerX - left - 8, TOOLTIP_WIDTH - 28))
    } else {
        tooltipStyle = { ...tooltipStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }

    return (
        <>
            {rect ? (
                <>
                    <div style={quad(0, 0, '100%', Math.max(0, rect.top - PAD))} onClick={onSkip} />
                    <div style={quad(rect.bottom + PAD, 0, '100%', '100vh')} onClick={onSkip} />
                    <div style={quad(rect.top - PAD, 0, Math.max(0, rect.left - PAD), rect.height + PAD * 2)} onClick={onSkip} />
                    <div style={quad(rect.top - PAD, rect.right + PAD, '100vw', rect.height + PAD * 2)} onClick={onSkip} />
                </>
            ) : (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.55)', pointerEvents: 'all' }} onClick={onSkip} />
            )}

            <div style={tooltipStyle}>
                {rect && arrowLeft !== null && (
                    <div style={{
                        position: 'absolute', top: -8, left: arrowLeft,
                        width: 0, height: 0,
                        borderLeft: '8px solid transparent',
                        borderRight: '8px solid transparent',
                        borderBottom: '8px solid white',
                    }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 500 }}>
                        Étape {step + 1} / {steps.length}
                    </span>
                    <button onClick={onSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 0, lineHeight: 1 }}>
                        <X size={16} />
                    </button>
                </div>
                <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 600, color: '#1a1a1a' }}>
                    {current.title}
                </h3>
                <p style={{ margin: '0 0 1.1rem', fontSize: '0.875rem', color: '#666', lineHeight: 1.55 }}>
                    {current.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={onSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '0.82rem', padding: 0 }}>
                        Passer le guide
                    </button>
                    <button onClick={handlePrimary} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.88rem' }}>
                        {current.primaryLabel || (step < steps.length - 1 ? 'Suivant' : 'Terminer')}
                        <ArrowRight size={15} />
                    </button>
                </div>
            </div>
        </>
    )
}
