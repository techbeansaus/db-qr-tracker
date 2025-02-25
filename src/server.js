// server.js
const express = require('express');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const app = express();
const PORT = process.env.PORT || 5001;
const cors = require('cors');
require('dotenv').config({ path: __dirname + '/../.env' });

app.use(cors());

const corsOptions = {
    origin: 'http://localhost:3002', // React app URL
    optionsSuccessStatus: 200
  };
  
  app.use(cors(corsOptions));

  mongoose.connect(`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_PARAMS}`, { useNewUrlParser: true, useUnifiedTopology: true });
const qrCodeSchema = new mongoose.Schema({
  qrCodeId: String,
  url: String,
  qrCode: String,
  createdAt: { type: Date, default: Date.now },
});

const scanLogSchema = new mongoose.Schema({
  qrCodeId: String,
  scannedAt: { type: Date, default: Date.now },
  userAgent: String,
  ip: String,
});

const QRCodeModel = mongoose.model('QRCode', qrCodeSchema);
const ScanLogModel = mongoose.model('ScanLog', scanLogSchema);

app.use(express.json());


function generateGuid() {
    const guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    return guid;
}

app.post('/api/generate', async (req, res) => {
  const { url } = req.body;
  const qrCodeId = generateGuid();
  const qrCodeUrl = process.env.QR_TRACKER_URL + '?qrCodeId=' + qrCodeId; 

  const qrCode = await QRCode.toDataURL(qrCodeUrl);
  
  const newQRCode = new QRCodeModel({qrCodeId ,url, qrCode });
  await newQRCode.save();
  res.json(newQRCode);
});

app.get('/api/scan', async (req, res) => {
    const { qrCodeId } = req.query;
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;

    try {
        const qrCode = await QRCodeModel.findOne({ qrCodeId });
        if (!qrCode) {
            return res.status(404).json({ message: 'QR code not found' });
        }

        const newScanLog = new ScanLogModel({ qrCodeId, userAgent, ip });
        await newScanLog.save();

        res.redirect(qrCode.url);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/scan ', async (req, res) => {
  const { qrCodeId } = req.body;
  const userAgent = req.headers['user-agent'];
  const ip = req.ip;
  const newScanLog = new ScanLogModel({ qrCodeId, userAgent, ip });
  await newScanLog.save();
  res.json({ message: 'Scan logged' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
