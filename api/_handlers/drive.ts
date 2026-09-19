import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'node:stream';
// The Drive client alone, not the whole googleapis package.
//
// googleapis is 204 MB unpacked because it carries every Google API there is.
// Vercel allows 250 MB unzipped per function, and this one shares its bundle
// with the Classroom and token handlers, so the three of them together failed
// to invoke at all: FUNCTION_INVOCATION_FAILED, including for the token
// exchange, which needs no Google client whatsoever. This package is 2.4 MB.
import { drive_v3, auth as googleAuth } from '@googleapis/drive';
import { getServiceClient } from '../_utils/supabase.js';
import {
  assignedCounselorEmail,
  callerOrNull,
  studentAccess,
  type StudentAccess,
} from '../_utils/access.js';

/**
 * Student documents, stored in Drive under an account Yakal controls.
 *
 * Why server side rather than the browser Drive picker it replaces:
 *
 *  - Browser OAuth tokens are per user. When a counselor opened a student's
 *    tracker, their browser held no token for that student's Drive, so the
 *    documents were invisible to the one person being paid to read them.
 *  - The implicit token flow issues no refresh token, so the session died
 *    roughly hourly and the picker asked for consent again.
 *  - Most US high schoolers are on school-managed Google accounts where admins
 *    routinely block sharing outside the domain. Asking a student to share a
 *    transcript with a counselor fails unpredictably and cannot be debugged
 *    from our side.
 *
 * Either way the server holds the credential, so students never authenticate to
 * Google at all and counselor access is something we grant rather than
 * something a sixteen year old has to configure correctly.
 *
 * Environment, whichever pair you have. See getContext below.
 *   GOOGLE_OAUTH_REFRESH_TOKEN    one Yakal operations account, works on a free
 *                                 personal account, no Workspace required
 *   GOOGLE_SERVICE_ACCOUNT_JSON   service account key, needs Workspace
 *   GOOGLE_SHARED_DRIVE_ID        required with a service account, optional with
 *                                 a refresh token
 */

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DOC_MIME = 'application/vnd.google-apps.document';

/** Subfolders created under each student, so the drive stays navigable by hand. */
const SUBFOLDERS = ['Transcripts', 'Essays', 'Test scores', 'Other'] as const;
type Subfolder = (typeof SUBFOLDERS)[number];

type Drive = drive_v3.Drive;

/**
 * Where files live, and who owns them.
 *
 * Two modes, because a shared drive needs Google Workspace and there is no
 * reason to block development on a purchase:
 *
 *   oauth           A refresh token for one Yakal operations account. Files are
 *                   owned by that account and sit in its My Drive. Works on a
 *                   free personal account.
 *   service_account A key plus a shared drive. Service accounts have no storage
 *                   quota and cannot own files, so the shared drive is not
 *                   optional here: without it every write fails with
 *                   storageQuotaExceeded.
 *
 * Whichever is configured wins, so moving to Workspace later is an environment
 * change rather than a code change.
 */
interface Ctx {
  drive: Drive;
  /** Set only when a shared drive is in use. Null means ordinary My Drive. */
  sharedDriveId: string | null;
  mode: 'oauth' | 'service_account';
}

function getContext(): Ctx {
  const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID || null;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (refreshToken) {
    const auth = new googleAuth.OAuth2(
      process.env.VITE_GCP_CLIENT_ID,
      process.env.GCP_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: refreshToken });
    return { drive: new drive_v3.Drive({ auth }), sharedDriveId, mode: 'oauth' };
  }

  if (serviceKey) {
    if (!sharedDriveId) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_JSON is set but GOOGLE_SHARED_DRIVE_ID is not. ' +
          'Service accounts cannot own files, so they need a shared drive.'
      );
    }
    const creds = JSON.parse(serviceKey);
    const auth = new googleAuth.JWT({
      email: creds.client_email,
      // Vercel env vars collapse real newlines, so restore them before signing.
      key: String(creds.private_key).replace(/\\n/g, '\n'),
      scopes: SCOPES,
    });
    return {
      drive: new drive_v3.Drive({ auth }),
      sharedDriveId,
      mode: 'service_account',
    };
  }

  throw new Error(
    'Document storage is not configured. Set GOOGLE_OAUTH_REFRESH_TOKEN, or ' +
      'GOOGLE_SERVICE_ACCOUNT_JSON together with GOOGLE_SHARED_DRIVE_ID.'
  );
}

