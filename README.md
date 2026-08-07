# POS QR Code + Queue + PromptPay

ระบบ POS หน้าร้านขายอาหารแบบสแกน QR Code  
ลูกค้าสแกน → เลือกเมนู → ได้หมายเลขคิว + QR PromptPay  
พ่อค้าเห็นออเดอร์บนมือถือ Android แบบ real-time

**Repo:** https://github.com/uburiram/pos

## คุณสมบัติ

- ลูกค้าไม่ต้องโหลดแอป (เปิดในเบราว์เซอร์)
- ระบบคิวอัตโนมัติ
- สร้าง QR PromptPay ตามยอดเงินจริง (มาตรฐานธนาคารแห่งประเทศไทย)
- Real-time ผ่าน Socket.io (ออเดอร์เด้งทันที)
- หน้าพ่อค้าเหมาะกับ Android (PWA-ready)
- ใช้ไอคอนของคุณเองจากโฟลเดอร์ `icon/`

## ความต้องการ

- Node.js 18 ขึ้นไป

## วิธีติดตั้งและรัน

```bash
git clone https://github.com/uburiram/pos.git
cd pos
npm install
npm start
```

เปิดเบราว์เซอร์:

- หน้าหลัก + QR สำหรับลูกค้า: `http://localhost:3000`
- เมนูลูกค้า: `http://localhost:3000/menu.html`
- หน้าพ่อค้า: `http://localhost:3000/merchant.html`

บนมือถือ (ต้องอยู่ WiFi เดียวกัน):

1. เปิด `http://<IP-ของคอม>:3000/merchant.html` แล้ว**ค้างไว้**
2. ลูกค้าสแกน QR จากหน้าหลัก หรือเปิด `menu.html`

เซิร์ฟเวอร์จะแสดง IP ให้ตอนสตาร์ท

## ตั้งค่า

แก้ไขไฟล์ `server.js`:

```js
const PROMPTPAY_ID = '1319900156356';  // เลข PromptPay ของคุณ (บัตรประชาชน/ภาษี)
const SHOP_NAME = 'ร้านอาหาร';        // ชื่อร้าน

// แก้เมนูได้ที่ array MENU
```

## โครงสร้าง

```
pos/
├── index.html
├── menu.html
├── merchant.html
├── manifest.json
├── server.js
├── package.json
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── menu.js
│   └── merchant.js
├── icon/                 # ไอคอนของคุณ
└── sounds/
```

## Flow การใช้งาน

1. พ่อค้าเปิดหน้า merchant บน Android ค้างไว้
2. ลูกค้าสแกน QR → เลือกเมนู → ยืนยัน
3. ได้หมายเลขคิว + QR PromptPay ให้สแกนชำระเงิน
4. ออเดอร์ขึ้นหน้าพ่อค้าทันที
5. พ่อค้ากดสถานะ: ชำระแล้ว → เริ่มทำ → พร้อมรับ → เสร็จสิ้น

## หมายเหตุ

- ออเดอร์เก็บใน memory (รีสตาร์ทเซิร์ฟเวอร์แล้วหาย) – เหมาะกับ prototype
- ถ้าต้องการเข้าถึงจากนอกเครือข่าย ใช้ ngrok หรือ deploy บน VPS
- PromptPay รองรับเลขบัตรประชาชน / เลขผู้เสียภาษี 13 หลัก และเบอร์มือถือ

## License

MIT
