import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as cors from 'cors';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// CORS handler allowing any origin (change if needed)
const corsHandler = cors({ origin: '*', methods: ['POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] });

// Base URL where the front-end (availability calendar) is hosted
// Helper to build full calendar URL at runtime (hash-based for GitHub Pages compatibility)
const buildCalendarLink = (uniqueLink: string) => {
  const base = process.env.FRONTEND_BASE_URL || 'https://property-manager-cf570.web.app';
  return `${base}/#/availability/${uniqueLink}`;
};

// LINE API Configuration - Use environment variables instead of functions.config()
// Prefer env var (for Cloud Run gen-2). Fallback to Firebase functions config so you can set it with:
//   firebase functions:config:set line.channel_access_token="YOUR_TOKEN"
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "tBUR276bwxwSwNGscbwMMm7rCxdWsJBIRqcTlzrl//yevZ2LzI2dq4E82jmjCSyTLqQwOsr5Ey4LSTwmMAdEasSWjR/SMsKF2liadsHidFRY9Mn0gqTm4QUaBmc2RWYwIoCim0ZA5dn/k5P4lYIXpQdB04t89/1O/w1cDnyilFU=";

if (!LINE_CHANNEL_ACCESS_TOKEN) {
  console.warn('⚠️  LINE_CHANNEL_ACCESS_TOKEN is not set. Notifications will fail.');
}

interface LineMessage {
  type: string;
  text?: string;
  flex?: any;
}

interface Cleaner {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  lineUserId?: string;
  isActive: boolean;
}

interface CleaningAssignment {
  id: string;
  bookingId: string;
  cleanerId: string;
  date: string;
  status: string;
  notes?: string;
  guestName?: string;
  checkOutDate?: string;
}

// Send message to LINE user
async function sendLineMessage(userId: string, message: LineMessage) {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [message]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE API Error:', response.status, errorText);
      throw new Error(`LINE API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending LINE message:', error);
    throw error;
  }
}

// Test function to verify LINE API integration
export const testLineAPI = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { lineUserId } = req.body;

    if (!lineUserId) {
      res.status(400).json({ error: 'lineUserId is required' });
      return;
    }

    // Send a simple test message
    const message = {
      type: 'text',
      text: '🧪 LINE API テスト\n\nこのメッセージが表示されれば、LINE API の統合が正常に動作しています！\n\nテスト日時: ' + new Date().toLocaleString('ja-JP')
    };

    await sendLineMessage(lineUserId, message);

    res.status(200).json({ 
      success: true, 
      message: 'Test message sent successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test function:', error);
    res.status(500).json({ 
      error: 'Failed to send test message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create simple cleaning reminder message
function createCleaningReminderMessage(assignment: CleaningAssignment, cleaner: Cleaner): LineMessage {
  const date = new Date(assignment.date);
  const formattedDate = date.toLocaleDateString('ja-JP', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });

  return {
    type: 'text',
    text: `🧹 清掃リマインダー\n\n${cleaner.name}さん\n予定日: ${formattedDate}\nゲスト: ${assignment.guestName || 'N/A'}\nチェックアウト: ${assignment.checkOutDate || 'N/A'}\n\n${assignment.notes || '標準的な清掃をお願いします。'}`
  };
}

// Create simple schedule message
function createScheduleMessage(assignments: CleaningAssignment[], cleaner: Cleaner, weekStart: string): LineMessage {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const formattedWeekStart = new Date(weekStart).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
  const formattedWeekEnd = weekEnd.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });

  let scheduleText = `📅 今週のスケジュール\n\n${cleaner.name}さん\n${formattedWeekStart} - ${formattedWeekEnd}\n\n`;

  assignments.forEach(assignment => {
    const date = new Date(assignment.date);
    const formattedDate = date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
    const status = assignment.status === 'completed' ? '✅' : '⏳';
    scheduleText += `${formattedDate}: ${assignment.guestName || 'N/A'} ${status}\n`;
  });

  return {
    type: 'text',
    text: scheduleText
  };
}

// Create simple monthly schedule message
function createMonthlyScheduleMessage(assignments: CleaningAssignment[], cleaner: Cleaner, month: string): LineMessage {
  const dateObj = new Date(month + '-01');
  const monthName = dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });

  let scheduleText = `📅 ${monthName} の清掃スケジュール\n\n${cleaner.name}さん\n\n`;

  // Sort by date ASC
  assignments.sort((a: any, b: any) => (a.currentCleaningDate || a.date).localeCompare(b.currentCleaningDate || b.date));

  assignments.forEach(assignment => {
    const formattedDate = new Date((assignment as any).currentCleaningDate || assignment.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
    let guestsText;
    const g: any = (assignment as any).guests;
    if (typeof g === 'number') {
      guestsText = `${g}名`;
    } else if (typeof g === 'string') {
      guestsText = g; // could be 'ERROR'
    } else {
      guestsText = 'ERROR';
    }
    const statusIcon = assignment.status === 'completed' ? '✅' : assignment.status === 'in-progress' ? '🚧' : '⏳';
    scheduleText += `${formattedDate}: ${guestsText} ${statusIcon}\n`;
  });

  return {
    type: 'text',
    text: scheduleText
  };
}

// Send cleaning reminder to a specific cleaner
export const sendCleaningReminder = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { assignmentId, cleanerId } = req.body;

    if (!assignmentId || !cleanerId) {
      res.status(400).json({ error: 'assignmentId and cleanerId are required' });
      return;
    }

    // Get cleaner information
    const cleanerDoc = await db.collection('cleaners').doc(cleanerId).get();
    if (!cleanerDoc.exists) {
      res.status(404).json({ error: 'Cleaner not found' });
      return;
    }

    const cleaner = { id: cleanerDoc.id, ...cleanerDoc.data() } as Cleaner;

    if (!cleaner.lineUserId) {
      res.status(400).json({ error: 'Cleaner does not have LINE user ID configured' });
      return;
    }

    // Get assignment information
    const assignmentDoc = await db.collection('cleaning-assignments').doc(assignmentId).get();
    if (!assignmentDoc.exists) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() } as CleaningAssignment;

    // Create and send reminder message
    const message = createCleaningReminderMessage(assignment, cleaner);
    await sendLineMessage(cleaner.lineUserId, message);

    // Log the notification
    await db.collection('line-notifications').add({
      cleanerId,
      assignmentId,
      messageType: 'reminder',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent'
    });

    res.status(200).json({ success: true, message: 'Reminder sent successfully' });
  } catch (error) {
    console.error('Error sending cleaning reminder:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// Send weekly schedule to a cleaner
export const sendWeeklySchedule = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { cleanerId, weekStart } = req.body;

    if (!cleanerId || !weekStart) {
      res.status(400).json({ error: 'cleanerId and weekStart are required' });
      return;
    }

    // Get cleaner information
    const cleanerDoc = await db.collection('cleaners').doc(cleanerId).get();
    if (!cleanerDoc.exists) {
      res.status(404).json({ error: 'Cleaner not found' });
      return;
    }

    const cleaner = { id: cleanerDoc.id, ...cleanerDoc.data() } as Cleaner;

    if (!cleaner.lineUserId) {
      res.status(400).json({ error: 'Cleaner does not have LINE user ID configured' });
      return;
    }

    // Calculate week end date
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Get assignments for the week
    const assignmentsSnapshot = await db.collection('cleaning-assignments')
      .where('cleanerId', '==', cleanerId)
      .where('date', '>=', weekStart)
      .where('date', '<=', weekEnd.toISOString().split('T')[0])
      .get();

    const assignments = assignmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CleaningAssignment[];

    if (assignments.length === 0) {
      res.status(200).json({ success: true, message: 'No assignments for this week' });
      return;
    }

    // Create and send schedule message
    const message = createScheduleMessage(assignments, cleaner, weekStart);
    await sendLineMessage(cleaner.lineUserId, message);

    // Log the notification
    await db.collection('line-notifications').add({
      cleanerId,
      weekStart,
      messageType: 'schedule',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
      assignmentCount: assignments.length
    });

    res.status(200).json({ 
      success: true, 
      message: 'Schedule sent successfully',
      assignmentCount: assignments.length
    });
  } catch (error) {
    console.error('Error sending weekly schedule:', error);
    res.status(500).json({ error: 'Failed to send schedule' });
  }
});

// Send monthly cleaning assignments to all cleaners
export const sendMonthlyAssignments = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { month } = req.body; // month format: YYYY-MM

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'month is required in YYYY-MM format' });
      return;
    }

    const monthStart = `${month}-01`;
    const monthEndDate = new Date(monthStart);
    monthEndDate.setMonth(monthEndDate.getMonth() + 1);
    monthEndDate.setDate(0); // last day of previous month which is month end
    const monthEnd = monthEndDate.toISOString().split('T')[0];

    // Fetch all assignments in the month
    const assignmentsSnap = await db.collection('cleaning-assignments')
      .where('currentCleaningDate', '>=', monthStart)
      .where('currentCleaningDate', '<=', monthEnd)
      .get();

    const assignments: CleaningAssignment[] = assignmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CleaningAssignment[];

    if (assignments.length === 0) {
      res.status(200).json({ success: true, message: 'No assignments for this month' });
      return;
    }

    // Load bookings data for assignments
    const bookingCache: Record<string, any> = {};
    const getBooking = async (bookingId: string) => {
      if (bookingCache[bookingId]) return bookingCache[bookingId];
      try {
        const doc = await db.collection('bookings').doc(bookingId).get();
        if (doc.exists) {
          const data = doc.data();
          bookingCache[bookingId] = data;
          return data;
        }
      } catch {}
      return null;
    };

    // Group by cleanerId
    const assignmentsByCleaner: Record<string, CleaningAssignment[]> = {};
    assignments.forEach(a => {
      if (!a.cleanerId) return; // skip unassigned
      if (!assignmentsByCleaner[a.cleanerId]) assignmentsByCleaner[a.cleanerId] = [];
      assignmentsByCleaner[a.cleanerId].push(a);
    });

    let totalMessagesSent = 0;

    // Iterate cleaners
    for (const [cleanerId, cleanerAssignments] of Object.entries(assignmentsByCleaner)) {
      const cleanerDoc = await db.collection('cleaners').doc(cleanerId).get();
      if (!cleanerDoc.exists) continue; // skip missing cleaner
      const cleaner = { id: cleanerDoc.id, ...cleanerDoc.data() } as Cleaner;
      if (!cleaner.lineUserId) continue; // skip if no LINE user

      // Attach guest count to each assignment for message
      const assignmentsWithGuests = await Promise.all(
        cleanerAssignments.map(async (asgn: any) => {
          const booking = await getBooking(asgn.bookingId);
          const nextGuests = await getNextBookingGuests(booking);
          const guestsValue = nextGuests !== null ? nextGuests : 'ERROR';
          return { ...asgn, guests: guestsValue };
        })
      );

      const message = createMonthlyScheduleMessage(assignmentsWithGuests as any, cleaner, month);
      try {
        await sendLineMessage(cleaner.lineUserId, message);
        totalMessagesSent++;
        // Log
        await db.collection('line-notifications').add({
          cleanerId,
          month,
          messageType: 'monthly-schedule',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'sent',
          assignmentCount: cleanerAssignments.length
        });
      } catch (err) {
        console.error('Failed to send monthly schedule to', cleanerId, err);
        await db.collection('line-notifications').add({
          cleanerId,
          month,
          messageType: 'monthly-schedule',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'failed',
          assignmentCount: cleanerAssignments.length,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    res.status(200).json({ success: true, message: 'Monthly schedules sent', totalMessagesSent });
  } catch (error) {
    console.error('Error sending monthly assignments:', error);
    res.status(500).json({ error: 'Failed to send monthly assignments' });
  }
  });
});

// Webhook to handle LINE bot responses
export const lineWebhook = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { events } = req.body;

    for (const event of events) {
      if (event.type === 'postback') {
        const data = event.postback.data;
        const [action, assignmentId] = data.split(':');

        if (action === 'start_cleaning') {
          // Update assignment status to in-progress
          await db.collection('cleaning-assignments').doc(assignmentId).update({
            status: 'in-progress',
            startedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Send confirmation message
          await sendLineMessage(event.source.userId, {
            type: 'text',
            text: '清掃を開始しました。完了したら「完了」ボタンを押してください。'
          });
        } else if (action === 'complete_cleaning') {
          // Update assignment status to completed
          await db.collection('cleaning-assignments').doc(assignmentId).update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Send confirmation message
          await sendLineMessage(event.source.userId, {
            type: 'text',
            text: '清掃完了を記録しました。お疲れさまでした！'
          });
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling LINE webhook:', error);
    res.status(500).send('Internal Server Error');
  }
}); 

export const sendAvailabilityLink = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
  try {
    // Handle preflight is already managed by corsHandler

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { cleanerId, uniqueLink, month } = req.body;

    if (!cleanerId || !uniqueLink || !month) {
      res.status(400).json({ error: 'cleanerId, uniqueLink and month are required' });
      return;
    }

    // Fetch cleaner data
    const cleanerDoc = await db.collection('cleaners').doc(cleanerId).get();
    if (!cleanerDoc.exists) {
      res.status(404).json({ error: 'Cleaner not found' });
      return;
    }
    const cleaner = { id: cleanerDoc.id, ...cleanerDoc.data() } as Cleaner;

    if (!cleaner.lineUserId) {
      res.status(400).json({ error: 'Cleaner does not have LINE user ID configured' });
      return;
    }

    // Construct full link based on Firebase hosting or custom domain
    const linkUrl = buildCalendarLink(uniqueLink);

    // Build message
    const dateObj = new Date(month + '-01');
    const monthName = dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
    const message: LineMessage = {
      type: 'text',
      text: `📆 ${cleaner.name}さん\n\n${monthName} の勤務可能日を入力してください。\n以下のリンクからカレンダーを開いて、空いている日を選択してください👇\n${linkUrl}`
    };

    // Send LINE message
    await sendLineMessage(cleaner.lineUserId, message);

    // Log notification
    await db.collection('line-notifications').add({
      cleanerId,
      messageType: 'availability-link',
      link: uniqueLink,
      month,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent'
    });

    res.status(200).json({ success: true, message: 'Availability link sent successfully' });
  } catch (error) {
    console.error('Error sending availability link notification:', error);
    res.status(500).json({ error: 'Failed to send availability link' });
  }
  });
}); 