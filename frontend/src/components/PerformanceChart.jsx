import React, { useState, useEffect, useCallback } from 'react'
import { BarChart2 } from 'lucide-react'

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function formatMonth(m) {
    const [year, month] = m.split('-')
    return `${MONTHS_FR[parseInt(month) - 1]} ${year.slice(2)}`
}

function PerformanceChart({ authenticatedFetch }) {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchStats = useCallback(async () => {
        try {
            const resp = await authenticatedFetch('/api/stats/monthly')
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            setData(await resp.json())
        } catch (err) {
            console.error('Failed to fetch monthly stats', err)
        } finally {
            setLoading(false)
        }
    }, [authenticatedFetch])

    useEffect(() => { fetchStats() }, [fetchStats])

    if (loading) return (
        <div style={{ marginTop: '2rem', background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem' }}>
            <div className="skeleton" style={{ height: '20px', width: '200px', marginBottom: '1.5rem' }} />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '140px', marginBottom: '1rem' }}>
                {[70, 45, 85, 55, 90, 60].map((h, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
                        <div className="skeleton" style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0' }} />
                        <div className="skeleton" style={{ flex: 1, height: `${h * 0.5}%`, borderRadius: '3px 3px 0 0' }} />
                    </div>
                ))}
            </div>
            {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                    <div className="skeleton" style={{ height: '14px', width: '60px' }} />
                    <div className="skeleton" style={{ height: '14px', flex: 1 }} />
                    <div className="skeleton" style={{ height: '14px', flex: 1 }} />
                    <div className="skeleton" style={{ height: '14px', flex: 1 }} />
                </div>
            ))}
        </div>
    )

    if (data.length === 0) return (
        <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#999', fontStyle: 'italic', marginTop: '2rem' }}>
            Aucune vente enregistrée — le graphique apparaîtra dès le premier article vendu.
        </div>
    )

    const maxRevenue = Math.max(...data.map(d => Math.max(d.revenue, d.expenses)), 1)
    const maxAbsProfit = Math.max(...data.map(d => Math.abs(d.profit)), 1)

    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
    const totalProfit = data.reduce((s, d) => s + d.profit, 0)
    const totalExpenses = data.reduce((s, d) => s + d.expenses, 0)
    const totalCount = data.reduce((s, d) => s + d.count, 0)

    return (
        <div style={{ marginTop: '2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <BarChart2 size={20} /> Performance mensuelle
            </h3>

            <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem' }}>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#666', flexWrap: 'wrap' }}>
                    {[
                        { color: '#3b82f6', label: 'CA' },
                        { color: '#f97316', label: 'Dépenses' },
                        { color: '#2ecc71', label: 'Profit' },
                    ].map(({ color, label }) => (
                        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ width: '10px', height: '10px', background: color, borderRadius: '2px', display: 'inline-block' }} />
                            {label}
                        </span>
                    ))}
                </div>

                {/* Revenue + Expenses bars */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '140px', padding: '0 2px', borderBottom: '1px solid #e0e0e0', marginBottom: '4px' }}>
                    {data.map((d, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '2px', height: '100%' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                <div
                                    title={`${formatMonth(d.month)} — CA : ${d.revenue.toFixed(2)} €`}
                                    style={{
                                        background: '#3b82f6',
                                        borderRadius: '3px 3px 0 0',
                                        height: `${(d.revenue / maxRevenue) * 100}%`,
                                        minHeight: d.revenue > 0 ? '2px' : '0',
                                        opacity: 0.85,
                                    }}
                                />
                            </div>
                            {d.expenses > 0 && (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    <div
                                        title={`${formatMonth(d.month)} — Dépenses : ${d.expenses.toFixed(2)} €`}
                                        style={{
                                            background: '#f97316',
                                            borderRadius: '3px 3px 0 0',
                                            height: `${(d.expenses / maxRevenue) * 100}%`,
                                            minHeight: '2px',
                                            opacity: 0.75,
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Profit bars (bidirectional around zero) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '56px', padding: '0 2px', borderBottom: '1px solid #e0e0e0', marginBottom: '4px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', background: '#ddd', pointerEvents: 'none' }} />
                    {data.map((d, i) => {
                        const pct = Math.abs(d.profit) / maxAbsProfit * 50
                        return (
                            <div key={i} style={{ flex: 1, height: '100%', position: 'relative' }}>
                                {d.profit >= 0 ? (
                                    <div
                                        title={`${formatMonth(d.month)} — Profit : +${d.profit.toFixed(2)} €`}
                                        style={{ position: 'absolute', bottom: '50%', left: 0, right: 0, height: `${pct}%`, background: '#2ecc71', borderRadius: '2px 2px 0 0', opacity: 0.85 }}
                                    />
                                ) : (
                                    <div
                                        title={`${formatMonth(d.month)} — Profit : ${d.profit.toFixed(2)} €`}
                                        style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: `${pct}%`, background: '#e74c3c', borderRadius: '0 0 2px 2px', opacity: 0.85 }}
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* X axis labels */}
                <div style={{ display: 'flex', gap: '4px', padding: '0 2px', marginBottom: '1.5rem' }}>
                    {data.map((d, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: '#aaa' }}>
                            {formatMonth(d.month)}
                        </div>
                    ))}
                </div>

                {/* Summary table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #eee' }}>
                                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#666', fontWeight: '600' }}>Mois</th>
                                <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#3b82f6' }}>CA</th>
                                <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#f97316' }}>Dépenses</th>
                                <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#555' }}>Profit</th>
                                <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: '#999' }}>Ventes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((d, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', color: '#555' }}>{formatMonth(d.month)}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>{d.revenue.toFixed(2)} €</td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#f97316' }}>{d.expenses > 0 ? `${d.expenses.toFixed(2)} €` : '—'}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600', color: d.profit >= 0 ? '#2ecc71' : '#e74c3c' }}>
                                        {d.profit >= 0 ? '+' : ''}{d.profit.toFixed(2)} €
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#999' }}>{d.count}</td>
                                </tr>
                            ))}
                            <tr style={{ borderTop: '2px solid #eee' }}>
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>Total</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{totalRevenue.toFixed(2)} €</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#f97316' }}>{totalExpenses.toFixed(2)} €</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: totalProfit >= 0 ? '#2ecc71' : '#e74c3c' }}>
                                    {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} €
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#999' }}>{totalCount}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default PerformanceChart
