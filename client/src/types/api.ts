export type Role = 'student' | 'faculty' | 'admin';

export interface User {
    id: string; firstName: string; lastName: string; email: string; role: Role; isActive: boolean;
}

export interface Task {
    id: string; title: string; description: string; hints: string[]; marks: number; order: number; completionMessage?: string;
}

export interface Question {
    id: string; question: string; options: string[]; explanation: string; marks: number;
}

export type LabDefinition =
    | { profile: 'shell-target-v1'; studentImageKey: 'kali-nmap'; target: { imageKey: 'nmap-http-target'; hostname: string; displayName: string }; terminal: { promptLabel: string } }
    | { profile: 'dos-analysis-v1'; resources: { role: 'student' | 'victim' | 'legitimate-client'; imageKey: string; hostname: string; displayName: string }[]; terminal: { promptLabel: string } };

export interface Experiment {
    _id: string; title: string; slug: string; description: string; aim: string;
    objectives: string[]; theorySections: { title: string; content: string }[];
    procedureSections: string[]; category?: string; difficulty: string; estimatedTimeMinutes: number;
    lab: LabDefinition; tasks: Task[]; quiz: { questions: Question[] }; taskCount?: number;
}

export interface LabSession {
    id: string; attemptId?: string; status: string; targetIp?: string;
    targetHostname?: string; targetDisplayName?: string; terminalPrompt?: string; resources?: { role: string; hostname: string; displayName: string }[]; expiresAt: string; failureReason?: string;
}

export interface StudentDashboardStats { totalExperiments: number; experimentsAttempted: number; experimentsCompleted: number; averageScore: number; bestScore: number; }
export interface RecentAttempt { attemptId: string; experimentId: string; experimentTitle?: string; status: 'running' | 'completed' | 'expired' | 'failed'; score: number | null; startedAt: string; completedAt?: string; reportAvailable: boolean; reportId?: string; }
export interface StudentDashboardData { stats: StudentDashboardStats; recentAttempts: RecentAttempt[]; }

export interface StudentHistoryAttempt { attemptId: string; experimentId: string; experimentTitle?: string; experimentCategory?: string; status: 'running' | 'completed' | 'expired' | 'failed'; score: number | null; startedAt: string; completedAt?: string; reportAvailable: boolean; reportId?: string; }
export interface StudentHistoryData { attempts: StudentHistoryAttempt[]; }


/* ── Backend response types ────────────────────────────────────── */

export interface RuleResult {
    type: string;
    passed: boolean;
    message: string;
}

export interface TaskSubmitResponse {
    result: {
        passed: boolean;
        score: number;
        feedback: string;
        ruleResults: RuleResult[];
    };
    currentTaskIndex: number;
    score: number;
}

export interface QuizSubmitResponse {
    score: number;
    totalMarks: number;
    totalScore: number;
    reportId: string | null;
    downloadUrl: string | null;
    reportError: string | null;
    answers: {
        questionId: string;
        selectedOption: number;
        correct: boolean;
        explanation: string;
    }[];
}
