import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BagCard from './BagCard';

const baseBag = {
    id: 1,
    name: 'Kelly 28',
    brand: 'Hermès',
    status: 'selling',
    purchase_price: 800,
    target_resale_price: 1200,
    actual_resale_price: 0,
    fees: 0,
    material_costs: 0,
    images: [],
};

describe('BagCard', () => {
    it('renders the bag name and brand', () => {
        render(<BagCard bag={baseBag} onClick={vi.fn()} />);
        expect(screen.getByText('Kelly 28')).toBeInTheDocument();
        expect(screen.getByText('Hermès')).toBeInTheDocument();
    });

    it('shows the correct status badge for "selling"', () => {
        render(<BagCard bag={baseBag} onClick={vi.fn()} />);
        expect(screen.getByText('En vente')).toBeInTheDocument();
    });

    it('shows the correct status badge for "sold"', () => {
        const soldBag = { ...baseBag, status: 'sold', actual_resale_price: 1100 };
        render(<BagCard bag={soldBag} onClick={vi.fn()} />);
        // "Vendu" appears in both the status badge and the price column for sold items
        expect(screen.getAllByText('Vendu').length).toBeGreaterThanOrEqual(1);
    });

    it('shows the correct status badge for "to_be_cleaned"', () => {
        const cleanBag = { ...baseBag, status: 'to_be_cleaned' };
        render(<BagCard bag={cleanBag} onClick={vi.fn()} />);
        expect(screen.getByText('À nettoyer')).toBeInTheDocument();
    });

    it('displays estimated profit label for non-sold items', () => {
        render(<BagCard bag={baseBag} onClick={vi.fn()} />);
        expect(screen.getByText('Profit Est.')).toBeInTheDocument();
    });

    it('displays actual profit label for sold items', () => {
        const soldBag = { ...baseBag, status: 'sold', actual_resale_price: 1100 };
        render(<BagCard bag={soldBag} onClick={vi.fn()} />);
        expect(screen.getByText('Profit Réel')).toBeInTheDocument();
    });
});
