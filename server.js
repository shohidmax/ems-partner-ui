
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const { randomUUID } = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb');
const helmet = require('helmet');
const compression = require('compression');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit'); 
require('dotenv').config();

// --- Global Variables ---
const JWT_SECRET = process.env.JWT_SECRET || 'please_change_this_secret';
const BATCH_INTERVAL_MS = 10000;
const FILTER_INTERVAL_MS = 10 * 60 * 1000;
const OFFLINE_THRESHOLD_MS = 10 * 60 * 1000;
const CHECK_OFFLINE_INTERVAL_MS = 1 * 60 * 1000;

let espDataBuffer = [];
const backupJobs = new Map();

// --- App and Server Setup ---
const app = express();
const port = process.env.PORT || 3002;
const http_server = http.createServer(app);
const io = new Server(http_server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// --- Security: Rate Limiter Setup ---
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 60, 
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Nodemailer Transport ---
let mailTransporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  
  mailTransporter.verify((error, success) => {
    if (error) {
      console.warn('[Nodemailer Error]  :', error.message);
    } else {
      console.log('[Nodemailer Success]  : Email server is ready to take messages');
    }
  });
}

// --- Middleware ---
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return res.status(401).send({ success: false, message: 'Authorization header missing' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).send({ success: false, message: 'Invalid authorization format' });

  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).send({ success: false, message: 'Invalid or expired token' });
  }
}

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use('/api/esp32p', apiLimiter); 
app.use('/api/esp32pp', apiLimiter);

// --- MongoDB Connection ---
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not defined in .env file');
const client = new MongoClient(uri);

// --- Helper Functions ---

async function flushDataBuffer(collection, devicesCollection) {
  if (espDataBuffer.length === 0) return;

  const dataToInsert = [...espDataBuffer];
  espDataBuffer = []; 

  console.log(`[Batch Insert] Processing ${dataToInsert.length} documents...`);

  try {
    await collection.insertMany(dataToInsert, { ordered: false });
    
    io.emit('new-data', dataToInsert);

    const lastSeenUpdates = new Map();
    for (const data of dataToInsert) {
      if (data.uid) {
        const newTime = data.timestamp || new Date(); 
        const existing = lastSeenUpdates.get(data.uid);
        
        if (!existing || newTime >= existing.time) {
          lastSeenUpdates.set(data.uid, { 
            time: newTime, 
            data: { 
              temperature: data.temperature,
              water_level: data.water_level,
              rainfall: data.rainfall
            } 
          });
        }
      }
    }

    if (lastSeenUpdates.size > 0) {
      const bulkOps = [];
      const updatedDeviceUIDs = [];

      lastSeenUpdates.forEach((update, uid) => {
        updatedDeviceUIDs.push(uid);
        bulkOps.push({
          updateOne: {
            filter: { uid: uid },
            update: {
              $set: {
                lastSeen: update.time,
                status: 'online',
                data: update.data
              },
              $setOnInsert: {
                uid: uid,
                addedAt: new Date(),
                location: null,
                name: null
              }
            },
            upsert: true
          }
        });
      });

      await devicesCollection.bulkWrite(bulkOps, { ordered: false });
      io.emit('device-status-updated', updatedDeviceUIDs);
    }
    
    console.log(`[Batch Insert] Success: ${dataToInsert.length} docs saved.`);

  } catch (error) {
    console.error("[Batch Insert] Failed! Restoring data to buffer:", error.message);
    espDataBuffer = [...dataToInsert, ...espDataBuffer];
  }
}

