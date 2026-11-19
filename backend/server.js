
const { createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');

const { getLeads, getLead, insertLead, updateLead } = require('./database');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = 3000;

app.use(express.json({
  verify: (req, res, buffer) => {
    req.rawBody = buffer;
  }
}));

function broadcastLeads() {
  io.emit('leads:updated', getLeads());
}

io.on('connection', socket => {
  console.log('App connected:', socket.id);
  socket.emit('leads:updated', getLeads());
});

app.get('/leads', (req, res) => {
  res.json(getLeads());
});

app.post('/leads', (req, res) => {
  const { name, email } = req.body ?? {};

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    !name.trim() ||
    !email.trim()
  ) {
    return res.status(400).json({
      error: 'Name and email must be non-empty strings.'
    });
  }

  const lead = {
    id: randomUUID(),
    name: name.trim(),
    email: email.trim(),
    createdAt: new Date().toISOString()
  };

  insertLead(lead);
  broadcastLeads();

  console.log('Manual lead saved:', lead.id);
  return res.status(201).json(getLead(lead.id));
});

app.patch('/leads/:id', (req, res) => {
  const { status, notes } = req.body ?? {};
  const allowedStatuses = ['New', 'Contacted', 'Qualified', 'Closed'];

  if (
    !allowedStatuses.includes(status) ||
    typeof notes !== 'string' ||
    notes.length > 2000
  ) {
    return res.status(400).json({
      error: 'Choose a valid status and keep notes within 2000 characters.'
    });
  }

  const lead = getLead(req.params.id);

  if (!lead) {
    return res.status(404).json({
      error: 'Lead not found.'
    });
  }

  const updatedLead = updateLead(req.params.id, status, notes);
  broadcastLeads();

  return res.json(updatedLead);
});

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (
    process.env.META_VERIFY_TOKEN &&
    mode === 'subscribe' &&
    token === process.env.META_VERIFY_TOKEN &&
    typeof challenge === 'string'
  ) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Receive lead notifications from Meta
app.post('/webhook', async (req, res) => {
  const secret = process.env.META_APP_SECRET;
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  const configuredPageId = process.env.META_PAGE_ID;
  const graphVersion = process.env.META_GRAPH_VERSION;

  if (!secret || !pageToken || !configuredPageId || !graphVersion) {
    console.error('Missing Meta configuration in .env');
    return res.sendStatus(500);
  }

  // Check the request signature before processing anything
  const signature = req.get('x-hub-signature-256') || '';

  const expected = 'sha256=' + createHmac('sha256', secret)
    .update(req.rawBody || Buffer.alloc(0))
    .digest('hex');

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    console.error('Invalid webhook signature');
    return res.sendStatus(403);
  }

  if (req.body?.object !== 'page') {
    return res.sendStatus(404);
  }

  if (!Array.isArray(req.body.entry)) {
    return res.sendStatus(400);
  }

  try {
    for (const entry of req.body.entry) {
      if (!Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        if (change.field !== 'leadgen') continue;

        const leadId = change.value?.leadgen_id;
        if (!leadId) continue;

        console.log('Meta notification received. Lead ID:', leadId);

        const pageId = change.value?.page_id || entry.id;

        if (String(pageId) !== configuredPageId) {
          console.log('Ignored notification for a different Page:', pageId);
          continue;
        }

        if (getLead(String(leadId))) {
          console.log('Duplicate lead ignored:', leadId);
          continue;
        }

        // Get the lead details using the ID sent by Meta
        const url = new URL(
          `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(leadId)}`
        );

        url.searchParams.set('fields', 'id,created_time,field_data');

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${pageToken}`
          },
          signal: AbortSignal.timeout(8000)
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(
            data.error?.message || `Meta returned HTTP ${response.status}`
          );
        }

        if (!data.id || !Array.isArray(data.field_data)) {
          throw new Error('Meta returned incomplete lead data.');
        }

        const fields = Object.fromEntries(
          data.field_data.map(field => [
            field.name,
            field.values?.[0] || ''
          ])
        );

        const submittedDate = data.created_time
          ? new Date(data.created_time)
          : new Date();

        const lead = {
          id: String(data.id),
          name: fields.full_name ||
            [fields.first_name, fields.last_name].filter(Boolean).join(' ') ||
            'Name not provided',
          email: fields.email || 'Email not provided',
          createdAt: Number.isNaN(submittedDate.getTime())
            ? new Date().toISOString()
            : submittedDate.toISOString()
        };

        if (insertLead(lead)) {
          broadcastLeads();
          console.log('Meta lead saved and sent to app:', lead.id);
        }
      }
    }

    return res.status(200).send('EVENT_RECEIVED');

  } catch (error) {
    console.error('Meta lead processing failed:', error.message);
    return res.sendStatus(500);
  }
});

app.get('/privacy', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>FocusFlow Demo Privacy Notice</title>
      </head>
      <body style="font-family: sans-serif; max-width: 720px;
                   margin: 40px auto; padding: 20px; line-height: 1.6;">
        <h1>FocusFlow Demo Privacy Notice</h1>
        <p>This student project demonstrates delivery of Meta lead-form
        submissions to a mobile app. Please submit dummy test details only.</p>

        <h2>Information and purpose</h2>
        <p>The demo processes submitted names, email addresses, lead IDs,
        submission times, follow-up statuses and notes to test lead delivery
        and follow-up management. We do not use this information for
        marketing or sell it.</p>

        <h2>Processing and retention</h2>
        <p>Submissions pass through Meta and ngrok to our development
        backend and connected demo app. The backend stores leads, statuses
        and notes in a local SQLite database until the project administrator
        deletes them. Restarting the server does not delete these records.
        Meta, ngrok and development logs may retain information separately
        under their settings and policies.</p>

        <h2>Demonstration recordings</h2>
        <p>Test details displayed in the app may appear in project recordings
        shared with evaluators. Recordings are stored separately from
        the database.</p>

        <h2>Questions or deletion requests</h2>
        <p>Contact the FocusFlow Facebook Page administrator through
        the FocusFlow Page.</p>
      </body>
    </html>
  `);
});

app.use((error, req, res, next) => {
  console.error('Request failed:', error.message);

  if (res.headersSent) {
    return next(error);
  }

  const status = error.status === 400 ? 400 : 500;

  return res.status(status).json({
    error: status === 400 ? 'Invalid request body.' : 'Server error.'
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Saved leads loaded: ${getLeads().length}`);
});
