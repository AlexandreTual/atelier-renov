import React, { useState, useEffect } from 'react'

// Module-level singletons so this works from hooks and non-component files
let _resolve = null
let _setDialog = null

/**
 * Show a styled confirmation dialog. Returns a Promise<boolean>.
 * Drop-in replacement for window.confirm() in async functions.
 *
 * Usage: const ok = await confirm('Supprimer ?')
 */
export function confirm(message) {
    return new Promise((resolve) => {
        _resolve = resolve
        _setDialog?.({ open: true, message })
    })
}

function handleResult(ok) {
    _resolve?.(ok)
    _resolve = null
    _setDialog?.({ open: false, message: '' })
}

export function ConfirmDialog() {
    const [dialog, setDialog] = useState({ open: false, message: '' })

    useEffect(() => {
        _setDialog = setDialog
        return () => { _setDialog = null }
    }, [])

    if (!dialog.open) return null

    return (
        <div
            className="modal-overlay"
            style={{ zIndex: 2000 }}
            onClick={() => handleResult(false)}
        >
            <div
                className="modal-content"
                style={{ maxWidth: '380px', padding: '2rem', textAlign: 'center' }}
                onClick={e => e.stopPropagation()}
            >
                <p style={{ marginBottom: '1.5rem', fontSize: '1rem', color: '#333' }}>
                    {dialog.message}
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                        onClick={() => handleResult(false)}
                        className="btn-secondary"
                        style={{ padding: '0.6rem 1.5rem' }}
                        autoFocus
                    >
                        Annuler
                    </button>
                    <button
                        onClick={() => handleResult(true)}
                        style={{
                            padding: '0.6rem 1.5rem',
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius)',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Confirmer
                    </button>
                </div>
            </div>
        </div>
    )
}
