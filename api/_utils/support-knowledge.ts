/**
 * Curated product knowledge for Yali.
 *
 * This is deliberately source-controlled rather than generated from user data.
 * Keep entries short, factual, and linked in comments to the repository source
 * that owns the behavior. When a flow changes, update that source first, then
 * its matching entry here and scripts/verify/support-knowledge.ts.
 */

export type SupportRole = 'parent' | 'student' | 'tutor' | 'counselor';

type Topic = {
  id: string;
  roles: Array<SupportRole | 'all'>;
  keywords: string[];
  text: string;
};

const MAX_TOPICS = 3;
const MAX_KNOWLEDGE_CHARS = 4_500;

// Sources: docs/architecture/overview.md and each role's *Layout.tsx.
const ROLE_GUIDES: Record<SupportRole, string> = {
  parent:
    'Parent navigation: Home summarizes the family; Courses is the tutoring catalog and booking path; My Children manages linked children; College contains Roadmap and Explore; Counselling covers admissions plans; Billing shows purchases; Messages and Notifications handle communication. Parents buy services for a named child and can monitor linked children, but do not complete the child\'s learning or application work.',
  student:
    'Student navigation: My Learning contains enrolled coursework and assignments; Diagnostics and Sessions are tutoring areas; Calendar shows scheduled activity; College contains Roadmap, Explore, My list, and Applications; Messages and Notifications handle communication. Tutoring and admissions areas can be locked until the matching paid entitlement exists.',
  tutor:
    'Tutor navigation: Students and My Courses cover assigned teaching; Find Courses is where approved tutors apply to open courses; Sessions and Calendar cover delivery and availability; Earnings covers payout records; Messages and Notifications handle communication. Tutors teach and manage their own work, but do not control family purchases or admissions plans.',
  counselor:
    'Counselor navigation: Students covers assigned advisees; Sessions and Calendar cover advising; College contains Roadmap, Essays, and Explore; Earnings covers advising payout records; Messages and Notifications handle communication. Counselors advise on admissions and review essays, but do not control tutoring enrolments or family billing.',
};

