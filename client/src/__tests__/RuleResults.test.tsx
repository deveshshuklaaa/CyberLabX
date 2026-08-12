import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RuleResults } from '../components/lab/RuleResults';
import type { RuleResult } from '../types/api';

describe('RuleResults', () => {
    it('renders nothing when ruleResults is empty', () => {
        const { container } = render(<RuleResults ruleResults={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders a passed rule with check icon and message', () => {
        const rules: RuleResult[] = [
            { type: 'command', passed: true, message: 'Correct tool and flags used.' },
        ];
        render(<RuleResults ruleResults={rules} />);

        const items = screen.getAllByTestId('rule-result-item');
        expect(items).toHaveLength(1);
        expect(items[0]).toHaveTextContent('Command:');
        expect(items[0]).toHaveTextContent('Correct tool and flags used.');
        expect(items[0].className).toContain('border-success');
    });

    it('renders a failed rule with X icon and message', () => {
        const rules: RuleResult[] = [
            { type: 'scan_result', passed: false, message: 'Port 80 not found.' },
        ];
        render(<RuleResults ruleResults={rules} />);

        const items = screen.getAllByTestId('rule-result-item');
        expect(items).toHaveLength(1);
        expect(items[0]).toHaveTextContent('Scan Result:');
        expect(items[0]).toHaveTextContent('Port 80 not found.');
        expect(items[0].className).toContain('border-danger');
    });

    it('renders multiple rules with mixed pass/fail states', () => {
        const rules: RuleResult[] = [
            { type: 'command', passed: true, message: 'Tool ok.' },
            { type: 'service_detection', passed: false, message: 'Service not found.' },
            { type: 'os_detection', passed: true, message: 'OS detected.' },
        ];
        render(<RuleResults ruleResults={rules} />);

        const items = screen.getAllByTestId('rule-result-item');
        expect(items).toHaveLength(3);
        expect(items[0].className).toContain('border-success');
        expect(items[1].className).toContain('border-danger');
        expect(items[2].className).toContain('border-success');
    });

    it('renders task feedback when provided', () => {
        const rules: RuleResult[] = [
            { type: 'command', passed: true, message: 'OK' },
        ];
        render(<RuleResults ruleResults={rules} feedback="Great work!" />);

        const feedback = screen.getByTestId('task-feedback');
        expect(feedback).toHaveTextContent('Great work!');
    });

    it('uses human-readable label for known rule types', () => {
        const rules: RuleResult[] = [
            { type: 'service_detection', passed: true, message: 'Found.' },
        ];
        render(<RuleResults ruleResults={rules} />);

        expect(screen.getByTestId('rule-result-item')).toHaveTextContent('Service Detection:');
    });

    it('falls back to raw type for unknown rule types', () => {
        const rules: RuleResult[] = [
            { type: 'custom_check', passed: true, message: 'Done.' },
        ];
        render(<RuleResults ruleResults={rules} />);

        expect(screen.getByTestId('rule-result-item')).toHaveTextContent('custom_check:');
    });
});
