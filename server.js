/**
 * POS QR Code + Queue + PromptPay
 * สำหรับขายอาหารหน้าร้าน
 * Repo: https://github.com/uburiram/pos
 *
 * - ลูกค้าสแกน QR → สั่งเมนู → ได้คิว + QR PromptPay
 * - พ่อค้า (Android) เห็นออเดอร์ real-time + แจ้งเตือน
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// เสิร์ฟ index.html จาก root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== CONFIG ====================
// PromptPay ID ของคุณ (เลขบัตรประชาชน / เลขผู้เสียภาษี 13 หลัก)
const PROMPTPAY_ID = '1319900156356';
const PORT = process.env.PORT || 3000;
const SHOP_NAME = 'ร้านอาหาร';

// เมนูตัวอย่าง – แก้ไขได้ตามต้องการ
const MENU = [
  { id: 1, name: 'ข้าวผัดกุ้ง', price: 50, category: 'จานหลัก' },
  { id: 2, name: 'ข้าวผัดหมู', price: 45, category: 'จานหลัก' },
  { id: 3, name: 'ผัดกะเพราไก่', price: 45, category: 'จานหลัก' },
  { id: 4, name: 'ต้มยำกุ้ง', price: 80, category: 'น้ำ' },
  { id: 5, name: 'ไข่เจียว', price: 30, category: 'จานหลัก' },
  { id: 6, name: 'น้ำเปล่า', price: 10, category: 'เครื่องดื่ม' },
  { id: 7, name: 'โค้ก', price: 15, category: 'เครื่องดื่ม' },
  { id: 8, name: 'ชาเย็น', price: 25, category: 'เครื่องดื่ม' }
];

// ==================== Pure PromptPay Payload (มาตรฐาน BOT) ====================
// อ้างอิง: EMVCo QR + PromptPay (A000000677010111)
function crc16ccitt(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function f(id, value) {
  const len = String(value.length).padStart(2, '0');
  return id + len + value;
}

function generatePromptPayPayload(target, amount) {
  // sanitize: ลบขีดและช่องว่าง
  target = String(target).replace(/[^0-9]/g, '');
  let targetType;
  if (target.length >= 15) targetType = '03'; // e-Wallet
  else if (target.length >= 13) targetType = '02'; // Tax ID / National ID
  else targetType = '01'; // Phone

  // format phone ถ้าเป็นเบอร์
  let formatted = target;
  if (targetType === '01' && target.length === 10) {
    formatted = '0066' + target.substring(1);
  } else if (targetType === '02') {
    formatted = target; // 13 หลัก
  }

  const merchantInfo = f('00', 'A000000677010111') + f(targetType, formatted);

  let data = '';
  data += f('00', '01'); // Payload Format Indicator
  data += f('01', amount ? '12' : '11'); // POI Method (12 = dynamic)
  data += f('29', merchantInfo); // Merchant Account Information
  data += f('53', '764'); // Currency THB
  if (amount) {
    const amt = Number(amount).toFixed(2);
    data += f('54', amt);
  }
  data += f('58', 'TH'); // Country

  const crc = crc16ccitt(data + '6304');
  data += f('63', crc);
  return data;
}

async function generatePromptPayQR(amount) {
  const payload = generatePromptPayPayload(PROMPTPAY_ID, amount);
  const dataUrl = await QRCode.toDataURL(payload, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M'
  });
  return { payload, dataUrl };
}

// ==================== STATE ====================
let orders = [];
let nextQueue = 1;
let orderIdCounter = 1;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

// ==================== API ====================
app.get('/api/menu', (req, res) => {
  res.json({ shopName: SHOP_NAME, menu: MENU });
});

app.get('/api/config', (req, res) => {
  res.json({
    shopName: SHOP_NAME,
    promptpayId: PROMPTPAY_ID.replace(/(\d{4})(\d{5})(\d{4})/, '$1-xxx-$3'),
    localIP: getLocalIP(),
    port: PORT
  });
});

app.post('/api/order', async (req, res) => {
  try {
    const { items, customerName, note } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ไม่มีรายการสินค้า' });
    }

    let total = 0;
    const orderItems = items.map(it => {
      const menuItem = MENU.find(m => m.id === it.id);
      if (!menuItem) throw new Error(`ไม่พบเมนู id ${it.id}`);
      const qty = Math.max(1, parseInt(it.qty) || 1);
      const lineTotal = menuItem.price * qty;
      total += lineTotal;
      return { id: menuItem.id, name: menuItem.name, price: menuItem.price, qty, lineTotal };
    });

    const queueNumber = nextQueue++;
    const orderId = orderIdCounter++;
    const { payload, dataUrl } = await generatePromptPayQR(total);

    const order = {
      id: orderId,
      queueNumber,
      items: orderItems,
      total,
      customerName: customerName || 'ลูกค้า',
      note: note || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      promptpayPayload: payload
    };

    orders.unshift(order);
    io.emit('new-order', order);

    res.json({
      success: true,
      order: {
        id: order.id,
        queueNumber: order.queueNumber,
        total: order.total,
        items: order.items,
        status: order.status
      },
      promptpayQR: dataUrl,
      message: `คิวของคุณคือ ${queueNumber}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาด' });
  }
});

app.get('/api/orders', (req, res) => {
  res.json(orders);
});

app.patch('/api/orders/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const valid = ['pending', 'paid', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'ไม่พบออเดอร์' });

  order.status = status;
  order.updatedAt = new Date().toISOString();
  io.emit('order-updated', order);
  res.json({ success: true, order });
});

app.get('/api/menu-qr', async (req, res) => {
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}/menu.html`;
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    res.json({ url, qr: dataUrl, ip, port: PORT });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== SOCKET ====================
io.on('connection', (socket) => {
  console.log(`[Socket] connected: ${socket.id}`);
  socket.emit('orders-sync', orders);
  socket.on('disconnect', () => console.log(`[Socket] disconnected: ${socket.id}`));
});

// ==================== START ====================
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('========================================');
  console.log(`  ${SHOP_NAME} - POS QR + PromptPay`);
  console.log('========================================');
  console.log(`  Local:     http://localhost:${PORT}`);
  console.log(`  Network:   http://${ip}:${PORT}`);
  console.log(`  เมนูลูกค้า: http://${ip}:${PORT}/menu.html`);
  console.log(`  หน้าพ่อค้า: http://${ip}:${PORT}/merchant.html`);
  console.log(`  PromptPay: ${PROMPTPAY_ID}`);
  console.log('========================================');
});
