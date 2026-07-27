import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

/**
 * Student documents, stored in Yakal's own Shared Drive.
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
 * With a service account writing into a Shared Drive, students never
 * authenticate to Google at all, and counselor access is a property of the
 * drive rather than something a sixteen year old has to configure correctly.
 *
 * Required environment:
 *   GOOGLE_SERVICE_ACCOUNT_JSON   full service account key, as JSON
 *   GOOGLE_SHARED_DRIVE_ID        the Shared Drive the service account belongs to
 */

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DOC_MIME = 'application/vnd.google-apps.document';

/** Subfolders created under each student, so the drive stays navigable by hand. */
const SUBFOLDERS = ['Transcripts', 'Essays', 'Test scores', 'Other'] as const;
type Subfolder = (typeof SUBFOLDERS)[number];

function driveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');

  const creds = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    // Vercel env vars collapse real newlines, so restore them before signing.
    key: String(creds.private_key).replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
  return google.drive({ version: 'v3', auth });
}

const SHARED_DRIVE_ID = () => {
  const id = process.env.GOOGLE_SHARED_DRIVE_ID;
  if (!id) throw new Error('GOOGLE_SHARED_DRIVE_ID is not set');
  return id;
};

/** Shared Drive calls all need these flags or they silently target My Drive. */
const SHARED = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  driveId: undefined as string | undefined,
};

type Drive = ReturnType<typeof driveClient>;

async function findChild(drive: Drive, parentId: string, name: string) {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name = '${escaped}' and '${parentId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'drive',
    driveId: SHARED_DRIVE_ID(),
  });
  return res.data.files?.[0] ?? null;
}

async function ensureFolder(drive: Drive, parentId: string, name: string) {
  const existing = await findChild(drive, parentId, name);
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
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
 */
async function ensureStudentFolder(
  drive: Drive,
  studentId: string,
  displayName: string
) {
  const root = await ensureFolder(drive, SHARED_DRIVE_ID(), 'Students');
  const folderName = `${displayName} (${studentId.slice(0, 8)})`;

  // Match on the id suffix so renaming a student does not orphan their folder.
  const res = await drive.files.list({
    q: `'${root}' in parents and mimeType = '${FOLDER_MIME}' and name contains '${studentId.slice(0, 8)}' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'drive',
    driveId: SHARED_DRIVE_ID(),
  });

  let id = res.data.files?.[0]?.id;
  if (!id) {
    const created = await drive.files.create({
      requestBody: { name: folderName, mimeType: FOLDER_MIME, parents: [root] },
      fields: 'id',
      supportsAllDrives: true,
    });
    id = created.data.id!;
    await Promise.all(SUBFOLDERS.map((s) => ensureFolder(drive, id!, s)));
  }
  return id;
}

/** Give someone access by email. Used to hand a student their own folder. */
async function grant(
  drive: Drive,
  fileId: string,
  email: string,
  role: 'reader' | 'commenter' | 'writer'
) {
  await drive.permissions.create({
    fileId,
    requestBody: { type: 'user', role, emailAddress: email },
    // The student is told about the document in the app, so skip Google's mail.
    sendNotificationEmail: false,
    supportsAllDrives: true,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action } = req.body ?? {};

  try {
    const drive = driveClient();

    switch (action) {
      /** List everything already stored for a student. */
      case 'list': {
        const { studentId, studentName } = req.body;
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });

        const folderId = await ensureStudentFolder(drive, studentId, studentName || 'Student');

        // Anything dropped at the top level rather than into a subfolder.
        const files = await drive.files.list({
          q: `'${folderId}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`,
          fields: 'files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: 'drive',
          driveId: SHARED_DRIVE_ID(),
          orderBy: 'modifiedTime desc',
        });

        // Include the contents of each subfolder, so the UI can group them.
        const subs = await Promise.all(
          SUBFOLDERS.map(async (name) => {
            const sub = await findChild(drive, folderId, name);
            if (!sub?.id) return { name, files: [] };
            const inner = await drive.files.list({
              q: `'${sub.id}' in parents and trashed = false`,
              fields: 'files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size)',
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
              corpora: 'drive',
              driveId: SHARED_DRIVE_ID(),
              orderBy: 'modifiedTime desc',
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
        const { studentId, studentName, section, filename, mimeType, dataBase64 } = req.body;
        if (!studentId || !filename || !dataBase64) {
          return res.status(400).json({ error: 'studentId, filename and dataBase64 are required' });
        }

        const folderId = await ensureStudentFolder(drive, studentId, studentName || 'Student');
        const target = SUBFOLDERS.includes(section as Subfolder)
          ? await ensureFolder(drive, folderId, section)
          : folderId;

        const created = await drive.files.create({
          requestBody: { name: filename, parents: [target] },
          media: {
            mimeType: mimeType || 'application/octet-stream',
            body: Buffer.from(dataBase64, 'base64'),
          },
          fields: 'id, name, mimeType, webViewLink, modifiedTime, size',
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
        const { studentId, studentName, title, studentEmail, counselorEmail } = req.body;
        if (!studentId || !title) {
          return res.status(400).json({ error: 'studentId and title are required' });
        }

        const folderId = await ensureStudentFolder(drive, studentId, studentName || 'Student');
        const essays = await ensureFolder(drive, folderId, 'Essays');

        const doc = await drive.files.create({
          requestBody: { name: title, mimeType: DOC_MIME, parents: [essays] },
          fields: 'id, name, webViewLink',
          supportsAllDrives: true,
        });

        if (studentEmail) await grant(drive, doc.data.id!, studentEmail, 'writer');
        if (counselorEmail) await grant(drive, doc.data.id!, counselorEmail, 'commenter');

        return res.status(200).json({ file: doc.data });
      }

      case 'delete': {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ error: 'fileId is required' });
        // Trash rather than destroy: a student deleting their only transcript
        // by accident should be recoverable.
        await drive.files.update({
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