async function syncAllDevices(EspCollection, devicesCollection) {
  try {
    const uids = await EspCollection.distinct('uid');
    if (!uids || uids.length === 0) return;

    const bulkOps = uids.map(uid => ({
      updateOne: {
        filter: { uid: uid },
        update: { 
          $setOnInsert: { 
            uid: uid, 
            addedAt: new Date(),
            status: 'unknown',
            lastSeen: null,
            data: {}
          } 
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await devicesCollection.bulkWrite(bulkOps, { ordered: false });
    }
  } catch (error) {
    console.error('[Device Sync Job] Error:', error.message);
  }
}

async function checkOfflineDevices(devicesCollection) {
  try {
    const thresholdTime = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
    
    const devicesToUpdate = await devicesCollection.find(
      { status: 'online', lastSeen: { $lt: thresholdTime } },
      { projection: { uid: 1 } }
    ).toArray();

    if (devicesToUpdate.length === 0) return;

    const uidsToUpdate = devicesToUpdate.map(d => d.uid);
    await devicesCollection.updateMany(
      { uid: { $in: uidsToUpdate } },
      { $set: { status: 'offline' } }
    );

    console.log(`[Offline Check] ${uidsToUpdate.length} devices marked offline.`);
    io.emit('device-status-updated', uidsToUpdate);
  } catch (error) {
    console.error('[Offline Check] Error:', error.message);
  }
}

function cleanupOldBackupJobs() {
  const NOW = Date.now();
  const MAX_AGE_MS = 60 * 60 * 1000;

  backupJobs.forEach((job, jobId) => {
    const jobTime = job.finishedAt ? job.finishedAt.getTime() : 0;
    if ((job.status === 'done' || job.status === 'error') && (NOW - jobTime > MAX_AGE_MS)) {
        if (job.tmpDir) {
          try {
            fs.rmSync(job.tmpDir, { recursive: true, force: true });
          } catch(e) {
            console.warn(`[Cleanup] Failed to delete ${job.tmpDir}`, e.message);
          }
        }
        backupJobs.delete(jobId);
    }
  });
}

// --- Main run function ---
async function run() {
  try {
    await client.connect();
    console.log('MongoDB Connected Successfully');

    const db = client.db('Esp32data');
    const EspCollection = db.collection('espdata2'); 
    const devicesCollection = db.collection('devices');
    const usersCollection = db.collection('users');

    console.log('Ensuring indexes...');
    try {
        await EspCollection.createIndex({ uid: 1, timestamp: -1 });
        await devicesCollection.createIndex({ uid: 1 }, { unique: true });
        await usersCollection.createIndex({ email: 1 }, { unique: true });
    } catch (idxErr) {
        console.warn('Index creation warning:', idxErr.message);
    }

    setInterval(() => flushDataBuffer(EspCollection, devicesCollection), BATCH_INTERVAL_MS);
    setInterval(() => syncAllDevices(EspCollection, devicesCollection), FILTER_INTERVAL_MS);
    setInterval(() => checkOfflineDevices(devicesCollection), CHECK_OFFLINE_INTERVAL_MS);
    setInterval(cleanupOldBackupJobs, 15 * 60 * 1000);

    syncAllDevices(EspCollection, devicesCollection);

    async function ensureAdmin(req, res) {
      const userId = req.user && req.user.userId;
      if (!userId) return res.status(401).send({ success: false, message: 'Unauthorized' });
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      const isAdminEnv = process.env.ADMIN_EMAIL && user && user.email === process.env.ADMIN_EMAIL;
      if (user && (user.isAdmin === true || isAdminEnv)) return { ok: true, user };
      return res.status(403).send({ success: false, message: 'Admin access required' });
    }

    // --- Routes ---

    // Function to parse nested data
    const parseDeviceData = (body) => {
        const data = { ...body };
        // Flatten nested structure
        data.temperature = body.environment?.temp;
        data.water_level = body.pssensor?.depth_ft;
        data.rainfall = body.rain?.mm;
        return data;
    }

    app.post('/api/esp32pp', async (req, res) => {
      try {
        let data = parseDeviceData(req.body);
        data.timestamp = data.dateTime ? new Date(data.dateTime) : new Date();
        data.receivedAt = new Date();
        espDataBuffer.push(data);
        res.status(200).send({ message: 'Data queued.' });
      } catch (error) {
        res.status(400).send({ message: 'Invalid data' });
      }
    });

    app.post('/api/esp32p', async (req, res) => {
      try {
        let data = parseDeviceData(req.body);
        
        const bdTime = new Date(Date.now() + (6 * 60 * 60 * 1000));
        data.receivedAt = bdTime; 

        if (data.dateTime && typeof data.dateTime === 'string') {
          const isoString = data.dateTime.replace(' ', 'T') + "+06:00";
          data.timestamp = new Date(isoString);
        } else {
          data.timestamp = bdTime;
        }

        espDataBuffer.push(data);
        res.status(200).send({ message: 'Data queued.' });
      } catch (error) {
        console.error("Error in /api/esp32p:", error.message);
        res.status(400).send({ message: 'Invalid data' });
      }
    });

    app.get('/api/device/data', async (req, res) => {
      try {
        const { uid, limit } = req.query || {};
        if (!uid) return res.status(400).send({ message: 'UID required' });
        
        const lim = Math.min(1000, Math.max(1, parseInt(limit, 10) || 300));
        
        const docs = await EspCollection.find({ uid: String(uid) })
          .sort({ timestamp: -1 })
          .limit(lim)
          .project({ uid: 1, temperature: 1, water_level: 1, rainfall: 1, timestamp: 1, _id: 0 })
          .toArray();

        return res.send(docs);
      } catch (error) {
        return res.status(500).send({ message: 'Server Error' });
      }
    });

    app.post('/api/device/data-by-range', async (req, res) => {
        try {
          const { uid, start, end, limit } = req.body || {};
          if (!uid) return res.status(400).send({ success: false, message: 'uid is required' });
  
          const startDate = start ? new Date(start) : new Date(0);
          const endDate = end ? new Date(end) : new Date();
          const lim = Math.min(20000, Math.max(1, parseInt(limit, 10) || 10000));
  
          const docs = await EspCollection.find({ uid: String(uid), timestamp: { $gte: startDate, $lte: endDate } })
            .sort({ timestamp: 1 })
            .limit(lim)
            .project({ uid: 1, temperature: 1, water_level: 1, rainfall: 1, timestamp: 1, _id: 0 })
            .toArray();
  
          return res.send(docs);
        } catch (error) {
          return res.status(500).send({ success: false, message: 'Internal server error' });
        }
    });

    app.post('/api/backup/start', async (req, res) => {
        const { uid } = req.body || {};
        const q = uid ? { uid: String(uid) } : {};
        const jobId = randomUUID();
        
        const tmpDir = path.join(os.tmpdir(), `esp-backup-${jobId}`);
        try { fs.mkdirSync(tmpDir, { recursive: true }); } catch(e){}

        const jsonPath = path.join(tmpDir, 'espdata.json');
        const zipPath = path.join(tmpDir, 'espdata.zip');
        const job = { status: 'pending', progress: 0, tmpDir, jsonPath, zipPath, error: null };
        backupJobs.set(jobId, job);

        (async () => {
            try {
                job.status = 'exporting';
                const out = fs.createWriteStream(jsonPath, { encoding: 'utf8' });
                out.write('[');
                let first = true;
                let written = 0;
                const total = await EspCollection.countDocuments(q);

                const cursor = EspCollection.find(q).sort({ timestamp: 1 });
                for await (const doc of cursor) {
                    if (!first) out.write(',');
                    const cleanDoc = {
                        uid: doc.uid,
                        temperature: doc.temperature,
                        water_level: doc.water_level,
                        rainfall: doc.rainfall,
                        timestamp: doc.timestamp,
                        receivedAt: doc.receivedAt
                    };
                    out.write(JSON.stringify(cleanDoc));
                    first = false;
                    written++;
                    if (total > 0) job.progress = Math.floor((written / total) * 90);
                }
                out.write(']');
                out.end();
                await new Promise(r => out.on('finish', r));

                job.status = 'zipping';
                const output = fs.createWriteStream(zipPath);
                const archive = archiver('zip', { zlib: { level: 9 } });
                archive.pipe(output);
                archive.file(jsonPath, { name: 'espdata.json' });
                await archive.finalize();
                await new Promise(r => output.on('close', r));

                job.status = 'done';
                job.progress = 100;
                job.finishedAt = new Date();
            } catch (err) {
                console.error('Backup Error:', err);
                job.status = 'error';
                job.error = err.message;
                job.finishedAt = new Date();
            }
        })();

        res.send({ jobId });
    });

    app.get('/api/backup/status/:jobId', (req, res) => {
        const job = backupJobs.get(req.params.jobId);
        if (!job) return res.status(404).send('Not found');
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const iv = setInterval(() => {
            const j = backupJobs.get(req.params.jobId);
            if (!j) { clearInterval(iv); return res.end(); }
            
            res.write(`data: ${JSON.stringify({ status: j.status, progress: j.progress })}\n\n`);
            if (j.status === 'done' || j.status === 'error') {
                clearInterval(iv);
                res.end();
            }
        }, 1000);
        req.on('close', () => clearInterval(iv));
    });

    app.get('/api/backup/download/:jobId', (req, res) => {
        const job = backupJobs.get(req.params.jobId);
        if (!job || job.status !== 'done') return res.status(400).send('Not ready');
        res.download(job.zipPath);
    });

    app.post('/api/user/register', async (req, res) => {
        const { name, email, password } = req.body || {};
        if (!name || !email || !password) return res.status(400).send({ success: false, message: 'Missing fields' });
        
        const normalizedEmail = String(email).trim().toLowerCase();
        try {
            const exists = await usersCollection.findOne({ email: normalizedEmail });
            if (exists) return res.status(400).send({ success: false, message: 'Email taken' });

            const passwordHash = await bcrypt.hash(password, 10);
            await usersCollection.insertOne({
                name, email: normalizedEmail, passwordHash, devices: [], createdAt: new Date()
            });
            res.send({ success: true, message: 'Registered' });
        } catch (e) {
            res.status(500).send({ success: false, message: 'Error' });
        }
    });

    app.post('/api/user/login', async (req, res) => {
        const { email, password } = req.body || {};
        const user = await usersCollection.findOne({ email: String(email).toLowerCase() });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).send({ success: false, message: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.send({ success: true, token });
    });

    app.post('/api/user/password/forgot', async (req, res) => {
        if (!mailTransporter) return res.status(500).send({ success: false, message: 'Email config missing' });
        const { email } = req.body;
        const user = await usersCollection.findOne({ email: String(email).toLowerCase() });
        if (user) {
            const newPass = crypto.randomBytes(4).toString('hex');
            await usersCollection.updateOne({ _id: user._id }, { $set: { passwordHash: await bcrypt.hash(newPass, 10) } });
            mailTransporter.sendMail({
                to: user.email,
                subject: 'Password Reset',
                text: `New Password: ${newPass}`
            }).catch(console.error);
        }
        res.send({ success: true, message: 'If account exists, email sent.' });
    });

    app.get('/api/device/list', authenticateJWT, async (req, res) => {
        const list = await devicesCollection.find({}, { projection: { _id: 0 } }).toArray();
        res.send(list);
    });

    app.get('/api/user/devices', authenticateJWT, async (req, res) => {
        const user = await usersCollection.findOne({ _id: new ObjectId(req.user.userId) });
        if (!user || !user.devices) return res.send([]);
        
        const devices = await devicesCollection.find({ uid: { $in: user.devices } }).toArray();
        const result = user.devices.map(uid => {
            const d = devices.find(x => x.uid === uid);
            return {
                uid,
                name: d?.name,
                location: d?.location,
                status: d?.status || 'offline',
                lastSeen: d?.lastSeen,
                data: d?.data || {}
            };
        });
        res.send(result);
    });

    app.post('/api/user/device/add', authenticateJWT, async (req, res) => {
        const { uid } = req.body;
        if (!uid) return res.status(400).send({ message: 'UID needed' });
        await usersCollection.updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $addToSet: { devices: String(uid).trim() } }
        );
        res.send({ success: true });
    });

    app.delete('/api/user/device/remove', authenticateJWT, async (req, res) => {
        const { uid } = req.body;
        await usersCollection.updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $pull: { devices: String(uid).trim() } }
        );
        res.send({ success: true });
    });

    app.get('/api/user/profile', authenticateJWT, async (req, res) => {
        const user = await usersCollection.findOne({ _id: new ObjectId(req.user.userId) }, { projection: { passwordHash: 0 } });
        if (!user) return res.status(404).send('User not found');
        
        const isAdminEnv = process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
        user.isAdmin = (user.isAdmin === true || isAdminEnv);
        res.send(user);
    });

    app.post('/api/user/profile/update', authenticateJWT, async (req, res) => {
        const { name, address, mobile } = req.body;
        const update = {};
        if (name) update.name = name;
        if (address) update.address = address;
        if (mobile) update.mobile = mobile;
        
        await usersCollection.updateOne({ _id: new ObjectId(req.user.userId) }, { $set: update });
        res.send({ success: true });
    });

    app.get('/api/admin/stats', authenticateJWT, async (req, res) => {
        const check = await ensureAdmin(req, res);
        if (!check?.ok) return;

        const [totalDev, onlineDev, totalData] = await Promise.all([
            devicesCollection.countDocuments(),
            devicesCollection.countDocuments({ status: 'online' }),
            EspCollection.countDocuments()
        ]);
        
        res.send({ totalDevices: totalDev, onlineDevices: onlineDev, offlineDevices: totalDev - onlineDev, totalDataPoints: totalData });
    });

    app.put('/api/device/:uid', authenticateJWT, async (req, res) => {
        const check = await ensureAdmin(req, res);
        if (!check?.ok) return;

        const { location, name, latitude, longitude, division } = req.body;
        await devicesCollection.updateOne(
            { uid: req.params.uid },
            { $set: { location, name, latitude, longitude, division } }
        );
        res.send({ success: true });
    });

    app.get('/api/admin/users', authenticateJWT, async (req, res) => {
        const check = await ensureAdmin(req, res);
        if (!check?.ok) return;
        const users = await usersCollection.find({}, { projection: { passwordHash: 0 } }).toArray();
        res.send(users);
    });

    app.get('/api/admin/devices', authenticateJWT, async (req, res) => {
      const check = await ensureAdmin(req, res);
      if (!check || check.ok !== true) return;

      try {
        const devices = await devicesCollection.aggregate([
          {
            $lookup: {
              from: 'users',
              let: { device_uid: '$uid' },
              pipeline: [
                { $match: { $expr: { $in: ['$$device_uid', '$devices'] } } },
                { $project: { name: 1, email: 1 } }
              ],
              as: 'owners'
            }
          },
          { $project: { _id: 0 } }
        ]).toArray();

        return res.send(devices);
      } catch (error) {
        console.error('Error in /api/admin/devices:', error);
        return res.status(500).send({ success: false, message: 'Internal server error' });
      }
    });

    app.get('/api/admin/report', authenticateJWT, async (req, res) => {
      const check = await ensureAdmin(req, res);
      if (!check || check.ok !== true) return;
      try {
        const { period = 'monthly', year } = req.query || {};
        const match = {};
        if (year) {
          const y = parseInt(year, 10);
          if (!isNaN(y)) {
            match.timestamp = { $gte: new Date(`${y}-01-01T00:00:00Z`), $lt: new Date(`${y + 1}-01-01T00:00:00Z`) };
          }
        }
        let pipeline = [];
        if (Object.keys(match).length) pipeline.push({ $match: match });
        if (period === 'daily') {
          pipeline.push({
            $group: {
              _id: { year: { $year: '$timestamp' }, month: { $month: '$timestamp' }, day: { $dayOfMonth: '$timestamp' } },
              avgTemp: { $avg: '$temperature' }, avgRain: { $avg: '$rainfall' }, count: { $sum: 1 }
            }
          });
          pipeline.push({ $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } });
          const raw = await EspCollection.aggregate(pipeline).toArray();
          const result = raw.map(r => ({ date: `${r._id.year}-${String(r._id.month).padStart(2,'0')}-${String(r._id.day).padStart(2,'0')}`, avgTemp: Number(r.avgTemp.toFixed(2)), avgRain: Number(r.avgRain.toFixed(2)), count: r.count }));
          return res.send(result);
        }
        if (period === 'yearly') {
          pipeline.push({
            $group: {
              _id: { year: { $year: '$timestamp' } },
              avgTemp: { $avg: '$temperature' }, avgRain: { $avg: '$rainfall' }, count: { $sum: 1 }
            }
          });
          pipeline.push({ $sort: { '_id.year': 1 } });
          const raw = await EspCollection.aggregate(pipeline).toArray();
          const result = raw.map(r => ({ year: r._id.year, avgTemp: Number(r.avgTemp.toFixed(2)), avgRain: Number(r.avgRain.toFixed(2)), count: r.count }));
          return res.send(result);
        }
        // default: monthly
        pipeline.push({
          $group: {
            _id: { year: { $year: '$timestamp' }, month: { $month: '$timestamp' } },
            avgTemp: { $avg: '$temperature' }, avgRain: { $avg: '$rainfall' }, count: { $sum: 1 }
          }
        });
        pipeline.push({ $sort: { '_id.year': 1, '_id.month': 1 } });
        const raw = await EspCollection.aggregate(pipeline).toArray();
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const result = raw.map(r => ({ month: monthNames[r._id.month - 1], year: r._id.year, avgTemp: Number(r.avgTemp.toFixed(2)), avgRain: Number(r.avgRain.toFixed(2)), count: r.count }));
        return res.send(result);
      } catch (error) {
        console.error('Error in /api/admin/report:', error);
        return res.status(500).send({ success: false, message: 'Internal server error' });
      }
    });

     app.post('/api/admin/user/make-admin', authenticateJWT, async (req, res) => {
      const check = await ensureAdmin(req, res);
      if (!check || check.ok !== true) return;

      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).send({ success: false, message: 'Email is required' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const result = await usersCollection.updateOne(
          { email: normalizedEmail },
          { $set: { isAdmin: true } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ success: false, message: 'User not found' });
        }

        res.send({ success: true, message: `User ${normalizedEmail} has been made an admin.` });

      } catch (error) {
        console.error('Error in /api/admin/user/make-admin:', error);
        return res.status(500).send({ success: false, message: 'Internal server error' });
      }
    });

    app.post('/api/admin/user/remove-admin', authenticateJWT, async (req, res) => {
      const check = await ensureAdmin(req, res);
      if (!check || check.ok !== true) return;

      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).send({ success: false, message: 'Email is required' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        if (process.env.ADMIN_EMAIL && normalizedEmail === process.env.ADMIN_EMAIL) {
          return res.status(403).send({ success: false, message: 'Cannot remove the primary admin.' });
        }

        if (check.user.email === normalizedEmail) {
          return res.status(403).send({ success: false, message: 'Admin cannot remove themselves.' });
        }

        const result = await usersCollection.updateOne(
          { email: normalizedEmail },
          { $set: { isAdmin: false } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ success: false, message: 'User not found' });
        }

        res.send({ success: true, message: `User ${normalizedEmail}'s admin privileges have been revoked.` });

      } catch (error) {
        console.error('Error in /api/admin/user/remove-admin:', error);
        return res.status(500).send({ success: false, message: 'Internal server error' });
      }
    });


  } catch (err) {
    console.error('Startup Error:', err);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`<h1 style="text-align: center; color: green;">Max it Server (Optimized) is Running at ${port}</h1>`);
});

http_server.listen(port, () => {
  console.log(`Max it Production server running at: ${port}`);
});
