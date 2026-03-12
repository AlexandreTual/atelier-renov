import React, { useEffect, useRef } from 'react'

const Step = ({ done, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
        <span style={{ fontSize: '1rem' }}>{done ? '✅' : '☐'}</span>
        <span style={{ color: done ? 'var(--text-muted, #888)' : 'inherit', textDecoration: done ? 'line-through' : 'none' }}>
            {label}
        </span>
    </div>
)

export default function OnboardingChecklist({ user, brands, itemTypes, bagTotal, onDismiss }) {
    if (!user || !user.onboarding_enabled || user.onboarding_done) return null

    const step1 = (brands?.length ?? 0) > 0
    const step2 = (itemTypes?.length ?? 0) > 0
    const step3 = (bagTotal ?? 0) > 0
    const allDone = step1 && step2 && step3

    const dismissed = useRef(false)
    useEffect(() => {
        if (allDone && !dismissed.current) {
            dismissed.current = true
            const t = setTimeout(() => onDismiss(), 1000)
            return () => clearTimeout(t)
        }
    }, [allDone, onDismiss])

    return (
        <div style={{
            background: 'var(--card-bg, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            margin: '1rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.95rem' }}>
                    {allDone ? '🎉 Tout est prêt !' : '🚀 Démarrez en 3 étapes'}
                </strong>
                <button
                    onClick={onDismiss}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted, #888)', fontSize: '1.1rem', lineHeight: 1, padding: '0 0.25rem'
                    }}
                    aria-label="Ignorer"
                >
                    ×
                </button>
            </div>
            <Step done={step1} label="Ajouter une marque" />
            <Step done={step2} label="Ajouter un type d'article" />
            <Step done={step3} label="Créer votre premier article" />
        </div>
    )
}
