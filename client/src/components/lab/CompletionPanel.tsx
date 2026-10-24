import { Award, Download, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
    totalScore: number;
    quizScore: number;
    quizTotalMarks: number;
    downloadUrl: string | null;
    reportError: string | null;
}

export function CompletionPanel({
    totalScore,
    quizScore,
    quizTotalMarks,
    downloadUrl,
    reportError,
}: Props) {
    const origin = (api.defaults.baseURL ?? '').replace(/\/api\/?$/, '');
    const fullDownloadUrl = downloadUrl
        ? `${origin}${downloadUrl}`
        : null;

    return (
        <section
            role="status"
            data-testid="completion-panel"
            className="panel mt-6 border-l-4 border-l-success p-6"
        >
            <div className="flex items-center gap-3">
                <Award size={28} className="text-success" />
                <h2 className="text-lg font-semibold text-success">
                    Lab Completed!
                </h2>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-6">
                <div data-testid="final-score" className="text-center">
                    <p className="text-3xl font-bold text-ink">{totalScore}</p>
                    <p className="text-sm text-muted">Total Score</p>
                </div>
                <div className="text-center">
                    <p className="text-xl font-semibold text-ink">
                        {quizScore}/{quizTotalMarks}
                    </p>
                    <p className="text-sm text-muted">Quiz Score</p>
                </div>
            </div>

            {fullDownloadUrl && (
                <a
                    data-testid="download-report"
                    href={fullDownloadUrl}
                    className="button mt-5 inline-flex gap-2"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Download size={16} />
                    Download Report
                </a>
            )}

            {reportError && !downloadUrl && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{reportError}</span>
                </div>
            )}
        </section>
    );
}
