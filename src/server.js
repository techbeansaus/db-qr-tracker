// server.js
const express = require('express');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const app = express();
const PORT = process.env.PORT || 5001;
const cors = require('cors');
require('dotenv').config({ path: __dirname + '/../.env' });
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const swaggerDocument = yaml.load(fs.readFileSync('./src/api-docs.yaml', 'utf8'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(cors());

const corsOptions = {
    origin: 'http://localhost:3000', // React app URL
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

app.get('/api/qrcodes', async (req, res) => {
  try {
      const qrCodes = await QRCodeModel.find({});
      res.json(qrCodes);
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/qrcodes/:id', async (req, res) => {
  const { id } = req.params; // id corresponds to qrCodeId
  try {
      const qrCode = await QRCodeModel.findOne({ qrCodeId: id });
      if (!qrCode) {
          return res.status(404).json({ message: 'QR Code not found' });
      }
      res.json(qrCode);
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
  }
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

app.get('/api/scans/:qrCodeId', async (req, res) => {
  const { qrCodeId } = req.params; // qrCodeId from the request parameters
  try {
      const scanLogs = await ScanLogModel.find({ qrCodeId }); // Assuming ScanLogModel is your model for scan logs
      if (!scanLogs || scanLogs.length === 0) {
          return res.status(404).json({ message: 'No scan logs found for this QR Code ID' });
      }
      res.json(scanLogs);
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/scan-analytics/:qrCodeId', async (req, res) => {
  const { qrCodeId } = req.params; // qrCodeId from the request parameters
  try {
      const analytics = await ScanLogModel.aggregate([
          { $match: { qrCodeId } }, // Match logs for the specific qrCodeId
          {
              $group: {
                  _id: {
                      deviceType: "$deviceType", // Assuming deviceType is a field in your scan logs
                      location: "$location",     // Assuming location is a field in your scan logs
                      date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } // Group by date
                  },
                  totalScans: { $sum: 1 } // Count total scans
              }
          },
          {
              $project: {
                  _id: 0,
                  deviceType: "$_id.deviceType",
                  location: "$_id.location",
                  date: "$_id.date",
                  totalScans: 1
              }
          }
      ]);

      if (!analytics || analytics.length === 0) {
          return res.status(404).json({ message: 'No scan analytics found for this QR Code ID' });
      }
      res.json(analytics);
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
