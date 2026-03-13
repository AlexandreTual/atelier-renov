import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle2, Circle, X, ChevronUp, ChevronDown, PlayCircle } from 'lucide-react'

export default function OnboardingFloating({ user, brands, itemTypes, bagTotal, onDismiss, onNewArticle, onStartTour }) {
    const [expanded, setExpanded] = useState(false)

    const step1 = (brands?.length ?? 0) > 0
    const step2 = (itemTypes?.length ?? 0) > 0
    const step3 = (bagTotal ?? 0) > 0
    const allDone = step1 && step2 && step3
    const completedCount = [step1, step2, step3].filter(Boolean).length

    const dismissed = useRef(false)
    useEffect(() => {
        if (allDone && !dismissed.current) {
            dismissed.current = true
            const t = setTimeout(() => onDismiss(), 1500)
            return () => clearTimeout(t)
        }
    }, [allDone, onDismiss])

    if (!user || !user.onboarding_enabled || user.onboarding_done) return null

    const steps = [
        { done: step1, label: 'Configurer vos marques' },
        { done: step2, label: "Configurer vos types d'articles" },
        { done: step3, label: 'Créer votre premier article', action: onNewArticle },
    ]

    return (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1000, fontFamily: 'inherit' }}>
            {expanded && (
                <div style={{
                    background: 'white', borderRadius: '14px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
                    padding: '1.25rem', width: '260px', marginBottom: '0.6rem',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <strong style={{ fontSize: '0.95rem' }}>
                            {allDone ? '🎉 Tout est prêt !' : '🚀 Démarrage'}
                        </strong>
                        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 0 }}>
                            <X size={15} />
                        </button>
                    </div>

                    {steps.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.7rem' }}>
                            {s.done
                                ? <CheckCircle2 size={18} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                                : <Circle size={18} style={{ color: '#ddd', flexShrink: 0 }} />
                            }
                            <span style={{
                                fontSize: '0.85rem', flex: 1,
                                color: s.done ? '#aaa' : '#333',
                                textDecoration: s.done ? 'line-through' : 'none',
                            }}>
                                {s.label}
                            </span>
                            {!s.done && s.action && (
                                <button onClick={s.action} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', fontSize: '0.8rem', padding: 0, fontWeight: 500 }}>
                                    Créer →
                                </button>
                            )}
                        </div>
                    ))}

                    {onStartTour && !allDone && (
                        <button
                            onClick={() => { onStartTour(); setExpanded(false) }}
                            style={{ marginTop: '0.5rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#666', fontFamily: 'inherit' }}
                        >
                            <PlayCircle size={15} /> Relancer le guide
                        </button>
                    )}
                </div>
            )}

            <button
                onClick={() => setExpanded(e => !e)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '999px', padding: '0.65rem 1.1rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', fontFamily: 'inherit' }}
            >
                <span>{allDone ? '✓ Terminé' : `Démarrage ${completedCount}/3`}</span>
                {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
        </div>
    )
}
