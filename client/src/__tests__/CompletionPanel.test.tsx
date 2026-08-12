import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompletionPanel } from '../components/lab/CompletionPanel';

// Mock api.defaults.baseURL so download link is predictable
vi.mock('../services/api', () => ({
    api: { defaults: { baseURL: 'http://localhost:5000/api' } },
}));

describe('CompletionPanel', () => {
    it('renders total score', () => {
        render(
            <CompletionPanel
                totalScore={18}
                quizScore={8}
                quizTotalMarks={10}
                downloadUrl={null}
                reportError={null}
            />,
        );

        const score = screen.getByTestId('final-score');
        expect(score).toHaveTextContent('18');
        expect(score).toHaveTextContent('Total Score');
    });

    it('renders quiz score breakdown', () => {
        render(
            <CompletionPanel
                totalScore={20}
                quizScore={10}
                quizTotalMarks={10}
                downloadUrl={null}
                reportError={null}
            />,
        );

        expect(screen.getByText('10/10')).toBeInTheDocument();
        expect(screen.getByText('Quiz Score')).toBeInTheDocument();
    });

    it('renders download button when downloadUrl is present', () => {
        render(
            <CompletionPanel
                totalScore={15}
                quizScore={5}
                quizTotalMarks={10}
                downloadUrl="/api/reports/abc123/download"
                reportError={null}
            />,
        );

        const link = screen.getByTestId('download-report');
        expect(link).toBeInTheDocument();
        expect(link).toHaveTextContent('Download Report');
        expect(link).toHaveAttribute('href', 'http://localhost:5000/api/api/reports/abc123/download');
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('does not render download button when downloadUrl is null', () => {
        render(
            <CompletionPanel
                totalScore={12}
                quizScore={2}
                quizTotalMarks={10}
                downloadUrl={null}
                reportError={null}
            />,
        );

        expect(screen.queryByTestId('download-report')).not.toBeInTheDocument();
    });

    it('renders error message when reportError is set and downloadUrl is null', () => {
        render(
            <CompletionPanel
                totalScore={12}
                quizScore={2}
                quizTotalMarks={10}
                downloadUrl={null}
                reportError="Report generation failed. You can retry from your dashboard."
            />,
        );

        expect(screen.getByText(/Report generation failed/)).toBeInTheDocument();
        expect(screen.queryByTestId('download-report')).not.toBeInTheDocument();
    });

    it('does not render error when downloadUrl is present even if reportError exists', () => {
        render(
            <CompletionPanel
                totalScore={12}
                quizScore={2}
                quizTotalMarks={10}
                downloadUrl="/api/reports/abc/download"
                reportError="Some stale error"
            />,
        );

        expect(screen.queryByText(/Some stale error/)).not.toBeInTheDocument();
        expect(screen.getByTestId('download-report')).toBeInTheDocument();
    });

    it('always shows completion heading', () => {
        render(
            <CompletionPanel
                totalScore={0}
                quizScore={0}
                quizTotalMarks={10}
                downloadUrl={null}
                reportError={null}
            />,
        );

        expect(screen.getByText('Lab Completed!')).toBeInTheDocument();
    });
});
