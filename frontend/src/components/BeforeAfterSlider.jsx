import React from 'react';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

function BeforeAfterSlider({ beforeImage, afterImage }) {
    if (!beforeImage || !afterImage) return null;

    return (
        <div style={{
            marginTop: '2rem',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: '1px solid var(--border-color)'
        }}>
            <div style={{
                padding: '0.5rem 1rem',
                background: 'linear-gradient(to right, #f8f9fa, #fff)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'center',
                gap: '2rem'
            }}>
                <span style={{ fontWeight: 'bold', color: '#e67e22', fontSize: '0.9rem' }}>AVANT</span>
                <span style={{ fontWeight: 'bold', color: '#2ecc71', fontSize: '0.9rem' }}>APRÈS</span>
            </div>
            <ReactCompareSlider
                itemOne={<ReactCompareSliderImage src={beforeImage.url} alt="Avant rénovation" />}
                itemTwo={<ReactCompareSliderImage src={afterImage.url} alt="Après rénovation" />}
                style={{ height: '400px', width: '100%', objectFit: 'contain' }}
            />
        </div>
    );
}

export default BeforeAfterSlider;
