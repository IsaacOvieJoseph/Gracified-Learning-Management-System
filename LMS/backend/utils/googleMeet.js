const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

// Expects environment variables:
// - GOOGLE_SERVICE_ACCOUNT_JSON  : JSON string of service account key (client_email, private_key, project_id)
// - GOOGLE_IMPERSONATED_USER     : email of a GSuite user to impersonate (must have Calendar privileges and domain-wide delegation enabled)

function getJwtClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const subject = process.env.GOOGLE_IMPERSONATED_USER;
  if (!raw || !subject) return null;

  let key;
  try {
    key = JSON.parse(raw);
  } catch (err) {
    console.error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
    return null;
  }

  const clientEmail = key.client_email;
  const privateKey = key.private_key;
  if (!clientEmail || !privateKey) return null;

  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const jwtClient = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
    subject,
  });
  return jwtClient;
}

async function createGoogleMeet({ summary = 'Class Meeting', description = '', startTime = new Date(), endTime = null, attendees = [] } = {}) {
  // startTime and endTime should be Date objects or ISO strings
  const jwtClient = getJwtClient();
  if (!jwtClient) {
    throw new Error('Google service account credentials or impersonated user not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_IMPERSONATED_USER.');
  }

  await jwtClient.authorize();
  const calendar = google.calendar({ version: 'v3', auth: jwtClient });

  const start = (startTime instanceof Date) ? startTime.toISOString() : new Date(startTime).toISOString();
  const end = endTime ? ((endTime instanceof Date) ? endTime.toISOString() : new Date(endTime).toISOString()) : new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();

  const event = {
    summary,
    description,
    start: { dateTime: start },
    end: { dateTime: end },
    attendees: attendees.map(email => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: uuidv4(),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: 1,
  });

  // conferenceData.entryPoints contains the meet URL
  const conf = res.data.conferenceData;
  let meetUrl = null;
  if (conf && conf.entryPoints && conf.entryPoints.length > 0) {
    const ep = conf.entryPoints.find(e => e.entryPointType === 'video');
    meetUrl = ep ? ep.uri : conf.entryPoints[0].uri;
  }

  return {
    meetUrl,
    eventId: res.data.id,
    htmlLink: res.data.htmlLink,
    start: res.data.start,
    end: res.data.end,
    raw: res.data,
  };
}

module.exports = {
  createGoogleMeet,
};
