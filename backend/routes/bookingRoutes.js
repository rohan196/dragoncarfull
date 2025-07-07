const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

// Google OAuth2 setup
const oAuth2Client = new google.auth.OAuth2(
  process.env.GCAL_CLIENT_ID,
  process.env.GCAL_CLIENT_SECRET,
  process.env.GCAL_REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: process.env.GCAL_REFRESH_TOKEN });

function timeTo24Hr(time) {
  const [t, meridian] = time.split(' ');
  let [h, m] = t.split(':');
  h = parseInt(h);
  if (meridian === 'PM' && h !== 12) h += 12;
  if (meridian === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

router.get('/slots', async (req, res) => {
  const bookings = await Booking.find({ date: req.query.date });
  res.json(bookings.map(b => b.time));
});

router.post('/', async (req, res) => {
  const { name, phone, date, time } = req.body;

  await Booking.create({ name, phone, date, time });

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `Car Renovation - ${name}`,
      description: `Phone: ${phone}`,
      start: { dateTime: `${date}T${timeTo24Hr(time)}:00+05:30` },
      end: { dateTime: `${date}T${timeTo24Hr(time + 1)}:00+05:30` }
    }
  });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,
    subject: 'New Booking Received',
    text: `${name} booked a slot on ${date} at ${time}. Phone: ${phone}`
  });

  res.json({ status: 'Booking saved & calendar updated' });
});

module.exports = router;
