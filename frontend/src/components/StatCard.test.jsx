import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from './StatCard';

describe('StatCard', () => {
    it('renders label and value', () => {
        render(<StatCard label="Articles" value={42} />);
        expect(screen.getByText('Articles')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('applies custom className to value', () => {
        render(<StatCard label="Profit" value="100 €" className="profit-positive" />);
        const valueEl = screen.getByText('100 €');
        expect(valueEl).toHaveClass('profit-positive');
    });
});