/**
 * Listing options. corpora and driveId must only be sent when a shared drive is
 * actually in play; sending them against My Drive returns nothing at all.
 */
function scope(ctx: Ctx) {
  return ctx.sharedDriveId
    ? {
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'drive' as const,
        driveId: ctx.sharedDriveId,
      }
    : { supportsAllDrives: true, includeItemsFromAllDrives: true };
}

/** Top of the tree: the shared drive itself, or a folder in My Drive. */
async function rootFolder(ctx: Ctx) {
  if (ctx.sharedDriveId) return ctx.sharedDriveId;
  return ensureFolder(ctx, 'root', 'Yakal Students');
}

async function findChild(ctx: Ctx, parentId: string, name: string) {
  const escaped = name.replace(/'/g, "\\'");
  const res = await ctx.drive.files.list({
    q: `name = '${escaped}' and '${parentId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    ...scope(ctx),
  });
  return res.data.files?.[0] ?? null;
}

async function ensureFolder(ctx: Ctx, parentId: string, name: string) {
  const existing = await findChild(ctx, parentId, name);
  if (existing?.id) return existing.id;

  const created = await ctx.drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id!;
}

/**
 * Folder for one student, created on first use.
 *
 * Keyed by student id rather than name: names are not unique and change, ids
 * do not. The display name is only there so the drive is readable by a human.
 *
 * Matched on the END of the name, and on a tag. It used to match any folder
 * whose name merely contained the short id, and the display name is something
 * a user types: a student renamed "Ana (1a2b3c4d)" produced a folder that
 * matched another student's id, and that student's transcript could land in a
 * folder the first one could write to. The server always appends the owner's
 * own short id last, so the end of the name cannot be forged by a name, and
 * appProperties can only be written by this app's credential.
 */
async function ensureStudentFolder(
  ctx: Ctx,
  studentId: string,
  displayName: string,
  /** Granted access to their own folder, so "Open in Drive" just works. */
  studentEmail?: string | null
) {
  const root = await ensureFolder(ctx, await rootFolder(ctx), 'Students');
  const shortId = studentId.slice(0, 8);
  const suffix = `(${shortId})`;

  const res = await ctx.drive.files.list({
    q: `'${root}' in parents and mimeType = '${FOLDER_MIME}' and name contains '${shortId}' and trashed = false`,
    fields: 'files(id, name, appProperties)',
    ...scope(ctx),
  });
  const candidates = res.data.files ?? [];
  const found =
    candidates.find((f) => f.appProperties?.yakalStudentId === studentId) ??
    candidates.find((f) => (f.name ?? '').endsWith(suffix));

  let id = found?.id ?? undefined;
  if (!id) {
    const created = await ctx.drive.files.create({
      requestBody: {
        name: `${displayName} ${suffix}`,
        mimeType: FOLDER_MIME,
        parents: [root],
        appProperties: { yakalStudentId: studentId },
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    id = created.data.id!;
    await Promise.all(SUBFOLDERS.map((sub) => ensureFolder(ctx, id!, sub)));
  } else if (found?.appProperties?.yakalStudentId !== studentId) {
    // A folder made before tagging existed: tag it on the way through, so the
    // next lookup does not depend on its name at all.
    await ctx.drive.files.update({
      fileId: id,
      requestBody: { appProperties: { yakalStudentId: studentId } },
      supportsAllDrives: true,
    });
  }

  // Every call, not just on creation: folders made before this existed still
  // need granting, and a student who changes their email needs the new one.
  // Permissions inherit downward, so one grant covers every subfolder and file.
  if (studentEmail) await ensureAccess(ctx, id, studentEmail, 'writer');

  return id;
}

/**
 * Whether a Drive file is in this student's folder.
 *
 * Every action that names a file by id checks this, because the id arrives
 * from the browser, and so does an essay's drive_url, which a student can
 * edit. Up the parents until a folder tagged for the student, or named with
 * their short id at the end, the way ensureStudentFolder names it. Anything
 * the credential cannot see, or that lives anywhere else, is not theirs.
 */
async function fileBelongsTo(ctx: Ctx, fileId: string, studentId: string): Promise<boolean> {
  const suffix = `(${studentId.slice(0, 8)})`;
  let id: string | undefined = fileId;
  try {
    for (let depth = 0; id && depth < 4; depth++) {
      const f: { data: drive_v3.Schema$File } = await ctx.drive.files.get({
        fileId: id,
        fields: 'id, name, mimeType, parents, appProperties',
        supportsAllDrives: true,
      });
      if (f.data.appProperties?.yakalStudentId === studentId) return true;
      if (depth > 0 && f.data.mimeType === FOLDER_MIME && (f.data.name ?? '').endsWith(suffix)) {
        return true;
      }
      id = f.data.parents?.[0] ?? undefined;
    }
  } catch {
    return false;
  }
  return false;
}

/** Weakest to strongest, so an existing grant can be compared against a wanted one. */
const ROLE_RANK: Record<string, number> = {
  reader: 1,
  commenter: 2,
  writer: 3,
  fileOrganizer: 4,
  organizer: 5,
  owner: 6,
};

/**
 * Idempotent share that also upgrades.
 *
 * Checking only whether the address is present was not enough: a student who
 * already held reader, whether inherited from the folder or granted earlier,
 * kept it forever and Docs offered them "Request edit access" on their own
 * essay. Presence is not the question, sufficiency is.
 *
 * Returns whether the caller ended up with at least the role asked for, so a
 * failure to share can be reported rather than disappearing into a log.
 */
async function ensureAccess(
  ctx: Ctx,
  fileId: string,
  email: string,
  role: 'reader' | 'commenter' | 'writer'
): Promise<boolean> {
  try {
    const existing = await ctx.drive.permissions.list({
      fileId,
      fields: 'permissions(id, emailAddress, role)',
      supportsAllDrives: true,
    });

    const mine = existing.data.permissions?.find(
      (p) => p.emailAddress?.toLowerCase() === email.toLowerCase()
    );

    if (mine) {
      const have = ROLE_RANK[mine.role ?? ''] ?? 0;
      if (have >= ROLE_RANK[role]) return true;

      await ctx.drive.permissions.update({
        fileId,
        permissionId: mine.id!,
        requestBody: { role },
        supportsAllDrives: true,
      });
      return true;
    }

    await grant(ctx, fileId, email, role);
    return true;
  } catch (err: any) {
    console.warn('[drive] could not share', fileId, 'with', email, err?.message);
    return false;
  }
}

/** Give someone access by email. Used to hand a student their own folder. */
async function grant(
  ctx: Ctx,
  fileId: string,
  email: string,
  role: 'reader' | 'commenter' | 'writer'
) {
  await ctx.drive.permissions.create({
    fileId,
    requestBody: { type: 'user', role, emailAddress: email },
    // The student is told about the document in the app, so skip Google's mail.
    sendNotificationEmail: false,
    supportsAllDrives: true,
  });
}


/**
 * The exported Doc, ready to put on a page.
 *
 * Google's HTML export is machine generated and predictable: a <head> with a
 * charset, then a <body class="doc-content"> of paragraphs carrying inline
 * styles. It is still stripped rather than trusted, because "predictable"
 * describes today's output and this ends up inside our origin.
 *
 * Why export at all, rather than an iframe. Docs has no embeddable editor:
 * smart canvas is a feature of the Docs editor, not an SDK, and the only
 * framable view is /preview, which authenticates the *viewer*. Our whole Drive
 * design exists so that students never sign in to Google and counselors are
 * granted access by us rather than by a sixteen-year-old, so /preview would
 * show "you need access" to exactly the people this page is for. Exporting
 * server-side works for everyone, under our access rules, and lets the page
 * carry the prompt and the comments beside the text.
 *
 * The cost is that this is a snapshot. Editing still happens in the real Doc,
 * which is why every view of it carries the time it was taken and a way back.
 */
/**
 * Properties Google writes that describe a sheet of US Letter rather than
 * anything the writer chose.
 *
 * Colour is the one that matters. Left in, every span carries color:#000000
 * and a student's essay renders as black on black in the dark theme. Margins
 * and line height are next: margin:0 on the element beats any stylesheet we
 * write, so paragraphs sit flush against each other. Weight, italics,
 * underline, alignment, size and vertical alignment are real choices and stay.
 */
const DROPPED_STYLES = new Set([
  'color',
  'background',
  'background-color',
  'line-height',
  'font-family',
  'max-width',
  'width',
  'height',
  'min-height',
  'orphans',
  'widows',
]);

const DROPPED_PREFIXES = ['margin', 'padding'];

/**
 * Alignment is two different things wearing one property name.
 *
 * Docs writes text-align:left onto every paragraph whether or not anybody
 * chose it, so keeping all of it would mean the page could never set its own
 * measure. Left and start are the default and come out; centre, right and
 * justify were somebody pressing a button and stay.
 */
const DEFAULT_ALIGNMENTS = new Set(['left', 'start']);

/**
 * Rewrite one inline style attribute, keeping the declarations worth keeping.
 *
 * Declaration by declaration rather than by one regex over the whole document.
 * The regex version anchored on `^|;` and so never removed the FIRST property
 * in an attribute, which is exactly where Google puts color, so every span
 * kept its black and the bug only showed up in the dark theme.
 */
function filterInlineStyle(style: string): string {
  return style
    .split(';')
    .map((d) => d.trim())
    .filter((d) => {
      if (!d) return false;
      const prop = d.slice(0, d.indexOf(':')).trim().toLowerCase();
      if (!prop) return false;
      if (DROPPED_STYLES.has(prop)) return false;
      if (prop === 'text-align') {
        return !DEFAULT_ALIGNMENTS.has(d.slice(d.indexOf(':') + 1).trim().toLowerCase());
      }
      return !DROPPED_PREFIXES.some((p) => prop === p || prop.startsWith(`${p}-`));
    })
    .join(';');
}

export function sanitiseExportedHtml(html: string): string {
  // Only the body: the export's <head> carries nothing we want and its <style>
  // block would leak Google's classes into the page.
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;

  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    // on* handlers, quoted or bare.
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'")
    .replace(/\sstyle\s*=\s*"([^"]*)"/gi, (_m, style: string) => {
      const kept = filterInlineStyle(style);
      return kept ? ` style="${kept}"` : '';
    })
    .replace(/\sstyle\s*=\s*'([^']*)'/gi, (_m, style: string) => {
      const kept = filterInlineStyle(style);
      return kept ? ` style="${kept}"` : '';
    });
}

/**
 * Comments read as a thread rather than as a flat list.
 *
 * quotedFileContent is the passage the comment hangs off, and it is the only
 * usable link back to the text: `anchor` is an opaque Docs region id that
 * means nothing outside the editor. So the pane shows the quote, which is what
 * a student needs to know which sentence is being talked about.
 */
function threadFields(): string {
  return [
    'comments(id,createdTime,modifiedTime,resolved,author(displayName,photoLink),',
    'content,quotedFileContent(value),',
    'replies(id,createdTime,author(displayName,photoLink),content,action))',
  ].join('');
}

/**
 * Whose words these are.
 *
 * Every write goes to Google as the one Yakal account that holds the
 * credential, so a counselor's comment would appear in the Doc authored by
 * "Yakal" and a student would have no idea who wrote it. Naming the author in
 * the text is the only way to get that right from a shared credential, and it
 * is stripped again on the way back out so our own pane shows a proper author.
 */
const AUTHOR_PREFIX = /^([^:\n]{1,60}):\s/;

function withAuthor(content: string, authorName?: string | null): string {
  const name = (authorName || '').trim();
  return name ? `${name}: ${content}` : content;
}

function splitAuthor(content: string | null | undefined, fallback: string) {
  const text = content ?? '';
  const m = text.match(AUTHOR_PREFIX);
  return m
    ? { author: m[1], text: text.slice(m[0].length) }
    : { author: fallback, text };
}

/**
 * Who may do each thing, from the screens that actually call it.
 *
 * A parent reads (the tracker lists their child's documents and counts essay
 * words); only the student uploads; a counsellor reviews and comments but
 * flags rather than deletes a student's file.
 */
const ALLOWED: Record<string, StudentAccess[]> = {
  list: ['self', 'parent', 'counselor', 'admin'],
  upload: ['self'],
  createDoc: ['self', 'counselor'],
  review: ['counselor', 'admin'],
  doc: ['self', 'counselor', 'admin'],
  comments: ['self', 'counselor', 'admin'],
  comment: ['self', 'counselor'],
  reply: ['self', 'counselor'],
  wordCount: ['self', 'parent', 'counselor', 'admin'],
  delete: ['self', 'admin'],
  repairAccess: ['admin'],
};

/** Actions that name an essay rather than a student. */
const BY_ESSAY = new Set(['doc', 'comments', 'comment', 'reply']);

const fileIdFromUrl = (url: string | null | undefined) =>
  url?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;

/**
 * Every action here used to run for anybody: no sign-in, a studentId and an
 * email taken from the body, and Yakal's own Google credential doing the rest.
 * So anyone could list, read, download, upload to or delete any student's
 * transcripts and essays, and share them with any address. Now the caller comes
 * from their token, the student from the request or the essay, what they may do
 * from studentAccess, every file id is checked against the student's folder,
 * and every name and email comes from the database.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.body ?? {};
  if (!ALLOWED[action]) return res.status(400).json({ error: `Unknown action: ${action}` });

  // Before Google is touched at all.
  const caller = await callerOrNull(req);
  if (!caller) return res.status(401).json({ error: 'Sign in to open documents.' });

  try {
    const db = getServiceClient();

    let studentId: string | null = req.body.studentId ?? null;
    let essayFileId: string | null = null;
    if (BY_ESSAY.has(action)) {
      const { data: essay } = await db
        .from('essays')
        .select('student_id, drive_url')
        .eq('id', String(req.body.essayId ?? ''))
        .maybeSingle();
      if (!essay) return res.status(404).json({ error: 'That essay no longer exists.' });
      studentId = essay.student_id;
      essayFileId = fileIdFromUrl(essay.drive_url);
      if (!essayFileId) return res.status(409).json({ error: 'This essay has no Google Doc yet.' });
    }
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const access = await studentAccess(db, caller.id, studentId);
    if (!access || !ALLOWED[action].includes(access)) {
      return res.status(403).json({ error: 'You do not have access to these documents.' });
    }

    const [{ data: student }, { data: me }] = await Promise.all([
      db.from('profiles').select('full_name, email').eq('id', studentId).maybeSingle(),
      db.from('profiles').select('full_name').eq('id', caller.id).maybeSingle(),
    ]);
    const studentName = student?.full_name || 'Student';
    const studentEmail = student?.email ?? null;
    const callerName = me?.full_name ?? null;

    const ctx = getContext();
    const owns = (fileId: string) => fileBelongsTo(ctx, fileId, studentId!);
    const notTheirs = () =>
      res.status(403).json({ error: 'That file is not in this student\'s documents.' });

    switch (action) {
      /** List everything already stored for a student. */
      case 'list': {
        const folderId = await ensureStudentFolder(ctx, studentId, studentName, studentEmail);

        // Anything dropped at the top level rather than into a subfolder.
        const files = await ctx.drive.files.list({
          q: `'${folderId}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`,
          fields: 'files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size, appProperties)',
          orderBy: 'modifiedTime desc',
          ...scope(ctx),
        });

        // Include the contents of each subfolder, so the UI can group them.
        const subs = await Promise.all(
          SUBFOLDERS.map(async (name) => {
            const sub = await findChild(ctx, folderId, name);
            if (!sub?.id) return { name, files: [] };
            const inner = await ctx.drive.files.list({
              q: `'${sub.id}' in parents and trashed = false`,
              fields: 'files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size, appProperties)',
              orderBy: 'modifiedTime desc',
              ...scope(ctx),
            });
            return { name, files: inner.data.files ?? [] };
          })
        );

        return res.status(200).json({
          folderId,
          folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
          loose: files.data.files ?? [],
          sections: subs,
        });
      }

      /**
       * Upload a document. The browser sends base64 because Vercel's default
       * body parser gives us JSON, and transcripts are small enough that
       * streaming would be a premature complication.
       */
      case 'upload': {
        const { section, slot, filename, mimeType, dataBase64 } = req.body;
        if (!filename || !dataBase64) {
          return res.status(400).json({ error: 'filename and dataBase64 are required' });
        }

        const folderId = await ensureStudentFolder(ctx, studentId, studentName, studentEmail);
        const target = SUBFOLDERS.includes(section as Subfolder)
          ? await ensureFolder(ctx, folderId, section)
          : folderId;

        const created = await ctx.drive.files.create({
          requestBody: {
            name: filename,
            parents: [target],
            // Which named slot this fills, kept on the file rather than inferred
            // from its name so a student renaming it in Drive breaks nothing.
            appProperties: { yakalStudentId: studentId, ...(slot ? { slot } : {}) },
          },
          media: {
            mimeType: mimeType || 'application/octet-stream',
            // googleapis pipes this into a multipart request, so it has to be a
            // stream. Handing it a Buffer fails with "part.body.pipe is not a
            // function", which does not obviously point at the cause.
            body: Readable.from(Buffer.from(dataBase64, 'base64')),
          },
          fields: 'id, name, mimeType, webViewLink, modifiedTime, size, appProperties',
          supportsAllDrives: true,
        });

        return res.status(200).json({ file: created.data });
      }

      /**
       * Create an essay as a Google Doc in the student's folder and give both
       * the student and their counselor access. Two people editing and
       * commenting on one document is the entire essay-review product; doing it
       * with uploaded files instead would mean emailing versions around.
       */
      case 'createDoc': {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: 'title is required' });

        // The plan's counsellor, looked up. Taking this from the request let a
        // caller share a student's essay with any address they liked.
        const counselorEmail = await assignedCounselorEmail(db, studentId);
        const folderId = await ensureStudentFolder(ctx, studentId, studentName, studentEmail);
        const essays = await ensureFolder(ctx, folderId, 'Essays');

        const doc = await ctx.drive.files.create({
          requestBody: {
            name: title,
            mimeType: DOC_MIME,
            parents: [essays],
            appProperties: { yakalStudentId: studentId },
          },
          fields: 'id, name, webViewLink',
          supportsAllDrives: true,
        });

        const shared = studentEmail
          ? await ensureAccess(ctx, doc.data.id!, studentEmail, 'writer')
          : true;
        if (counselorEmail) await ensureAccess(ctx, doc.data.id!, counselorEmail, 'commenter');

        // Surfaced, not swallowed: a doc the student cannot edit is worse than
        // no doc, because it looks like it worked.
        return res.status(200).json({
          file: doc.data,
          shared,
          sharedWith: studentEmail ?? null,
        });
      }

      /**
       * A counselor's verdict on an uploaded file.
       *
       * Review here is not about tracking edits, since a transcript is never
       * edited. It is about fitness for purpose: is this the official document
       * rather than a portal screenshot, is it legible, is it current, does its
       * GPA match the profile. Catching a blurry photo in October beats a
       * college rejecting it in December.
       *
       * Stored in appProperties so the verdict travels with the file and needs
       * no second source of truth to stay in sync.
       */
      case 'review': {
        const { fileId, verdict, note } = req.body;
        if (!fileId || !['verified', 'needs_attention', 'pending'].includes(verdict)) {
          return res
            .status(400)
            .json({ error: 'fileId and a verdict of verified, needs_attention or pending are required' });
        }
        if (!(await owns(fileId))) return notTheirs();

        const updated = await ctx.drive.files.update({
          fileId,
          requestBody: {
            appProperties: {
              review: verdict,
              reviewedBy: caller.id,
              reviewedAt: new Date().toISOString(),
              // appProperties caps each value, and a review note is a nudge
              // rather than an essay.
              reviewNote: String(note ?? '').slice(0, 300),
            },
          },
          fields: 'id, name, appProperties',
          supportsAllDrives: true,
        });

        return res.status(200).json({ file: updated.data });
      }


      /**
       * One essay Doc, with its text, for the workspace page.
       *
       * Everything a page needs in one request: the metadata, the rendered
       * body, and the word count, because three round trips to show one
       * document is three chances to render half a screen.
       */
      case 'doc': {
        const fileId = essayFileId!;
        if (!(await owns(fileId))) return notTheirs();

        const meta = await ctx.drive.files.get({
          fileId,
          fields: 'id,name,modifiedTime,webViewLink,capabilities(canComment,canEdit)',
          supportsAllDrives: true,
        });

        const [htmlOut, textOut] = await Promise.all([
          ctx.drive.files.export({ fileId, mimeType: 'text/html' }, { responseType: 'text' }),
          ctx.drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' }),
        ]);

        const text = String(textOut.data ?? '');
        return res.status(200).json({
          file: meta.data,
          html: sanitiseExportedHtml(String(htmlOut.data ?? '')),
          words: text.trim() ? text.trim().split(/\s+/).length : 0,
          fetchedAt: new Date().toISOString(),
        });
      }

      /** Every comment thread on a Doc, newest last within each thread. */
      case 'comments': {
        const fileId = essayFileId!;
        if (!(await owns(fileId))) return notTheirs();

        const out = await ctx.drive.comments.list({
          fileId,
          fields: threadFields(),
          includeDeleted: false,
          pageSize: 100,
        });

        const threads = (out.data.comments ?? []).map((c) => {
          const owner = c.author?.displayName ?? 'Someone';
          const head = splitAuthor(c.content, owner);
          return {
            id: c.id,
            createdTime: c.createdTime,
            modifiedTime: c.modifiedTime,
            resolved: !!c.resolved,
            quoted: c.quotedFileContent?.value ?? null,
            author: head.author,
            authorPhoto: c.author?.photoLink ?? null,
            content: head.text,
            replies: (c.replies ?? [])
              // A resolve is recorded as a reply with no words in it. It is an
              // event, not something anybody said, so it does not belong in a
              // conversation.
              .filter((r) => (r.content ?? '').trim() || !r.action)
              .map((r) => {
                const rep = splitAuthor(r.content, r.author?.displayName ?? 'Someone');
                return {
                  id: r.id,
                  createdTime: r.createdTime,
                  author: rep.author,
                  authorPhoto: r.author?.photoLink ?? null,
                  content: rep.text,
                  action: r.action ?? null,
                };
              }),
          };
        });

        return res.status(200).json({ threads });
      }

      /** A new comment on the document as a whole. */
      case 'comment': {
        const fileId = essayFileId!;
        const { content } = req.body;
        if (!String(content || '').trim()) {
          return res.status(400).json({ error: 'content is required' });
        }
        if (!(await owns(fileId))) return notTheirs();

        const made = await ctx.drive.comments.create({
          fileId,
          fields: 'id',
          requestBody: { content: withAuthor(String(content).trim(), callerName) },
        });
        return res.status(200).json({ id: made.data.id });
      }

      /**
       * A reply, and optionally resolving or reopening the thread.
       *
       * Drive has no separate resolve call: resolving is a reply carrying
       * action 'resolve', which is also why the list above drops empty ones.
       */
      case 'reply': {
        const fileId = essayFileId!;
        const { commentId, content, resolve, reopen } = req.body;
        if (!commentId) {
          return res.status(400).json({ error: 'commentId is required' });
        }
        if (!(await owns(fileId))) return notTheirs();
        const words = String(content || '').trim();
        if (!words && !resolve && !reopen) {
          return res.status(400).json({ error: 'nothing to say' });
        }

        const made = await ctx.drive.replies.create({
          fileId,
          commentId,
          fields: 'id',
          requestBody: {
            content: words ? withAuthor(words, callerName) : undefined,
            action: resolve ? 'resolve' : reopen ? 'reopen' : undefined,
          },
        });
        return res.status(200).json({ id: made.data.id });
      }

      /**
       * Live word count for an essay Doc.
       *
       * Exported as plain text through the Drive API rather than read through
       * the Docs API, so there is no second Google API to enable and the
       * drive.file scope already covers it: we only ever created these files.
       *
       * Counted server side because a word limit is enforced by the college,
       * and "638 of 650" is the single most useful thing to show a student
       * mid-draft.
       */
      case 'wordCount': {
        const { fileIds } = req.body;
        if (!Array.isArray(fileIds) || fileIds.length === 0) {
          return res.status(400).json({ error: 'fileIds must be a non-empty array' });
        }

        const counts = await Promise.all(
          fileIds.slice(0, 25).map(async (fileId: string) => {
            // Somebody else's essay has no count, rather than a count that
            // proves it exists.
            if (!(await owns(fileId))) return { fileId, words: null };
            try {
              const out = await ctx.drive.files.export(
                { fileId, mimeType: 'text/plain' },
                { responseType: 'text' }
              );
              const text = String(out.data ?? '');
              // Collapse whitespace first: an empty Doc exports as a newline,
              // which a naive split would count as one word.
              const words = text.trim() ? text.trim().split(/\s+/).length : 0;
              return { fileId, words };
            } catch {
              // A file that is not a Doc, or was deleted, simply has no count.
              return { fileId, words: null };
            }
          })
        );

        return res.status(200).json({ counts });
      }

      /**
       * Re-apply access to everything already in a student's folder.
       *
       * Needed because grants made before ensureAccess could upgrade a role are
       * stuck at whatever they were first given. Recreating the documents would
       * lose their contents, so the permissions are repaired in place.
       */
      case 'repairAccess': {
        if (!studentEmail) {
          return res.status(400).json({ error: 'This student has no email to share with.' });
        }

        const folderId = await ensureStudentFolder(ctx, studentId, studentName);
        const targets = [folderId];

        for (const sub of SUBFOLDERS) {
          const f = await findChild(ctx, folderId, sub);
          if (!f?.id) continue;
          targets.push(f.id);
          const inner = await ctx.drive.files.list({
            q: `'${f.id}' in parents and trashed = false`,
            fields: 'files(id)',
            ...scope(ctx),
          });
          (inner.data.files ?? []).forEach((x) => x.id && targets.push(x.id));
        }

        const results = await Promise.all(
          targets.map((id) => ensureAccess(ctx, id, studentEmail, 'writer'))
        );

        return res.status(200).json({
          repaired: results.filter(Boolean).length,
          total: targets.length,
        });
      }

      case 'delete': {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ error: 'fileId is required' });
        if (!(await owns(fileId))) return notTheirs();
        // Trash rather than destroy: a student deleting their only transcript
        // by accident should be recoverable.
        await ctx.drive.files.update({
          fileId,
          requestBody: { trashed: true },
          supportsAllDrives: true,
        });
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error('[drive]', action, err?.message || err);
    return res.status(500).json({ error: err?.message || 'Drive request failed' });
  }
}