const TOPICS: Topic[] = [
  {
    id: 'roles',
    roles: ['all'],
    keywords: ['role', 'roles', 'admin', 'parent', 'student', 'tutor', 'counselor', 'who can', 'responsibility'],
    // Source: docs/architecture/overview.md, "The five roles".
    text:
      'Yakal has five account roles. Students attend tutoring, do coursework, and manage college applications. Parents link to children and purchase services for them. Tutors apply to teach, set availability, run tutoring sessions, and track earnings. Counselors advise assigned students, review essays, and hold admissions sessions. Admins approve tutors and counselors, create and staff courses, manage admissions assignments, billing operations, reports, and public content. An account has one role and its dashboard reflects that role.',
  },
  {
    id: 'family-invites',
    roles: ['parent', 'student'],
    keywords: ['child', 'children', 'parent', 'family', 'invite', 'invitation', 'link', 'linked', 'accept', 'email'],
    // Sources: src/services/parentService.ts and docs/COLLABORATION.md.
    text:
      'A parent invites a child by email from My Children. The token link works for a new or existing student account, but the signed-in student must use the invited email and only a student account can accept it. Accepting creates the parent-student relationship; it is not a purchase and grants no tutoring or admissions entitlement. A parent can resend a pending invitation or withdraw one that has not been accepted. If a link is expired, cancelled, for another email, or otherwise invalid, ask the parent to send a new invitation.',
  },
  {
    id: 'paid-access',
    roles: ['parent', 'student'],
    keywords: ['access', 'locked', 'unlock', 'entitlement', 'permission', 'paid', 'payment', 'purchase', 'service', 'tutoring', 'admissions'],
    // Sources: v_student_entitlements in 20260807000200_service_entitlements.sql,
    // src/services/parentService.ts, and docs/COLLABORATION.md.
    text:
      'Service access follows payment, not an invitation or manual toggle. An active course enrolment gives the named student tutoring access; an active admissions plan gives admissions access. Those entitlements are derived by v_student_entitlements from records created during payment fulfilment. If a paid area remains locked, do not claim to inspect or unlock it: ask the user to refresh, verify they are in the intended child account, then contact Yakal with the purchase details if it persists.',
  },
  {
    id: 'tutoring-sessions',
    roles: ['parent', 'student', 'tutor'],
    keywords: ['course', 'courses', 'book', 'booking', 'session', 'sessions', 'lesson', 'schedule', 'calendar', 'availability', 'zoom', 'assignment', 'diagnostic'],
    // Sources: docs/architecture/overview.md, api/_utils/fulfil.ts, and role layouts.
    text:
      'Tutoring flow: a parent chooses a course, names the student, selects available lesson slots, and completes hosted checkout. Successful fulfilment creates the enrolment and scheduled sessions; sessions appear under Sessions and Calendar for the relevant student or tutor. Zoom details are attached server-side when configured. Students find enrolled work under My Learning and may see tutoring Diagnostics. Tutors manage availability, apply through Find Courses, and deliver only their assigned courses. Yali cannot book, cancel, reschedule, join, or mark attendance; for a paid slot that is missing or conflicts, contact Yakal.',
  },
  {
    id: 'admissions',
    roles: ['parent', 'student', 'counselor'],
    keywords: ['admissions', 'counselling', 'counseling', 'college', 'application', 'roadmap', 'essay', 'recommendation', 'deadline', 'advising', 'tier', 'plan'],
    // Sources: docs/architecture/overview.md, CounselorLayout.tsx,
    // ParentAdmissions.tsx, and the admissions services/migrations.
    text:
      'Admissions flow: a parent purchases an admissions tier for a named student. The paid plan enables admissions tools and advising; an assigned counselor supports the student. Students use Roadmap, Explore, My list, and Applications to track colleges, requirements, tasks, deadlines, essays, recommendations, and documents. Parents use Counselling plus the College pages to follow the plan. Counselors use Students, Roadmap, Essays, Sessions, and Calendar to advise and review. Yali can explain navigation and workflow, but cannot recommend an admission decision as certain, edit an application, approve an essay, assign a counselor, or book advising.',
  },
  {
    id: 'staff-approval',
    roles: ['tutor', 'counselor'],
    keywords: ['approve', 'approval', 'applicant', 'pending', 'rejected', 'resume', 'apply', 'application', 'assigned', 'staff'],
    // Sources: ProtectedRoute in src/app/Router.tsx, adminService.ts, and
    // docs/architecture/overview.md.
    text:
      'Tutor and counselor accounts require admin approval after onboarding. Pending or rejected applicants are kept on the approval-status screen rather than given practitioner tools. Admins review applicants and may provide a rejection reason. Once approved, tutors can apply for open courses, and admins choose one tutor when staffing a course; counselors work with students assigned through admissions operations. Yali cannot approve an account, change an application, assign work, or predict when review will finish. Direct status-specific questions to Yakal support or the displayed rejection guidance.',
  },
  {
    id: 'communication',
    roles: ['all'],
    keywords: ['message', 'messages', 'chat', 'conversation', 'notification', 'notifications', 'alert', 'unread', 'report', 'flag'],
    // Sources: docs/architecture/overview.md and integrations.md, messaging
    // components/services, and notification templates.
    text:
      'Messages are for conversations among people connected through Yakal; parents can view their children\'s conversations as a safeguarding feature. Messages, conversations, and notifications update in realtime when the local connection is healthy. Notifications link to events such as bookings, assignments, approvals, messages, parent links, applications, payments, payouts, and session changes. Use each role\'s Messages or Notifications page. Yali cannot read, send, delete, report, or mark messages and notifications for the user.',
  },
  {
    id: 'google-documents',
    roles: ['student', 'parent', 'tutor', 'counselor'],
    keywords: ['document', 'documents', 'upload', 'file', 'drive', 'google', 'classroom', 'classwork', 'assignment', 'submission'],
    // Source: docs/architecture/integrations.md and drive/classroom handlers.
    text:
      'Google boundaries: Yakal uses one server-side Yakal Google account for admissions documents in Drive and for reading Classroom classwork. Students and tutors do not sign in to Google for these flows. Course access is checked by Yakal before classwork is read; admins use a separate browser Google sign-in only when linking or fetching class details. Files and classwork remain governed by their Yakal pages and permissions. Yali cannot open, inspect, upload, download, delete, share, or verify a private document or assignment.',
  },
  {
    id: 'billing',
    roles: ['parent', 'tutor', 'counselor'],
    keywords: ['billing', 'stripe', 'checkout', 'invoice', 'payment', 'paid', 'card', 'refund', 'receipt', 'charge', 'payout', 'earnings', 'bank'],
    // Sources: docs/architecture/integrations.md, api/stripe-webhook.ts,
    // api/_utils/fulfil.ts, and Stripe Connect handlers.
    text:
      'Billing uses hosted Stripe Checkout; card details are not handled by the Yakal browser. The server reads authoritative prices and creates checkout. The signed Stripe webhook, not the return redirect, is the authority that marks invoices paid and fulfils enrolments, sessions, or admissions plans. Tutors and counselors see earnings records; tutor payouts may use Stripe Connect or be recorded manually by an admin. Yali cannot see charges, cards, invoices, webhook status, refunds, or payout accounts and cannot change or retry them. For account-specific billing, duplicate charges, refunds, missing paid access, or payout issues, contact Yakal support.',
  },
  {
    id: 'support-boundaries',
    roles: ['all'],
    keywords: ['support', 'help', 'contact', 'account', 'password', 'emergency', 'urgent', 'medical', 'legal', 'refund', 'problem', 'broken'],
    // Source: api/support-chat.ts system safety guidance.
    text:
      'Yali provides navigation, tutoring/admissions workflow guidance, and non-urgent platform help only. It has no access to private rows or live account state and cannot change accounts, bookings, payments, files, messages, or assignments. Never ask for a password, full payment-card details, government ID, or other sensitive information. Account access, billing, fulfilment, and unexplained data problems should go to Yakal support. Yali is not medical, legal, financial, crisis, or emergency support; immediate danger belongs with local emergency services or a trusted nearby person.',
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreTopic(topic: Topic, normalizedQuestion: string): number {
  const padded = ` ${normalizedQuestion} `;
  return topic.keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return score;
    return padded.includes(` ${normalizedKeyword} `)
      ? score + (normalizedKeyword.includes(' ') ? 3 : 1)
      : score;
  }, 0);
}

/** Select one role guide plus at most three question-relevant topics. */
export function selectSupportKnowledge(role: SupportRole, question: string): {
  topicIds: string[];
  text: string;
} {
  const normalizedQuestion = normalize(question).slice(0, 1_500);
  const ranked = TOPICS
    .filter((topic) => topic.roles.includes('all') || topic.roles.includes(role))
    .map((topic, index) => ({ topic, index, score: scoreTopic(topic, normalizedQuestion) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_TOPICS);

  const topicIds = ranked.map(({ topic }) => topic.id);
  const sections = [
    `ROLE GUIDE\n${ROLE_GUIDES[role]}`,
    ...ranked.map(({ topic }) => `TOPIC: ${topic.id}\n${topic.text}`),
  ];

  return {
    topicIds,
    text: sections.join('\n\n').slice(0, MAX_KNOWLEDGE_CHARS),
  };
}
