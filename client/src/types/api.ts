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

export interface Experiment {
    _id: string; title: string; slug: string; description: string; aim: string;
    objectives: string[]; theorySections: { title: string; content: string }[];
    procedureSections: string[]; difficulty: string; estimatedTimeMinutes: number;
    tasks: Task[]; quiz: { questions: Question[] }; taskCount?: number;
}

export interface LabSession {
    id: string; attemptId?: string; status: string; targetIp?: string;
    targetHostname?: string; expiresAt: string; failureReason?: string;
}

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
